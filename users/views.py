import secrets
from django.shortcuts import render, redirect
from django.contrib.auth import login, logout, authenticate
from django.contrib import messages
from django.urls import reverse
from django.contrib.auth.decorators import login_required
from django.contrib.auth import update_session_auth_hash
from .services import HemisOAuthService, HemisOAuthError, login_student_via_bstu
from .utils.roles import (
    get_dashboard_url,
    get_user_roles,
    get_user_role,
    get_role_label,
)
from .forms import UserProfileForm, PasswordChangeForm

def login_view(request):
    if request.user.is_authenticated:
        return redirect(get_dashboard_url(request.user, request.session))

    service = HemisOAuthService()
    context = {
        "hemis_enabled": service.is_configured(),
        "missing_hemis_settings": service.missing_oauth_settings(),
    }

    if request.method == "POST":
        username = request.POST.get("username", "").strip()
        password = request.POST.get("password", "")
        
        try:
            if username and username[0].isdigit():
                # Student login via BSTU
                user = login_student_via_bstu(username, password)
            else:
                # Regular Django login
                user = authenticate(request, username=username, password=password)
                if user is None:
                    raise HemisOAuthError("Login yoki parol noto'g'ri.")
            
            login(request, user)
            messages.success(request, "Tizimga muvaffaqiyatli kirildi.")
            return redirect(get_dashboard_url(user, request.session))
            
        except HemisOAuthError as exc:
            context["error"] = str(exc)
            return render(request, "auth/login.html", context)

    return render(request, "auth/login.html", context)

@login_required
def logout_view(request):
    logout(request)
    messages.success(request, "Tizimdan chiqildi.")
    return redirect("users:login")

def hemis_login_start(request):
    service = HemisOAuthService()
    if not service.is_configured():
        missing = ", ".join(service.missing_oauth_settings())
        messages.error(request, f"HEMIS OAuth sozlanmagan. Yetishmayotgan qiymatlar: {missing}")
        return redirect("users:login")

    state = secrets.token_urlsafe(24)
    request.session["hemis_oauth_state"] = state
    return redirect(service.get_authorization_url(state))

def hemis_login_callback(request):
    error = request.GET.get("error")
    if error:
        messages.error(request, f"HEMIS login bekor qilindi: {error}")
        return redirect("users:login")

    expected_state = request.session.pop("hemis_oauth_state", "")
    incoming_state = request.GET.get("state", "")
    if expected_state and expected_state != incoming_state:
        messages.error(request, "OAuth holati mos kelmadi. Kirishni qayta urinib ko'ring.")
        return redirect("users:login")

    auth_code = request.GET.get("code")
    if not auth_code:
        messages.error(request, "Avtorizatsiya kodi qaytmadi.")
        return redirect("users:login")

    try:
        auth_result = HemisOAuthService().authenticate(auth_code)
        login(request, auth_result.user)
        messages.success(request, "HEMIS orqali muvaffaqiyatli tizimga kirdingiz.")
        return redirect(get_dashboard_url(auth_result.user, request.session))
    except HemisOAuthError as exc:
        messages.error(request, str(exc))
        return redirect("users:login")

@login_required
def switch_role_view(request, role_name):
    available_roles = get_user_roles(request.user)
    if role_name in available_roles:
        request.session["active_role"] = role_name
        messages.success(request, f"Rol muvaffaqiyatli almashtirildi: {get_role_label(role_name)}")
        return redirect(get_dashboard_url(request.user, request.session))
    
    messages.error(request, "Sizda bunday ruxsat yo'q.")
    return redirect("/")

@login_required
def profile_view(request):
    user = request.user
    allowed_roles = get_user_roles(user)
    stored = request.session.get("active_role")
    if stored is not None and stored not in allowed_roles:
        request.session.pop("active_role", None)
        messages.info(
            request,
            "Sessiyadagi «faol rol» endi akkauntingiz uchun yaroqsiz edi — u bekor qilindi. "
            "Menyu va ruxsatlar hozir asosiy yoki pastdan tanlangan rol bo‘yicha ishlaydi.",
        )

    if request.method == "POST":
        form = UserProfileForm(request.POST, request.FILES, instance=user)
        if form.is_valid():
            form.save()
            messages.success(request, "Profil muvaffaqiyatli yangilandi.")
            return redirect("users:profile")
    else:
        form = UserProfileForm(instance=user)

    active_role = get_user_role(user, request.session)
    roles_differ = bool(getattr(user, "role", None)) and (user.role != active_role)

    return render(
        request,
        "auth/profile.html",
        {
            "form": form,
            "account_role_label": user.get_role_display(),
            "roles_differ": roles_differ,
        },
    )

@login_required
def change_password_view(request):
    if request.method == "POST":
        form = PasswordChangeForm(request.POST)
        if form.is_valid():
            user = request.user
            if user.check_password(form.cleaned_data["old_password"]):
                user.set_password(form.cleaned_data["new_password"])
                user.save()
                update_session_auth_hash(request, user)
                messages.success(request, "Parol muvaffaqiyatli o'zgartirildi.")
                return redirect('users:profile')
            else:
                messages.error(request, "Eski parol noto'g'ri.")
    else:
        form = PasswordChangeForm()
    
    return render(request, "auth/change_password.html", {"form": form})
