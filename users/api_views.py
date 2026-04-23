import json

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth import update_session_auth_hash
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.urls import NoReverseMatch, reverse
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from users.context_processors import lms_context
from users.forms import PasswordChangeForm, UserProfileForm
from users.models import SidebarMenu, SidebarMenuAccess, User
from users.services import HemisOAuthError, login_student_via_bstu
from users.utils.roles import Role, get_dashboard_url, get_role_label, get_user_role, get_user_roles
from users.utils.hemis_helpers import get_snapshot_for_user


def _json_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body)
    except json.JSONDecodeError:
        return {}


def _error(message: str, status: int = 400):
    return JsonResponse({"success": False, "error": message}, status=status)


def _resolve_url(url_name):
    try:
        return reverse(url_name)
    except NoReverseMatch:
        return url_name


def _build_messages_payload(request):
    if not request.user.is_authenticated:
        return {"unread_count": 0}

    from messaging.models import DirectMessage, DirectThread

    unread_count = 0
    threads = DirectThread.objects.filter(Q(user1=request.user) | Q(user2=request.user)).only(
        "id",
        "user1_id",
        "user2_id",
        "user1_last_read_at",
        "user2_last_read_at",
    )

    for thread in threads:
        last_read = thread.user1_last_read_at if thread.user1_id == request.user.id else thread.user2_last_read_at
        qs = DirectMessage.objects.filter(thread=thread).exclude(sender_id=request.user.id)
        if last_read:
            qs = qs.filter(created_at__gt=last_read)
        unread_count += qs.count()

    return {"unread_count": unread_count}


def _require_super_admin(request):
    if not request.user.is_authenticated:
        return _error("Autentifikatsiya talab qilinadi.", status=401)

    active_role = get_user_role(request.user, request.session)
    if active_role != Role.SUPER_ADMIN and not request.user.is_superuser:
        return _error("Bu bo'lim faqat super admin uchun.", status=403)

    return None


def _serialize_sidebar_management():
    menus = (
        SidebarMenu.objects.prefetch_related("role_access")
        .order_by("section", "label")
    )
    roles = [{"value": value, "label": label} for value, label in User.Role.choices]
    sections = [{"value": value, "label": label} for value, label in SidebarMenu.Section.choices]

    serialized_menus = []
    for menu in menus:
        access_map = {
            access.role: {
                "order_index": access.order_index,
                "is_visible": access.is_visible,
            }
            for access in menu.role_access.all()
        }
        serialized_menus.append({
            "id": menu.id,
            "key": menu.key,
            "label": menu.label,
            "section": menu.section,
            "icon_lucide": menu.icon_lucide,
            "spa_path": menu.spa_path,
            "url_name": menu.url_name,
            "external_url": menu.external_url,
            "is_enabled": menu.is_enabled,
            "description": menu.description,
            "access": access_map,
        })

    return {
        "roles": roles,
        "sections": sections,
        "menus": serialized_menus,
    }


def _build_session_payload(request):
    if not request.user.is_authenticated:
        return {
            "authenticated": False,
            "user": None,
            "active_role": None,
            "available_roles": [],
            "navigation": [],
            "notifications": {
                "unread_count": 0,
            },
            "messages": {
                "unread_count": 0,
            },
            "urls": {
                # SPA routes / backend auth endpoints
                "login": "/login",
                "hemis_login": "/auth/hemis/start/",
            },
        }

    context = lms_context(request)
    available_roles = get_user_roles(request.user)
    active_role = get_user_role(request.user, request.session)

    navigation = [
        {
            "key": item.get("key"),
            "label": item["label"],
            "path": item["path"],
            "icon": item.get("icon"),
            "section": item.get("section", "Asosiy modullar"),
            "order_index": item.get("order_index", 100),
        }
        for item in context.get("sidebar_items", [])
    ]

    retake_assigned_faculties = None
    if active_role == Role.RET_REGISTRATOR:
        from retake.utils.service_registrator_utils import get_service_registrator_faculties

        retake_assigned_faculties = get_service_registrator_faculties(request.user, request.session)

    return {
        "authenticated": True,
        "user": {
            "id": request.user.id,
            "username": request.user.username,
            "email": request.user.email,
            "first_name": request.user.first_name,
            "last_name": request.user.last_name,
            "full_name": request.user.get_full_name() or request.user.username,
            "primary_role": getattr(request.user, "role", ""),
            "primary_role_label": request.user.get_role_display() if getattr(request.user, "role", None) else "",
            "active_role": active_role,
            "active_role_label": get_role_label(active_role),
            "available_roles": [
                {"value": role, "label": get_role_label(role)} for role in available_roles
            ],
            "avatar_url": context.get("user_avatar_url"),
            "phone": getattr(request.user, "phone", ""),
            "quick_chat": _serialize_quick_chat_preferences(request.user),
            "retake_assigned_faculties": retake_assigned_faculties,
        },
        "active_role": active_role,
        "available_roles": [
            {"value": role, "label": get_role_label(role)} for role in available_roles
        ],
        "navigation": navigation,
        "notifications": {
            "unread_count": context.get("unread_notifications_count", 0),
        },
        "messages": _build_messages_payload(request),
        "urls": {
            # SPA routes
            "dashboard": "/",
            "profile": "/profile",
            "logout": "/api/auth/logout/",
            "switch_role_base": "/api/auth/switch-role/",
        },
    }


