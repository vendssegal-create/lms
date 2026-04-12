from __future__ import annotations

import json

from django.db import models
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from lms.models import Notification
from lms.models import Enrollment
from users.models import User

from .models import DirectMessage, DirectThread, MessageReaction


def _json_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body)
    except json.JSONDecodeError:
        return {}


def _avatar_url(user: User) -> str:
    if getattr(user, "avatar", None):
        try:
            return user.avatar.url
        except Exception:
            pass

    profile = getattr(user, "student_profile", None)
    if profile and getattr(profile, "image", None):
        return profile.image_url

    tprofile = getattr(user, "teacher_profile", None)
    if tprofile and getattr(tprofile, "avatar", None):
        try:
            return tprofile.avatar.url
        except Exception:
            pass

    full_name = user.get_full_name() or user.username
    return f"https://ui-avatars.com/api/?name={full_name}&background=random"


def _thread_pair(user_a: User, user_b: User) -> tuple[int, int]:
    a = int(user_a.id)
    b = int(user_b.id)
    return (a, b) if a < b else (b, a)


def _require_auth(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)
    return None


def _serialize_message(message: DirectMessage) -> dict:
    attachment_url = None
    if getattr(message, "attachment", None) and not message.is_deleted:
        try:
            attachment_url = message.attachment.url
        except Exception:
            attachment_url = None

    reply_data = None
    if message.reply_to_id and not message.is_deleted:
        try:
            rt = message.reply_to
            reply_data = {
                "id": rt.id,
                "sender_id": rt.sender_id,
                "body": rt.body[:120] if not rt.is_deleted else "[o'chirildi]",
                "attachment_name": rt.attachment_name or "",
            }
        except Exception:
            reply_data = None

    reactions = {}
    for reaction in getattr(message, "_prefetched_reactions", message.reactions.all()):
        reactions[reaction.emoji] = reactions.get(reaction.emoji, 0) + 1

    return {
        "id": message.id,
        "thread_id": message.thread_id,
        "sender_id": message.sender_id,
        "body": "[o'chirildi]" if message.is_deleted else message.body,
        "is_deleted": message.is_deleted,
        "created_at": message.created_at.isoformat(),
        "updated_at": message.updated_at.isoformat(),
        "attachment_url": attachment_url,
        "attachment_name": message.attachment_name or "",
        "attachment_size": message.attachment_size,
        "attachment_mime": message.attachment_mime,
        "reply_to": reply_data,
        "is_read": message.is_read,
        "read_at": message.read_at.isoformat() if message.read_at else None,
        "reactions": reactions,
    }


def _serialize_user_min(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.get_full_name() or user.username,
        "avatar_url": _avatar_url(user),
    }


def _is_staff_like(user: User) -> bool:
    # Allow admins/staff roles to message broadly.
    role = (getattr(user, "role", "") or "").upper()
    return role in (
        "SUPER_ADMIN",
        "ACADEMIC_BOARD",
        "DIRECTION",
        "REGISTRATOR",
        "RET_REGISTRATOR",
        "RET_ACCOUNTING",
        "RET_SUPERVISOR",
        "RET_DB_MANAGER",
    ) or bool(getattr(user, "is_superuser", False))


def _can_message(user: User, target: User) -> bool:
    if user.id == target.id:
        return False
    if _is_staff_like(user) or _is_staff_like(target):
        return True

    # Teacher -> enrolled student, or Student -> course teacher.
    if getattr(user, "role", "") == User.Role.TEACHER:
        return Enrollment.objects.filter(course__teacher=user, student=target).exists()
    if getattr(target, "role", "") == User.Role.TEACHER:
        return Enrollment.objects.filter(course__teacher=target, student=user).exists()

    # Student <-> Student: allow if they share at least one course.
    # This keeps privacy better than global user search.
    if getattr(user, "role", "") == User.Role.STUDENT and getattr(target, "role", "") == User.Role.STUDENT:
        other_course_ids = Enrollment.objects.filter(student=target).values_list("course_id", flat=True)
        return Enrollment.objects.filter(student=user, course_id__in=other_course_ids).exists()

    return False


