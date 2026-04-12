from django.db import models
from django.utils.translation import gettext_lazy as _
from functools import wraps
from django.shortcuts import redirect
from django.contrib import messages

# The shared Role enum. Values MUST match users.models.User.Role
class Role(models.TextChoices):
    GUEST = "GUEST", _("Mehmon")
    SUPER_ADMIN = "SUPER_ADMIN", _("Super admin")
    TEACHER = "TEACHER", _("O'qituvchi")
    STUDENT = "STUDENT", _("Talaba")
    ACADEMIC_BOARD = "ACADEMIC_BOARD", _("O'quv bo'limi")
    DIRECTION = "DIRECTION", _("Rahbariyat")
    REGISTRATOR = "REGISTRATOR", _("Registrator ofisi")
    RET_REGISTRATOR = "RET_REGISTRATOR", _("Registrator (xizmat ko'rsatish)")
    RET_ACCOUNTING = "RET_ACCOUNTING", _("Registrator (buxgalteriya)")
    RET_SUPERVISOR = "RET_SUPERVISOR", _("Registrator boshlig'i")
    RET_DB_MANAGER = "RET_DB_MANAGER", _("Registrator (MB menejeri)")

STAFF_ROLES = {
    Role.TEACHER,
    Role.ACADEMIC_BOARD,
    Role.DIRECTION,
    Role.REGISTRATOR,
    Role.RET_REGISTRATOR,
    Role.RET_ACCOUNTING,
    Role.RET_SUPERVISOR,
    Role.RET_DB_MANAGER,
}

DASHBOARD_URL_BY_ROLE = {
    Role.SUPER_ADMIN: "lms:admin_dashboard",
    Role.TEACHER: "lms:teacher_dashboard",
    Role.STUDENT: "lms:student_dashboard",
    Role.ACADEMIC_BOARD: "lms:academic_board_dashboard",
    Role.DIRECTION: "lms:direction_dashboard",
    Role.REGISTRATOR: "lms:registrator_dashboard",
    Role.RET_REGISTRATOR: "retake:retake_dashboard",
    Role.RET_ACCOUNTING: "retake:retake_dashboard",
    Role.RET_SUPERVISOR: "retake:retake_dashboard",
    Role.RET_DB_MANAGER: "retake:retake_dashboard",
}

def get_user_roles(user):
    if not user or not user.is_authenticated:
        return [Role.GUEST]

    if user.is_superuser:
        return [role for role in Role.values if role != Role.GUEST]

    roles = []
    
    # 1. Check primary role field
    primary_role = getattr(user, 'role', None)
    if primary_role and primary_role in Role.values:
        roles.append(primary_role)

    # 2. Add Super Admin if superuser
    if user.is_superuser and Role.SUPER_ADMIN not in roles:
        roles.insert(0, Role.SUPER_ADMIN)

    # 3. Check Groups for secondary roles (compatibility)
    user_group_names = {name.upper().replace(' ', '_') for name in user.groups.values_list('name', flat=True)}
    for role_name in Role.values:
        if role_name in user_group_names and role_name not in roles:
            roles.append(role_name)
    
    return roles or [Role.GUEST]

def get_user_role(user, session=None):
    if not user or not user.is_authenticated:
        return Role.GUEST
    
    available_roles = get_user_roles(user)
    
    if session:
        active_role = session.get("active_role")
        if active_role in available_roles:
            return active_role
            
    return available_roles[0] if available_roles else Role.GUEST

def get_dashboard_url(user, session=None):
    from django.urls import reverse
    role = get_user_role(user, session)
    url_name = DASHBOARD_URL_BY_ROLE.get(role, "users:login")
    try:
        return reverse(url_name)
    except:
        return "/"

def get_role_label(role):
    for r in Role:
        if r.value == role:
            return r.label
    return role

def is_staff_role(role):
    return role in STAFF_ROLES or role == Role.SUPER_ADMIN

def can_manage_course_content(user, session=None):
    role = get_user_role(user, session)
    return role in [Role.TEACHER, Role.SUPER_ADMIN, Role.ACADEMIC_BOARD]

def can_manage_enrollments(user, session=None):
    role = get_user_role(user, session)
    return role in [Role.REGISTRATOR, Role.SUPER_ADMIN, Role.ACADEMIC_BOARD]

def can_view_students_list(user, session=None):
    role = get_user_role(user, session)
    return role in [Role.REGISTRATOR, Role.SUPER_ADMIN, Role.ACADEMIC_BOARD, Role.DIRECTION, Role.TEACHER]

def can_manage_tests(user, session=None):
    role = get_user_role(user, session)
    return role in [Role.TEACHER, Role.SUPER_ADMIN, Role.ACADEMIC_BOARD]

def can_view_test_reporting(user, session=None):
    role = get_user_role(user, session)
    return role in [Role.TEACHER, Role.SUPER_ADMIN, Role.ACADEMIC_BOARD, Role.DIRECTION]

def role_required(*roles):
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            role = get_user_role(request.user, request.session)
            if role in roles or (Role.SUPER_ADMIN in roles and request.user.is_superuser):
                return view_func(request, *args, **kwargs)
            messages.error(request, "Sizda ushbu sahifaga kirish huquqi yo'q.")
            return redirect(get_dashboard_url(request.user, request.session))
        return _wrapped_view
    return decorator
