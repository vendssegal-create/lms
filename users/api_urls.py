from django.urls import path

from . import api_views


urlpatterns = [
    path("session/", api_views.session_view, name="api_session"),
    path("login/", api_views.login_view, name="api_login"),
    path("logout/", api_views.logout_view, name="api_logout"),
    path("switch-role/<path:role_name>/", api_views.switch_role_view, name="api_switch_role"),
    path("sidebar-management/", api_views.sidebar_management_view, name="api_sidebar_management"),
    path("sidebar-management/save/", api_views.sidebar_management_save_view, name="api_sidebar_management_save"),
    path("me/", api_views.me_api, name="api_me"),
    path("profile/", api_views.profile_view, name="api_profile"),
    path("profile/update/", api_views.update_profile_view, name="api_profile_update"),
    path("quick-chat/preferences/", api_views.quick_chat_preferences_view, name="api_quick_chat_preferences"),
    path("change-password/", api_views.change_password_api_view, name="api_change_password"),
]
