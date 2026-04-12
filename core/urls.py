from django.contrib import admin
from django.conf import settings
from django.urls import path, include, re_path
from django.shortcuts import redirect
from django.conf.urls.static import static
from django.views.static import serve

from core.spa_views import spa_index
from users import views as user_views
from lms.views.certificate_print import course_certificate_print

urlpatterns = [
    path('admin/extension-requests', lambda request: redirect('/super-admin/extension-requests')),
    path('admin/extension-requests/', lambda request: redirect('/super-admin/extension-requests')),
    path('admin/', admin.site.urls),
    # HEMIS OAuth endpoints must stay at root (used by SPA login button + redirect URI).
    path('auth/hemis/start/', user_views.hemis_login_start, name='hemis_login_start'),
    path('auth/hemis/callback/', user_views.hemis_login_callback, name='hemis_login_callback'),
    path('api/auth/', include('users.api_urls')),
    path('api/lms/', include('lms.api_urls')),
    path('api/retake/', include('retake.api_urls')),
    path('api/messages/', include('messaging.api_urls')),
    # Sertifikat: brauzer chop etish / foydalanuvchi qurilmasida PDF (SPA dan tashqari HTML)
    path(
        'lms/courses/<int:course_id>/certificate/print/',
        course_certificate_print,
        name='lms_course_certificate_print',
    ),
    # Vite build assets for SPA
    re_path(
        r"^assets/(?P<path>.*)$",
        serve,
        {"document_root": settings.BASE_DIR / "design" / "dist" / "assets"},
    ),

    # Legacy server-rendered pages (served under __legacy, embedded inside SPA)
    path('__legacy/', include('users.urls')),
    path('__legacy/lms/', include('lms.urls')),
    path('__legacy/retake/', include(('retake.urls', 'retake'), namespace='retake')),

]

# Media/static must be registered BEFORE the SPA catch-all so Django
# serves files instead of falling through to index.html.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# SPA at root: anything not matched above will serve index.html
urlpatterns += [
    re_path(r'^(?P<_path>.*)$', spa_index, name='spa_catchall_root'),
]
