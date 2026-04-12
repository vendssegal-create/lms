---
description: 
alwaysApply: true
---

# CLAUDE.md — Django LMS + HEMIS

## Project Overview

O'zbekiston oliy ta'lim muassasalari uchun **Learning Management System (LMS)**, **HEMIS** (Higher Education Management Information System) bilan integratsiyalashgan. Tizim talaba va o'qituvchilar uchun kurslar, testlar, topshiriqlar, baholar, qayta topshirish (retake) va sertifikatlarni boshqaradi.

---

## Architecture

**Hybrid SPA + Legacy** arxitekturasi:

```
Browser
  └── React 19 SPA (design/dist/) — asosiy UI
        ├── /api/          → Django REST API (JSON)
        └── /__legacy/     → Django template pages (iframe orqali embed)
```

- **React SPA** `design/dist/index.html` dan serve qilinadi
- **Legacy sahifalar** `/__legacy/*` prefix ostida, SPA ichida iframe orqali ko'rsatiladi
- **API** `/api/` prefix ostida, DRF orqali

---

## Apps

| App | Maqsad |
|-----|--------|
| `users` | Custom User, rollar, autentifikatsiya (HEMIS OAuth), StudentProfile, TeacherProfile, sidebar navigatsiya |
| `lms` | Kurslar, bo'limlar, resurslar, testlar, topshiriqlar, baholar, sertifikatlar, forum, uchrashuvlar, bildirishnomalar |
| `retake` | Qayta topshirish sikllari, arizalar, to'lovlar, guruhlar, imtihon jadvali, baholash |
| `hemis` | HEMIS API integratsiyasi: talaba/fan snapshot, o'quv reja, qarzlar, sync loglari |
| `messaging` | Ichki xabar almashish tizimi |
| `core` | Django settings, URL routing, middleware, SPA serving, Celery, WebSocket |

---

## Tech Stack

### Backend
- **Python 3.12**, **Django 5.1**
- **Django REST Framework** — API
- **Django Channels** — WebSocket
- **Celery + Redis** — background tasks (deadline bildirishnomalari, daily 8:00)
- **SQLite** (dev) — settings.py da boshqa DB ga o'tish oson
- Timezone: `Asia/Tashkent`, Language: `uz-uz`

### Frontend (`design/`)
- **React 19** + **TypeScript 5.8**
- **Vite 6.2** (build tool)
- **Tailwind CSS 4.1**
- **React Router 7**
- **Lucide React** (ikonlar)
- Build output: `design/dist/` (Django static orqali serve)

### Key Python Packages
```
docxtpl        # Sertifikat DOCX shablonlari
qrcode[pil]    # Sertifikat QR kodlari
Pillow         # Rasm ishlov berish
docx2pdf       # DOCX → PDF (Windows/macOS, MS Word kerak)
```

---

## Development Setup

### Backend
```bash
cd "D:\LMS hemis\django_lms"
python -m venv venv
venv\Scripts\activate          # Windows

pip install -r requirements.txt

python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 8000
```

### Frontend
```bash
cd design
npm install
npm run dev        # Vite dev server: http://localhost:3000
npm run build      # Production build → design/dist/
```

### Celery (optional, deadline notifications uchun)
```bash
celery -A core worker -l info
celery -A core beat -l info
```

---

## Environment Variables (`.env`)

```env
DJANGO_SECRET_KEY=your-secret-key
DJANGO_DEBUG=True

# HEMIS API
HEMIS_REST_BASE_URL=https://student.bstu.uz/rest
HEMIS_BACKEND_API_TOKEN=...
HEMIS_OAUTH_CLIENT_ID=...
HEMIS_OAUTH_CLIENT_SECRET=...

# Redis / Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

---

## URL Structure

```
/api/auth/          # Login, profil, HEMIS OAuth
/api/lms/           # Kurslar, testlar, topshiriqlar, sertifikatlar
/api/retake/        # Qayta topshirish
/api/messages/      # Xabarlar

/__legacy/lms/      # Legacy LMS template sahifalari
/__legacy/retake/   # Legacy retake sahifalari
/__legacy/auth/     # Login/logout

