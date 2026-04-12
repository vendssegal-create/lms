from django.conf import settings
from users.navigation import build_sidebar_items
from users.utils.roles import (
    get_user_roles, 
    get_user_role, 
    get_role_label, 
    get_dashboard_url,
    Role
)
from users.models import TeacherProfile, StudentProfile
from lms.models import Notification

def lms_context(request):
    if not request.user.is_authenticated:
        return {
            'user_role': Role.GUEST,
            'user_role_label': 'Mehmon',
            'available_roles': [Role.GUEST],
            'user_home_url_name': 'users:login',
        }

    unread_notifications_count = Notification.objects.filter(user=request.user, is_read=False).count()
    recent_notifications = Notification.objects.filter(user=request.user).order_by('-created_at')[:5]

    available_roles = get_user_roles(request.user)
    active_role = get_user_role(request.user, request.session)
    
    # Get avatar URL
    avatar_url = None
    if request.user.avatar:
        avatar_url = request.user.avatar.url
    elif active_role == Role.STUDENT:
        profile = getattr(request.user, 'student_profile', None)
        if profile:
            avatar_url = profile.image_url
    else:
        profile = getattr(request.user, 'teacher_profile', None)
        if profile:
            avatar_url = profile.avatar_url

    sidebar_items = build_sidebar_items(active_role)

    available_roles_raw = get_user_roles(request.user)
    available_roles = []
    for r in available_roles_raw:
        available_roles.append({
            'value': r,
            'label': get_role_label(r)
        })

    return {
        'user_role': active_role,
        'user_role_label': get_role_label(active_role),
        'available_roles': available_roles,
        'user_avatar_url': avatar_url,
        'sidebar_items': sidebar_items,
        'user_home_url_name': get_dashboard_url(request.user, request.session),
        'unread_notifications_count': unread_notifications_count,
        'recent_notifications': recent_notifications,
    }