def _default_quick_chat_preferences():
    return {
        "side": "right",
        "offset_y": 140,
        "is_collapsed": True,
    }


def _serialize_quick_chat_preferences(user):
    prefs = getattr(user, "ui_preferences", None) or {}
    quick_chat = prefs.get("quick_chat") if isinstance(prefs, dict) else None
    defaults = _default_quick_chat_preferences()
    if not isinstance(quick_chat, dict):
        return defaults

    side = quick_chat.get("side")
    offset_y = quick_chat.get("offset_y")
    is_collapsed = quick_chat.get("is_collapsed")
    return {
        "side": side if side in ("left", "right") else defaults["side"],
        "offset_y": int(offset_y) if isinstance(offset_y, (int, float)) else defaults["offset_y"],
        "is_collapsed": bool(is_collapsed) if isinstance(is_collapsed, bool) else defaults["is_collapsed"],
    }


def _serialize_profile(request):
    user = request.user
    available_roles = get_user_roles(user)
    active_role = get_user_role(user, request.session)
    student_profile = getattr(user, "student_profile", None)
    teacher_profile = getattr(user, "teacher_profile", None)

    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "full_name": user.get_full_name() or user.username,
            "email": user.email,
            "phone": getattr(user, "phone", ""),
            "avatar_url": lms_context(request).get("user_avatar_url"),
            "primary_role": getattr(user, "role", ""),
            "primary_role_label": user.get_role_display() if getattr(user, "role", None) else "",
            "active_role": active_role,
            "active_role_label": get_role_label(active_role),
        },
        "roles": {
            "account_role_label": user.get_role_display(),
            "active_role_label": get_role_label(active_role),
            "roles_differ": bool(getattr(user, "role", None)) and user.role != active_role,
            "available_roles": [{"value": role, "label": get_role_label(role)} for role in available_roles],
        },
        "student_profile": {
            "student_id_number": student_profile.student_id_number,
            "faculty_name": student_profile.faculty_name,
            "group_name": student_profile.group_name,
            "specialty_name": student_profile.specialty_name,
            "education_form": student_profile.education_form,
            "education_type": student_profile.education_type,
            "education_lang": student_profile.education_lang,
            "level": student_profile.level,
            "student_status": student_profile.student_status,
            "university": student_profile.university,
            "address": student_profile.address,
            "image_url": student_profile.image_url,
        } if student_profile else None,
        "teacher_profile": {
            "full_name": teacher_profile.full_name,
            "department": teacher_profile.department,
            "hemis_id": teacher_profile.hemis_id,
            "hemis_position": teacher_profile.hemis_position,
            "experience_years": teacher_profile.experience_years,
            "avatar_url": teacher_profile.avatar_url,
            "phone": teacher_profile.phone,
        } if teacher_profile else None,
    }


@ensure_csrf_cookie
@require_GET
def session_view(request):
    return JsonResponse(_build_session_payload(request))