/admin/             # Django admin panel
/*                  # → React SPA (catch-all)
```

---

## User Roles

`users/utils/roles.py` da aniqlanadi:

| Rol | Vakolat |
|-----|---------|
| `SUPER_ADMIN` | To'liq kirish, foydalanuvchi boshqaruvi |
| `TEACHER` | Kurslar, testlar, topshiriqlar yaratish/baholash |
| `STUDENT` | Kurslar ko'rish, testlar topshirish, ariza berish |
| `ACADEMIC_BOARD` | Qayta topshirish arizalarini tasdiqlash |
| `DIRECTION` | Yo'nalish bo'yicha ko'rish |
| `REGISTRATOR` | Retake guruhlar, jadval, baholash |
| `RET_TEACHER` | Retake imtihon o'qituvchisi |
| `RET_STUDENT` | Retake talabasi (read-only) |
| `RET_ADMIN` | Retake administrator |

---

## Coding Patterns

### API Views (Function-Based Views)
```python
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

@require_http_methods(["GET"])
def my_view(request):
    # Role check decorators:
    # @_require_super_admin
    # @_require_staff_like  (teacher, admin)
    return JsonResponse({"data": ...})
```

### Role Decorators
```python
# users/utils/roles.py
from users.utils.roles import _require_super_admin, _require_staff_like
```

### Request/Response Helpers
Barcha API viewlarda standart JSON pattern:
```python
{"success": True, "data": {...}}
{"success": False, "error": "message"}
```

### Models
- `ForeignKey` bilan `related_name` doim belgilanadi
- Status fieldlari `TextChoices` bilan (masalan `RetakeApplication.Status`)
- Vaqt fieldlari: `created_at`, `updated_at` (auto)

---

## HEMIS Integration

`hemis/` app — HEMIS API bilan barcha aloqa shu yerda:
- `hemis/utils/client.py` — HTTP client (token autentifikatsiya)
- `hemis/services.py` — sync logikasi (talabalar, fanlar, qarzlar)
- `hemis/models.py` — local cache snapshot modellari

**OAuth flow**: `/__legacy/auth/hemis/start/` → HEMIS → `/__legacy/auth/hemis/callback/`

**Sync**: Admin panel yoki retake sync sahifasidan ishga tushiriladi.

---

## Certificate System

`lms/services/certificate_service.py`:

1. **DOCX shablon** (`CertificateTemplate`) — `docxtpl` bilan to'ldiriladi
2. **PDF konversiya** (ustuvorlik tartibi):
   - LibreOffice `soffice` — server muhiti
   - `docx2pdf` — Windows/macOS (MS Word kerak)
3. **QR kod** — `qrcode` kutubxonasi, `UserCertificate` modelida saqlanadi
4. **Tekshirish URL**: `/lms/certificates/verify/<uuid>/`

---

## Important Constraints

- `X_FRAME_OPTIONS = "SAMEORIGIN"` — legacy sahifalar SPA ichida iframe'da ishlashi uchun
- `CORS_ALLOW_ALL_ORIGINS = True` (dev). Production uchun aniq domenlar ko'rsatiladi
- Fayl yuklash limiti: **500MB** (`DATA_UPLOAD_MAX_MEMORY_SIZE`)
- Media fayllar: `media/` papkasida saqlanadi
- Logging: console + `django_error.log`

---

## Key Files Reference

```
core/settings.py              # Barcha konfiguratsiya
core/urls.py                  # URL routing
core/middleware.py            # LegacyEmbedRedirectMiddleware
users/models.py               # User, StudentProfile, TeacherProfile, SidebarMenu
users/utils/roles.py          # Rol konstantalari va dekoratorlar
lms/models.py                 # Course, Section, Test, Assignment, Gradebook, Certificate
lms/api_views.py              # LMS REST API
retake/models.py              # RetakeCycle, RetakeApplication, SubjectGroup, ExamSheet
retake/api_views.py           # Retake REST API
hemis/services.py             # HEMIS sync logikasi
hemis/utils/client.py         # HEMIS HTTP client
design/src/                   # React komponentlar
design/vite.config.ts         # Vite konfiguratsiyasi
```