def _unread_count_for_thread(thread: DirectThread, user: User) -> int:
    if user.id == thread.user1_id:
        last_read = thread.user1_last_read_at
    elif user.id == thread.user2_id:
        last_read = thread.user2_last_read_at
    else:
        return 0

    qs = DirectMessage.objects.filter(thread=thread, is_deleted=False).exclude(sender_id=user.id)
    if last_read:
        qs = qs.filter(created_at__gt=last_read)
    return qs.count()


def _can_access_thread(thread: DirectThread, user: User) -> bool:
    return user.id in (thread.user1_id, thread.user2_id)


@require_GET
def contacts_list(request):
    deny = _require_auth(request)
    if deny:
        return deny

    role_filter = (request.GET.get("role") or "").strip().upper()
    qs = User.objects.exclude(id=request.user.id).select_related("student_profile", "teacher_profile")

    # Limit list to users the requester can message.
    # For performance, we do coarse filtering based on role + enrollment relationships.
    me = request.user
    my_role = getattr(me, "role", "")

    if _is_staff_like(me):
        pass
    elif my_role == User.Role.TEACHER:
        student_ids = Enrollment.objects.filter(course__teacher=me).values_list("student_id", flat=True).distinct()
        qs = qs.filter(id__in=student_ids)
    elif my_role == User.Role.STUDENT:
        course_ids = Enrollment.objects.filter(student=me).values_list("course_id", flat=True)
        teacher_ids = (
            Enrollment.objects.filter(course_id__in=course_ids)
            .values_list("course__teacher_id", flat=True)
            .distinct()
        )
        peer_ids = (
            Enrollment.objects.filter(course_id__in=course_ids)
            .values_list("student_id", flat=True)
            .distinct()
        )
        qs = qs.filter(models.Q(id__in=teacher_ids) | models.Q(id__in=peer_ids))
    else:
        qs = qs.none()

    if role_filter in ("STUDENT", "TEACHER"):
        qs = qs.filter(role=role_filter)

    # Final safety filter (small list).
    users = list(qs.order_by("username")[:200])
    items = [_serialize_user_min(u) for u in users if _can_message(me, u)]
    return JsonResponse({"items": items[:50]})


@require_GET
def users_search(request):
    deny = _require_auth(request)
    if deny:
        return deny

    q = (request.GET.get("q") or "").strip()
    role = (request.GET.get("role") or "").strip().upper()
    if len(q) < 2:
        return JsonResponse({"items": []})

    qs = User.objects.exclude(id=request.user.id).select_related("student_profile", "teacher_profile")
    if role in ("STUDENT", "TEACHER"):
        qs = qs.filter(role=role)

    qs = qs.filter(
        models.Q(username__icontains=q)
        | models.Q(first_name__icontains=q)
        | models.Q(last_name__icontains=q)
        | models.Q(student_profile__full_name__icontains=q)
        | models.Q(student_profile__student_id_number__icontains=q)
        | models.Q(student_profile__group_name__icontains=q)
        | models.Q(teacher_profile__full_name__icontains=q)
    )

    # Safety: filter out users you cannot message.
    me = request.user
    users = list(qs.order_by("username")[:80])
    items = [_serialize_user_min(u) for u in users if _can_message(me, u)][:30]
    return JsonResponse({"items": items})


@require_GET
def threads_list(request):
    deny = _require_auth(request)
    if deny:
        return deny

    user = request.user
    threads = (
        DirectThread.objects.filter(models.Q(user1=user) | models.Q(user2=user))
        .select_related("user1", "user2")
        .order_by("-updated_at")[:200]
    )

    items = []
    for thread in threads:
        other = thread.user2 if thread.user1_id == user.id else thread.user1
        last_message = (
            DirectMessage.objects.filter(thread=thread)
            .select_related("sender")
            .order_by("-created_at")
            .first()
        )
        items.append(
            {
                "id": thread.id,
                "other_user": _serialize_user_min(other),
                "updated_at": thread.updated_at.isoformat(),
                "last_message": _serialize_message(last_message) if last_message else None,
                "unread_count": _unread_count_for_thread(thread, user),
            }
        )

    total_unread = sum(i["unread_count"] for i in items)
    return JsonResponse({"items": items, "unread_total": total_unread})


