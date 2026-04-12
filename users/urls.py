from django.urls import path
from . import views

app_name = 'users'

urlpatterns = [
    path('', views.login_view, name='home'),
    path('login/', views.login_view, name='login'),
    path('accounts/login/', views.login_view, name='login_full'),
    path('accounts/logout/', views.logout_view, name='logout'),
    path('auth/hemis/start/', views.hemis_login_start, name='hemis_login_start'),
    path('auth/hemis/callback/', views.hemis_login_callback, name='hemis_login_callback'),
    path('switch-role/<path:role_name>/', views.switch_role_view, name='switch_role'),
    path('profile/', views.profile_view, name='profile'),
    path('change-password/', views.change_password_view, name='change_password'),
]