@csrf_exempt
@require_POST
def login_view(request):
    payload = _json_body(request)
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""

    if not username or not password:
        return JsonResponse({"success": False, "error": "Login va parol kiritilishi shart."}, status=400)

    try:
        if username[0].isdigit():
            user = login_student_via_bstu(username, password)
        else:
            user = authenticate(request, username=username, password=password)
            if user is None:
                raise HemisOAuthError("Login yoki parol noto'g'ri.")

        login(request, user)
        return JsonResponse({"success": True, "session": _build_session_payload(request)})
    except HemisOAuthError as exc:
        return JsonResponse({"success": False, "error": str(exc)}, status=400)


@csrf_exempt
@require_POST
def logout_view(request):
    logout(request)
    return JsonResponse({"success": True})


@require_POST
def switch_role_view(request, role_name):
    if not request.user.is_authenticated:
        return JsonResponse({"success": False, "error": "Autentifikatsiya talab qilinadi."}, status=401)

    available_roles = get_user_roles(request.user)
    if role_name not in available_roles:
        return JsonResponse({"success": False, "error": "Sizda bunday rol yo'q."}, status=403)

    request.session["active_role"] = role_name
    return JsonResponse({"success": True, "session": _build_session_payload(request)})


@require_GET
def profile_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)
    return JsonResponse(_serialize_profile(request))