@require_POST
def threads_start(request):
    deny = _require_auth(request)
    if deny:
        return deny

    payload = _json_body(request)
    username = (payload.get("username") or "").strip()
    user_id = payload.get("user_id")

    target = None
    if username:
        target = User.objects.filter(username=username).first()
    if target is None and str(user_id).strip().isdigit():
        target = User.objects.filter(id=int(user_id)).first()

    if target is None:
        return JsonResponse({"error": "Foydalanuvchi topilmadi."}, status=404)
    if target.id == request.user.id:
        return JsonResponse({"error": "O'zingizga yozolmaysiz."}, status=400)
    if not _can_message(request.user, target):
        return JsonResponse({"error": "Siz bu foydalanuvchiga yozolmaysiz."}, status=403)

    u1_id, u2_id = _thread_pair(request.user, target)
    thread, _created = DirectThread.objects.get_or_create(user1_id=u1_id, user2_id=u2_id)

    return JsonResponse(
        {
            "success": True,
            "thread": {
                "id": thread.id,
                "other_user": _serialize_user_min(target),
            },
        }
    )


@require_GET
def thread_detail(request, thread_id: int):
    deny = _require_auth(request)
    if deny:
        return deny

    thread = get_object_or_404(DirectThread.objects.select_related("user1", "user2"), id=thread_id)
    if not _can_access_thread(thread, request.user):
        return JsonResponse({"error": "Ruxsat yo'q."}, status=403)

    limit = min(int(request.GET.get("limit") or 50), 200)
    before_id = request.GET.get("before_id")

    qs = (
        DirectMessage.objects
        .filter(thread=thread)
        .select_related("sender", "reply_to")
        .prefetch_related("reactions")
        .order_by("-id")
    )
    if before_id and str(before_id).strip().isdigit():
        qs = qs.filter(id__lt=int(before_id))
    messages = list(qs[:limit])
    messages.reverse()

    other = thread.user2 if thread.user1_id == request.user.id else thread.user1
    unread = _unread_count_for_thread(thread, request.user)

    return JsonResponse(
        {
            "thread": {
                "id": thread.id,
                "other_user": _serialize_user_min(other),
                "updated_at": thread.updated_at.isoformat(),
                "unread_count": unread,
            },
            "messages": [_serialize_message(m) for m in messages],
        }
    )


@require_POST
def thread_send(request, thread_id: int):
    deny = _require_auth(request)
    if deny:
        return deny

    thread = get_object_or_404(DirectThread.objects.select_related("user1", "user2"), id=thread_id)
    if not _can_access_thread(thread, request.user):
        return JsonResponse({"error": "Ruxsat yo'q."}, status=403)

    uploaded_file = request.FILES.get("file")
    payload = _json_body(request) if not uploaded_file else request.POST
    body = (payload.get("body") or "").strip()
    reply_to_id = payload.get("reply_to_id")

    if not body and not uploaded_file:
        return JsonResponse({"error": "Xabar matni bo'sh."}, status=400)

    create_kwargs = {
        "thread": thread,
        "sender": request.user,
        "body": (body[:4000] if body else ""),
        "attachment": uploaded_file,
        "attachment_name": (uploaded_file.name if uploaded_file else ""),
        "attachment_size": (uploaded_file.size if uploaded_file else None),
        "attachment_mime": (getattr(uploaded_file, "content_type", "") if uploaded_file else ""),
    }
    if reply_to_id and str(reply_to_id).strip().isdigit():
        create_kwargs["reply_to"] = DirectMessage.objects.filter(
            id=int(reply_to_id),
            thread=thread,
        ).first()

    msg = DirectMessage.objects.create(**create_kwargs)
    DirectThread.objects.filter(id=thread.id).update(updated_at=timezone.now())

    # Notify the other participant (optional but useful).
    other = thread.user2 if thread.user1_id == request.user.id else thread.user1
    Notification.objects.create(
        user=other,
        title="Yangi xabar",
        message=f"{request.user.get_full_name() or request.user.username}: {body[:120]}",
        link=f"/messages/{thread.id}",
    )

    serialized = _serialize_message(msg)

    # Broadcast to connected websocket clients.
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"direct_thread_{thread.id}",
        {"type": "message.created", "message": serialized},
    )

    return JsonResponse({"success": True, "message": serialized})


