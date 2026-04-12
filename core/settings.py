"""
Django settings for core project.
"""

from pathlib import Path
import os
import environ

# Initialize environment variables
env = environ.Env(
    DEBUG=(bool, False)
)

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Read .env file
env_file = os.path.join(BASE_DIR, '.env')
if os.path.exists(env_file):
    environ.Env.read_env(env_file)

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env('DJANGO_SECRET_KEY', default='django-insecure-0(r0r$36_3v+839!yk=ff&j-i2du3h2l@=qqa#*lfskwfc$6o)')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env('DJANGO_DEBUG', default=True)

ALLOWED_HOSTS = env.list('DJANGO_ALLOWED_HOSTS', default=['*'])


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party apps
    'rest_framework',
    'django_extensions',
    'corsheaders',
    'channels',

    # Local apps
    'users',
    'lms',
    'retake',
    'hemis',
    'messaging',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'core.middleware.LegacyEmbedRedirectMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'users.context_processors.lms_context',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'
ASGI_APPLICATION = 'core.asgi.application'


# Database
# https://docs.djangoproject.com/en/5.1/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}


# Custom User Model
AUTH_USER_MODEL = 'users.User'


# Password validation
# https://docs.djangoproject.com/en/5.1/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.1/topics/i18n/

LANGUAGE_CODE = 'uz-uz'

TIME_ZONE = 'Asia/Tashkent'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.1/howto/static-files/

# Use absolute URLs so templates don't generate relative paths like "static/..."
# which break when you are on nested routes (e.g. /lms/student/).
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static']

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
# https://docs.djangoproject.com/en/5.1/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.BasicAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

# CORS settings
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = env.list(
    'DJANGO_CSRF_TRUSTED_ORIGINS',
    default=[
        'http://127.0.0.1:3000',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
        'http://localhost:5173',
        'http://127.0.0.1:8000',
        'http://localhost:8000',
    ],
)

# Allow embedding legacy pages inside the SPA iframe (same origin).
X_FRAME_OPTIONS = "SAMEORIGIN"

# Channels
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}

# HEMIS API Settings
HEMIS_REST_BASE_URL = env('HEMIS_REST_BASE_URL', default='https://student.bstu.uz/rest')
HEMIS_BACKEND_API_TOKEN = env('HEMIS_BACKEND_API_TOKEN', default='')
HEMIS_TIMEOUT = env.int('HEMIS_TIMEOUT', default=10)
HEMIS_API_LANG = env('HEMIS_API_LANG', default='uz')

# HEMIS OAuth Settings
HEMIS_OAUTH_CLIENT_ID = env('HEMIS_OAUTH_CLIENT_ID', default='')
HEMIS_OAUTH_CLIENT_SECRET = env('HEMIS_OAUTH_CLIENT_SECRET', default='')
HEMIS_OAUTH_REDIRECT_URI = env('HEMIS_OAUTH_REDIRECT_URI', default='http://127.0.0.1:8000/auth/hemis/callback/')
HEMIS_OAUTH_AUTHORIZE_URL = env('HEMIS_OAUTH_AUTHORIZE_URL', default='https://hemis.university.uz/oauth/authorize')
HEMIS_OAUTH_TOKEN_URL = env('HEMIS_OAUTH_TOKEN_URL', default='https://hemis.university.uz/oauth/access-token')
HEMIS_OAUTH_USERINFO_URL = env('HEMIS_OAUTH_USERINFO_URL', default='https://hemis.university.uz/oauth/api-user')

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'level': 'ERROR',
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'django_error.log'),
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console', 'file'],
        'level': 'INFO',
    },
}

# Celery Settings
CELERY_BROKER_URL = env('CELERY_BROKER_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = env('CELERY_RESULT_BACKEND', default='redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE

# Celery Beat Schedule
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    "check-approaching-deadlines": {
        "task": "lms.check_approaching_deadlines",
        "schedule": crontab(hour=8, minute=0),
    },
}

# Certificate Settings
CERTIFICATE_SERIAL_PREFIX = env('CERTIFICATE_SERIAL_PREFIX', default='CERT')
LMS_BASE_URL = env('LMS_BASE_URL', default='http://127.0.0.1:8000')
LMS_INSTITUTION_NAME = env('LMS_INSTITUTION_NAME', default="")
LMS_RECTOR_NAME = env('LMS_RECTOR_NAME', default='')
LMS_RECTOR_POSITION = env('LMS_RECTOR_POSITION', default='Muassasa rahbari')
CERTIFICATE_VERIFY_BASE_URL = env('CERTIFICATE_VERIFY_BASE_URL', default='http://127.0.0.1:8000/verify/')
# DOCX→PDF: to‘liq yo‘l (soffice.exe). Bo‘sh bo‘lsa standart o‘rnatish va PATH qidiriladi.
LIBREOFFICE_SOFFICE = env("LIBREOFFICE_SOFFICE", default="").strip()
if LIBREOFFICE_SOFFICE:
    os.environ.setdefault("LIBREOFFICE_SOFFICE", LIBREOFFICE_SOFFICE)
# libreoffice | docx2pdf (Word + Win/macOS) | auto (avvalo LO, yo‘q bo‘lsa docx2pdf; docx2pdf xatoda LO)
CERTIFICATE_PDF_BACKEND = env("CERTIFICATE_PDF_BACKEND", default="libreoffice").strip().lower()
# Tanlangan sertifikat strategiyasi (pick-strategy):
#   docx_primary — DOCX asosiy yetkazib berish (LO/Wordsiz serverda ishonchli); default format=docx
#   commercial_pdf — rasmiy PDF ustuvor (keyin Aspose/bulut backend qatlami); default format=pdf
#   html_weasyprint — HTML+WeasyPrint migratsiyasi (kelajak); hozircha default format=pdf
CERTIFICATE_STRATEGY = env("CERTIFICATE_STRATEGY", default="docx_primary").strip().lower()
_strategy_default_cert_format = {
    "docx_primary": "docx",
    "commercial_pdf": "pdf",
    "html_weasyprint": "pdf",
}.get(CERTIFICATE_STRATEGY, "docx")
CERTIFICATE_DEFAULT_DOWNLOAD_FORMAT = env(
    "CERTIFICATE_DEFAULT_DOWNLOAD_FORMAT",
    default=_strategy_default_cert_format,
).strip().lower()
if CERTIFICATE_DEFAULT_DOWNLOAD_FORMAT not in ("docx", "pdf"):
    CERTIFICATE_DEFAULT_DOWNLOAD_FORMAT = "docx"

# File Upload Settings
DATA_UPLOAD_MAX_MEMORY_SIZE = 500 * 1024 * 1024  # 500MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 500 * 1024 * 1024  # 500MB