@require_GET
def me_api(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    user = request.user
    snapshot = get_snapshot_for_user(user)

    data = {
        "id": user.id,
        "username": user.username,
        "full_name": user.get_full_name() or user.username,
        "role": get_user_role(user, request.session),
        "email": user.email,
    }

    if snapshot:
        data["hemis_profile"] = {
            "hemis_student_id": snapshot.hemis_student_id,
            "student_id_number": snapshot.student_id_number,
            "full_name": snapshot.full_name,
            "faculty_name": snapshot.faculty_name,
            "group_name": snapshot.group_name,
            "specialty_name": snapshot.specialty_name,
            "semester_name": snapshot.semester_name,
            "is_linked": True,
        }
    else:
        data["hemis_profile"] = {
            "is_linked": False,
            "warning": "HEMIS profil bog'lanmagan. Qayta login qiling.",
        }

    if hasattr(user, "student_profile"):
        sp = user.student_profile
        data["student_profile"] = {
            "university": sp.university,
            "group_name": sp.group_name or (snapshot.group_name if snapshot else ""),
            "faculty_name": sp.faculty_name or (snapshot.faculty_name if snapshot else ""),
        }

    return JsonResponse(data)


@require_POST
def update_profile_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    form = UserProfileForm(request.POST, request.FILES, instance=request.user)
    if not form.is_valid():
        non_field_errors = [str(message) for message in form.non_field_errors()]
        return JsonResponse({
            "success": False,
            "error": non_field_errors[0] if non_field_errors else "Profil ma'lumotlari noto'g'ri.",
            "errors": {key: [str(message) for message in messages] for key, messages in form.errors.items()},
            "non_field_errors": non_field_errors,
        }, status=400)

    form.save()
    return JsonResponse({
        "success": True,
        "profile": _serialize_profile(request),
        "session": _build_session_payload(request),
    })


@require_POST
def change_password_api_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    form = PasswordChangeForm(request.POST)
    if not form.is_valid():
        non_field_errors = [str(message) for message in form.non_field_errors()]
        return JsonResponse({
            "success": False,
            "error": non_field_errors[0] if non_field_errors else "Parolni yangilash so'rovi noto'g'ri.",
            "errors": {key: [str(message) for message in messages] for key, messages in form.errors.items()},
            "non_field_errors": non_field_errors,
        }, status=400)

    if not request.user.check_password(form.cleaned_data["old_password"]):
        return JsonResponse({
            "success": False,
            "error": "Eski parol noto'g'ri.",
            "errors": {"old_password": ["Eski parol noto'g'ri."]},
        }, status=400)

    request.user.set_password(form.cleaned_data["new_password"])
    request.user.save()
    update_session_auth_hash(request, request.user)

    return JsonResponse({"success": True})


@csrf_exempt
@require_POST
def quick_chat_preferences_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    payload = _json_body(request)
    side = payload.get("side")
    offset_y = payload.get("offset_y")
    is_collapsed = payload.get("is_collapsed")

    if side not in ("left", "right"):
        return JsonResponse({"error": "side faqat left yoki right bo'lishi kerak."}, status=400)

    try:
        offset_y = int(offset_y)
    except (TypeError, ValueError):
        return JsonResponse({"error": "offset_y son bo'lishi kerak."}, status=400)

    if not isinstance(is_collapsed, bool):
        return JsonResponse({"error": "is_collapsed boolean bo'lishi kerak."}, status=400)

    prefs = request.user.ui_preferences if isinstance(request.user.ui_preferences, dict) else {}
    next_prefs = {
        **prefs,
        "quick_chat": {
            "side": side,
            "offset_y": max(24, offset_y),
            "is_collapsed": is_collapsed,
        },
    }
    request.user.ui_preferences = next_prefs
    request.user.save(update_fields=["ui_preferences"])

    return JsonResponse({
        "success": True,
        "quick_chat": _serialize_quick_chat_preferences(request.user),
        "session": _build_session_payload(request),
    })


@require_GET
def sidebar_management_view(request):
    permission_error = _require_super_admin(request)
    if permission_error:
        return permission_error

    return JsonResponse(_serialize_sidebar_management())


@csrf_exempt
@require_POST
def sidebar_management_save_view(request):
    permission_error = _require_super_admin(request)
    if permission_error:
        return permission_error

    payload = _json_body(request)
    menu_items = payload.get("menus")

    if not isinstance(menu_items, list):
        return _error("menus ro'yxat ko'rinishida bo'lishi kerak.")

    valid_roles = {role for role, _label in User.Role.choices}
    valid_sections = {section for section, _label in SidebarMenu.Section.choices}
    existing_menu_map = {menu.id: menu for menu in SidebarMenu.objects.all()}

    try:
        with transaction.atomic():
            for item in menu_items:
                if not isinstance(item, dict):
                    raise ValidationError("Har bir menu obyekt ko'rinishida bo'lishi kerak.")

                menu_id = item.get("id")
                menu = existing_menu_map.get(menu_id) if menu_id else SidebarMenu()
                if menu_id and menu is None:
                    raise ValidationError(f"Menu topilmadi: {menu_id}")

                section = item.get("section") or SidebarMenu.Section.MAIN
                if section not in valid_sections:
                    raise ValidationError(f"Noto'g'ri section: {section}")

                menu.key = (item.get("key") or "").strip()
                menu.label = (item.get("label") or "").strip()
                menu.section = section
                menu.icon_lucide = (item.get("icon_lucide") or "layout-dashboard").strip()
                menu.spa_path = (item.get("spa_path") or "").strip()
                menu.url_name = (item.get("url_name") or "").strip()
                menu.external_url = (item.get("external_url") or "").strip()
                menu.is_enabled = bool(item.get("is_enabled", True))
                menu.description = (item.get("description") or "").strip()
                menu.full_clean()
                menu.save()

                access_map = item.get("access") or {}
                if not isinstance(access_map, dict):
                    raise ValidationError(f"Menu access noto'g'ri formatda: {menu.label}")

                seen_roles = set()
                for role_name, access_data in access_map.items():
                    if role_name not in valid_roles:
                        raise ValidationError(f"Noto'g'ri role: {role_name}")
                    if not isinstance(access_data, dict):
                        raise ValidationError(f"Access ma'lumoti noto'g'ri: {menu.label} / {role_name}")

                    seen_roles.add(role_name)
                    SidebarMenuAccess.objects.update_or_create(
                        menu=menu,
                        role=role_name,
                        defaults={
                            "order_index": int(access_data.get("order_index", 100)),
                            "is_visible": bool(access_data.get("is_visible", False)),
                        },
                    )

                SidebarMenuAccess.objects.filter(menu=menu).exclude(role__in=seen_roles).delete()

    except ValidationError as exc:
        message = exc.messages[0] if hasattr(exc, "messages") and exc.messages else str(exc)
        return _error(message)
    except (TypeError, ValueError):
        return _error("Sidebar ma'lumotlarini saqlashda format xatosi yuz berdi.")

    return JsonResponse({
        "success": True,
        "data": _serialize_sidebar_management(),
        "session": _build_session_payload(request),
    })