@require_POST
def thread_mark_read(request, thread_id: int):
    deny = _require_auth(request)
    if deny:
        return deny

    thread = get_object_or_404(DirectThread, id=thread_id)
    if not _can_access_thread(thread, request.user):
        return JsonResponse({"error": "Ruxsat yo'q."}, status=403)

    now = timezone.now()
    if request.user.id == thread.user1_id:
        DirectThread.objects.filter(id=thread.id).update(user1_last_read_at=now)
    else:
        DirectThread.objects.filter(id=thread.id).update(user2_last_read_at=now)
    DirectMessage.objects.filter(
        thread=thread,
        is_read=False,
        is_deleted=False,
    ).exclude(sender=request.user).update(is_read=True, read_at=now)

    return JsonResponse({"success": True})


@require_POST
def message_delete(request, message_id: int):
    deny = _require_auth(request)
    if deny:
        return deny

    msg = get_object_or_404(DirectMessage, id=message_id, sender=request.user)
    msg.is_deleted = True
    msg.deleted_at = timezone.now()
    msg.body = ""
    if msg.attachment:
        msg.attachment.delete(save=False)
    msg.attachment_name = ""
    msg.attachment_size = None
    msg.attachment_mime = ""
    msg.save(
        update_fields=[
            "is_deleted",
            "deleted_at",
            "body",
            "attachment_name",
            "attachment_size",
            "attachment_mime",
            "updated_at",
        ]
    )

    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"direct_thread_{msg.thread_id}",
        {"type": "message.deleted", "message_id": message_id},
    )
    return JsonResponse({"success": True})


@require_POST
def message_react(request, message_id: int):
    deny = _require_auth(request)
    if deny:
        return deny

    payload = _json_body(request)
    emoji = (payload.get("emoji") or "").strip()
    if not emoji or len(emoji) > 8:
        return JsonResponse({"error": "emoji shart."}, status=400)

    msg = get_object_or_404(DirectMessage, id=message_id)
    if not _can_access_thread(msg.thread, request.user):
        return JsonResponse({"error": "Ruxsat yo'q."}, status=403)

    reaction, created = MessageReaction.objects.get_or_create(
        message=msg,
        user=request.user,
        emoji=emoji,
    )
    if not created:
        reaction.delete()
        action = "removed"
    else:
        action = "added"

    reactions = {}
    for reaction in MessageReaction.objects.filter(message=msg):
        reactions[reaction.emoji] = reactions.get(reaction.emoji, 0) + 1

    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"direct_thread_{msg.thread_id}",
        {"type": "message.reacted", "message_id": message_id, "reactions": reactions},
    )
    return JsonResponse({"success": True, "action": action, "reactions": reactions})


@require_GET
def thread_search(request, thread_id: int):
    deny = _require_auth(request)
    if deny:
        return deny

    thread = get_object_or_404(DirectThread, id=thread_id)
    if not _can_access_thread(thread, request.user):
        return JsonResponse({"error": "Ruxsat yo'q."}, status=403)

    query = (request.GET.get("q") or "").strip()
    if len(query) < 2:
        return JsonResponse({"items": []})

    messages = (
        DirectMessage.objects
        .filter(thread=thread, is_deleted=False, body__icontains=query)
        .select_related("sender", "reply_to")
        .prefetch_related("reactions")
        .order_by("-created_at")[:30]
    )
    return JsonResponse({"items": [_serialize_message(message) for message in messages]})
