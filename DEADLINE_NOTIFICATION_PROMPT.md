# 🔔 Smart Deadline Alert & Extension Request System — Senior Fullstack Prompt

## Loyiha konteksti

**Stack:** Django 5 + Django REST Framework · React 18 + TypeScript + Vite · Tailwind CSS v4 · Framer Motion · Lucide React · Django Channels (WebSocket) · Celery + Redis

**Mavjud modellar:**
- `lms/models.py` → `Course`, `Enrollment`, `Assignment` (deadline: DateTimeField), `Notification`, `Section`, `Test`
- `Notification` modeli: `user, title, message, link, is_read, created_at`
- `design/src/features/auth/auth-context.tsx` → `session.notifications.unread_count`
- `design/src/components/layout/app-shell.tsx` → Bell badge (`session.notifications.unread_count`)
- `design/src/pages/NotificationsPage.tsx` → ro'yxat sahifasi
- `lms/views/notifications.py` → `api_notifications()`, `api_notif_read()`
- `lms/api_views.py` → mavjud API views (2856 qator, monolitik)

---

## 🎯 Maqsad

Talaba LMS tizimiga login qilib, har qanday sahifaga kirganida:

1. **Yangi kursga qo'shilgan** bo'lsa — modal chiqadi (so'nggi 24 soat ichida Enrollment yaratilgan)  
2. **Topshiriq muddati 3 kun yoki kamroq qolgan** bo'lsa — modal chiqadi (deadline approaching alert)  
3. **Topshiriq muddati o'tib ketgan** bo'lsa — talaba admin ga muddat uzaytirish so'rovi yuboradi  
4. **Admin so'rovni tasdiqlasa** — yangi muddat biriktiriladi, talaba xabardor qilinadi  
5. **Barcha bildirish nomalari** — toast + bell badge + full page, animatsiyali, LMS standartiga mos

---

## 📁 QADAM 1 — Backend: Yangi modellar

### `lms/models.py` ga qo'shing:

```python
class NotificationType(models.TextChoices):
    COURSE_ENROLLED   = "course_enrolled",   "Kursga qo'shildi"
    DEADLINE_WARNING  = "deadline_warning",  "Muddat yaqinlashmoqda"
    DEADLINE_OVERDUE  = "deadline_overdue",  "Muddat o'tib ketdi"
    DEADLINE_EXTENDED = "deadline_extended", "Muddat uzaytirildi"
    EXTENSION_APPROVED= "extension_approved","So'rov tasdiqlandi"
    EXTENSION_REJECTED= "extension_rejected","So'rov rad etildi"
    SYSTEM            = "system",            "Tizim xabari"

class Notification(models.Model):
    """Extend existing Notification model with these new fields."""
    # Existing: user, title, message, link, is_read, created_at
    notif_type  = models.CharField(
        max_length=32,
        choices=NotificationType.choices,
        default=NotificationType.SYSTEM,
        db_index=True,
    )
    priority    = models.CharField(
        max_length=8,
        choices=[("low","Low"),("medium","Medium"),("high","High"),("urgent","Urgent")],
        default="medium",
    )
    meta        = models.JSONField(default=dict, blank=True)
    # meta examples:
    # {"course_id": 5, "course_title": "Python kursi"}
    # {"assignment_id": 12, "assignment_title": "Lab 3", "days_left": 2, "deadline": "2026-04-15T23:59"}
    # {"request_id": 7, "new_deadline": "2026-04-20T23:59"}
    expires_at  = models.DateTimeField(null=True, blank=True)  # auto-dismiss modal after this
    is_dismissed= models.BooleanField(default=False)           # user dismissed modal

    class Meta:
        ordering = ['-created_at']
        indexes  = [models.Index(fields=['user','is_read','created_at'])]


class DeadlineExtensionRequest(models.Model):
    """Student requests deadline extension for a specific assignment."""

    class Status(models.TextChoices):
        PENDING  = "pending",  "Kutilmoqda"
        APPROVED = "approved", "Tasdiqlandi"
        REJECTED = "rejected", "Rad etildi"

    student       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                      related_name='extension_requests')
    assignment    = models.ForeignKey('Assignment', on_delete=models.CASCADE,
                                      related_name='extension_requests')
    reason        = models.TextField(help_text="Talaba sababi")
    requested_deadline = models.DateTimeField(help_text="Talaba so'ragan yangi muddat")
    status        = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING,
                                     db_index=True)
    admin_note    = models.TextField(blank=True, default="")
    approved_deadline = models.DateTimeField(null=True, blank=True,
                                              help_text="Admin tasdiqlagan yangi muddat")
    reviewed_by   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                      null=True, blank=True, related_name='reviewed_extensions')
    created_at    = models.DateTimeField(auto_now_add=True)
    reviewed_at   = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('student', 'assignment')   # 1 ta aktiv so'rov
        ordering        = ['-created_at']


class AssignmentStudentDeadline(models.Model):
    """Per-student custom deadline (set by admin after approval)."""
    student    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                   related_name='custom_deadlines')
    assignment = models.ForeignKey('Assignment', on_delete=models.CASCADE,
                                   related_name='custom_deadlines')
    deadline   = models.DateTimeField()
    set_by     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                   null=True, blank=True, related_name='set_deadlines')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('student', 'assignment')
```

---

## 📁 QADAM 2 — Backend: Notification Service

### Yangi fayl: `lms/services/notification_service.py`

```python
"""Centralized notification creation & modal-alert helpers."""
from django.utils import timezone
from datetime import timedelta
from lms.models import Notification, NotificationType, Enrollment, Assignment, AssignmentStudentDeadline


def _create(user, title, message, notif_type, priority="medium",
            link=None, meta=None, expires_hours=None):
    """Single factory for all notifications."""
    expires_at = None
    if expires_hours:
        expires_at = timezone.now() + timedelta(hours=expires_hours)
    return Notification.objects.create(
        user=user, title=title, message=message,
        notif_type=notif_type, priority=priority,
        link=link, meta=meta or {}, expires_at=expires_at,
    )


def notify_course_enrolled(enrollment: Enrollment):
    """Called when student is added to a course (signal or view)."""
    _create(
        user      = enrollment.student,
        title     = f"🎓 Yangi kursga qo'shildingiz!",
        message   = f"«{enrollment.course.title}» kursiga muvaffaqiyatli ro'yxatdan o'tdingiz.",
        notif_type= NotificationType.COURSE_ENROLLED,
        priority  = "high",
        link      = f"/courses/{enrollment.course.id}",
        meta      = {"course_id": enrollment.course.id,
                     "course_title": enrollment.course.title},
        expires_hours = 48,   # modal 2 kun ko'rinadi, so'ng avtomatik yoqilmaydi
    )


def notify_deadline_warning(user, assignment: Assignment, days_left: int,
                             custom_deadline=None):
    """Deadline ≤ 3 days. Skip if notification already sent today."""
    deadline = custom_deadline or assignment.deadline
    already_sent = Notification.objects.filter(
        user=user,
        notif_type=NotificationType.DEADLINE_WARNING,
        meta__assignment_id=assignment.id,
        created_at__gte=timezone.now() - timedelta(hours=20),
    ).exists()
    if already_sent:
        return
    priority = "urgent" if days_left == 0 else ("high" if days_left <= 1 else "medium")
    label    = "Bugun!" if days_left == 0 else f"{days_left} kun qoldi"
    _create(
        user      = user,
        title     = f"⏰ Muddat yaqinlashmoqda — {label}",
        message   = f"«{assignment.title}» topshirig'i muddati tugaydi: {deadline.strftime('%d.%m.%Y %H:%M')}",
        notif_type= NotificationType.DEADLINE_WARNING,
        priority  = priority,
        link      = f"/assignments/{assignment.id}",
        meta      = {
            "assignment_id"   : assignment.id,
            "assignment_title": assignment.title,
            "course_id"       : assignment.course_id,
            "days_left"       : days_left,
            "deadline"        : deadline.isoformat(),
        },
        expires_hours = 24,
    )


def notify_extension_result(request_obj, approved: bool):
    """Admin tasdiqladi/rad etdi — studentga xabar."""
    assignment = request_obj.assignment
    if approved:
        new_dl = request_obj.approved_deadline.strftime('%d.%m.%Y %H:%M')
        _create(
            user      = request_obj.student,
            title     = "✅ Muddat uzaytirish tasdiqlandi",
            message   = f"«{assignment.title}» topshirig'i uchun yangi muddat: {new_dl}",
            notif_type= NotificationType.EXTENSION_APPROVED,
            priority  = "high",
            link      = f"/assignments/{assignment.id}",
            meta      = {
                "assignment_id"   : assignment.id,
                "assignment_title": assignment.title,
                "new_deadline"    : request_obj.approved_deadline.isoformat(),
            },
            expires_hours = 72,
        )
    else:
        _create(
            user      = request_obj.student,
            title     = "❌ Muddat uzaytirish rad etildi",
            message   = f"«{assignment.title}» uchun so'rovingiz rad etildi."
                        + (f" Sabab: {request_obj.admin_note}" if request_obj.admin_note else ""),
            notif_type= NotificationType.EXTENSION_REJECTED,
            priority  = "medium",
            link      = f"/assignments/{assignment.id}",
            meta      = {"assignment_id": assignment.id},
        )
```

---

## 📁 QADAM 3 — Backend: Celery Task (har kuni tekshirish)

### `lms/tasks.py` ga qo'shing:

```python
from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from lms.models import Assignment, Enrollment, AssignmentStudentDeadline
from lms.services.notification_service import notify_deadline_warning


@shared_task(name="lms.check_approaching_deadlines")
def check_approaching_deadlines():
    """
    Har kuni bir marta ishga tushadi (crontab: 0 8 * * *).
    Deadline ≤ 3 kun qolgan barcha (student, assignment) juftliklar uchun
    deadline_warning notification yaratadi.
    """
    now = timezone.now()
    threshold = now + timedelta(days=3)

    # Aktiv assignmentlar (muddat hali o'tmagan yoki bugun)
    assignments = Assignment.objects.filter(
        is_active=True,
        deadline__gte=now,
        deadline__lte=threshold,
    ).select_related('course')

    for assignment in assignments:
        # Bu kursga yozilgan talabalar
        enrollments = Enrollment.objects.filter(
            course=assignment.course
        ).select_related('student')

        for enr in enrollments:
            # Talaba uchun custom deadline bormi?
            try:
                custom = AssignmentStudentDeadline.objects.get(
                    student=enr.student, assignment=assignment
                )
                deadline = custom.deadline
                if deadline < now:
                    continue   # custom deadline o'tib ketgan
            except AssignmentStudentDeadline.DoesNotExist:
                deadline = assignment.deadline

            days_left = (deadline - now).days
            notify_deadline_warning(enr.student, assignment, days_left, deadline)

    return f"Checked {assignments.count()} assignments"
```

### `core/celery.py` yoki `settings.py` ga crontab qo'shing:

```python
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    "check-approaching-deadlines": {
        "task"    : "lms.check_approaching_deadlines",
        "schedule": crontab(hour=8, minute=0),   # har kuni ertalab 8:00
    },
}
```

---

## 📁 QADAM 4 — Backend: Login Modal API endpoint

### `lms/api_views.py` ga qo'shing:

```python
@login_required_api
def api_login_alerts(request):
    """
    GET /api/lms/login-alerts/
    Foydalanuvchi login qilganda frontend buni bir marta chaqiradi.
    Modal uchun kerakli alertlarni qaytaradi va is_dismissed=True qiladi.
    """
    now = timezone.now()

    # 1) Hali dismiss qilinmagan, muddati o'tmagan yuqori prioritetli notiflar
    alerts = Notification.objects.filter(
        user       = request.user,
        is_dismissed=False,
        priority__in=["high", "urgent"],
    ).filter(
        models.Q(expires_at__isnull=True) | models.Q(expires_at__gte=now)
    ).order_by('-created_at')[:10]

    data = []
    ids_to_dismiss = []

    for n in alerts:
        data.append({
            "id"        : n.id,
            "type"      : n.notif_type,
            "priority"  : n.priority,
            "title"     : n.title,
            "message"   : n.message,
            "link"      : n.link,
            "meta"      : n.meta,
            "created_at": n.created_at.isoformat(),
        })
        ids_to_dismiss.append(n.id)

    # Modal ko'rsatildi — dismiss qil (takroran chiqmasin)
    Notification.objects.filter(id__in=ids_to_dismiss).update(is_dismissed=True)

    return JsonResponse({"alerts": data, "count": len(data)})
```

### `lms/api_urls.py` ga qo'shing:

```python
path("login-alerts/",               views.api_login_alerts,               name="api_login_alerts"),
```

---

## 📁 QADAM 5 — Backend: Extension Request API

### `lms/api_views.py` ga qo'shing:

```python
# ─── STUDENT: muddat uzaytirish so'rovi ─────────────────────────────────────

@login_required_api
@require_POST
def api_extension_request_create(request, assignment_id):
    """POST /api/lms/assignments/<id>/extension-request/"""
    assignment = get_object_or_404(Assignment, id=assignment_id)

    # Faqat muddati o'tgan topshiriqlar uchun
    if assignment.deadline and assignment.deadline > timezone.now():
        return JsonResponse({"error": "Muddat hali o'tmagan."}, status=400)

    # Avvalgi pending so'rov bor bo'lsa
    existing = DeadlineExtensionRequest.objects.filter(
        student=request.user, assignment=assignment, status="pending"
    ).first()
    if existing:
        return JsonResponse({"error": "Sizning so'rovingiz ko'rib chiqilmoqda."}, status=400)

    data = json.loads(request.body)
    reason             = data.get("reason", "").strip()
    requested_deadline = data.get("requested_deadline")   # ISO string

    if not reason:
        return JsonResponse({"error": "Sabab ko'rsating."}, status=400)
    if not requested_deadline:
        return JsonResponse({"error": "Yangi muddat sanasini kiriting."}, status=400)

    try:
        req_dl = datetime.fromisoformat(requested_deadline)
        if timezone.is_naive(req_dl):
            req_dl = timezone.make_aware(req_dl)
    except ValueError:
        return JsonResponse({"error": "Sana formati noto'g'ri."}, status=400)

    ext_req = DeadlineExtensionRequest.objects.create(
        student            = request.user,
        assignment         = assignment,
        reason             = reason,
        requested_deadline = req_dl,
    )

    # Adminlarga xabar
    _notify_admins_extension_request(ext_req)

    return JsonResponse({"success": True, "request_id": ext_req.id})


def _notify_admins_extension_request(ext_req):
    """Barcha admin va teacher larga bildirishnoma."""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    admins = User.objects.filter(
        models.Q(groups__name__in=["admin", "teacher"]) |
        models.Q(is_staff=True)
    ).distinct()

    for admin in admins:
        Notification.objects.create(
            user       = admin,
            title      = f"📋 Muddat uzaytirish so'rovi",
            message    = (f"{ext_req.student.get_full_name()} → "
                          f"«{ext_req.assignment.title}» — so'rov yuborildi."),
            notif_type = NotificationType.SYSTEM,
            priority   = "medium",
            link       = f"/admin/extension-requests/{ext_req.id}",
            meta       = {
                "request_id"      : ext_req.id,
                "student_name"    : ext_req.student.get_full_name(),
                "assignment_id"   : ext_req.assignment.id,
                "assignment_title": ext_req.assignment.title,
            },
        )


# ─── ADMIN: so'rovni ko'rish va tasdiqlash ───────────────────────────────────

@login_required_api
@require_role(["admin", "teacher", "staff"])
def api_extension_requests_list(request):
    """GET /api/lms/admin/extension-requests/  — pending so'rovlar"""
    status_filter = request.GET.get("status", "pending")
    qs = DeadlineExtensionRequest.objects.filter(
        status=status_filter
    ).select_related('student', 'assignment', 'assignment__course').order_by('-created_at')

    return JsonResponse({
        "requests": [_serialize_extension_request(r) for r in qs]
    })


@login_required_api
@require_role(["admin", "teacher", "staff"])
@require_POST
def api_extension_request_review(request, request_id):
    """POST /api/lms/admin/extension-requests/<id>/review/"""
    ext_req = get_object_or_404(DeadlineExtensionRequest, id=request_id)

    if ext_req.status != "pending":
        return JsonResponse({"error": "So'rov allaqachon ko'rib chiqilgan."}, status=400)

    data       = json.loads(request.body)
    action     = data.get("action")          # "approve" | "reject"
    admin_note = data.get("admin_note", "").strip()
    new_deadline_str = data.get("new_deadline")   # ISO — only for approve

    if action == "approve":
        if not new_deadline_str:
            return JsonResponse({"error": "Yangi muddat kiriting."}, status=400)
        try:
            new_deadline = datetime.fromisoformat(new_deadline_str)
            if timezone.is_naive(new_deadline):
                new_deadline = timezone.make_aware(new_deadline)
        except ValueError:
            return JsonResponse({"error": "Sana formati noto'g'ri."}, status=400)

        ext_req.status           = "approved"
        ext_req.approved_deadline= new_deadline
        ext_req.admin_note       = admin_note
        ext_req.reviewed_by      = request.user
        ext_req.reviewed_at      = timezone.now()
        ext_req.save()

        # Talaba uchun individual deadline yaratish
        AssignmentStudentDeadline.objects.update_or_create(
            student=ext_req.student, assignment=ext_req.assignment,
            defaults={"deadline": new_deadline, "set_by": request.user},
        )
        notify_extension_result(ext_req, approved=True)

    elif action == "reject":
        ext_req.status     = "rejected"
        ext_req.admin_note = admin_note
        ext_req.reviewed_by= request.user
        ext_req.reviewed_at= timezone.now()
        ext_req.save()
        notify_extension_result(ext_req, approved=False)

    else:
        return JsonResponse({"error": "action noto'g'ri."}, status=400)

    return JsonResponse({"success": True, "status": ext_req.status})


def _serialize_extension_request(r):
    return {
        "id"                : r.id,
        "student_name"      : r.student.get_full_name(),
        "student_id"        : r.student.id,
        "assignment_id"     : r.assignment.id,
        "assignment_title"  : r.assignment.title,
        "course_title"      : r.assignment.course.title,
        "original_deadline" : r.assignment.deadline.isoformat() if r.assignment.deadline else None,
        "requested_deadline": r.requested_deadline.isoformat(),
        "approved_deadline" : r.approved_deadline.isoformat() if r.approved_deadline else None,
        "reason"            : r.reason,
        "admin_note"        : r.admin_note,
        "status"            : r.status,
        "created_at"        : r.created_at.isoformat(),
        "reviewed_at"       : r.reviewed_at.isoformat() if r.reviewed_at else None,
    }
```

### `lms/api_urls.py` ga qo'shing:

```python
path("assignments/<int:assignment_id>/extension-request/",  views.api_extension_request_create,   name="api_extension_request_create"),
path("admin/extension-requests/",                           views.api_extension_requests_list,     name="api_extension_requests_list"),
path("admin/extension-requests/<int:request_id>/review/",   views.api_extension_request_review,   name="api_extension_request_review"),
```

---

## 📁 QADAM 6 — Django Signals (auto-notify enrollment)

### `lms/signals.py` (yangi fayl):

```python
from django.db.models.signals import post_save
from django.dispatch import receiver
from lms.models import Enrollment
from lms.services.notification_service import notify_course_enrolled


@receiver(post_save, sender=Enrollment)
def on_enrollment_created(sender, instance, created, **kwargs):
    if created:
        notify_course_enrolled(instance)
```

### `lms/apps.py`:

```python
class LmsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "lms"

    def ready(self):
        import lms.signals  # noqa: F401
```

---

## 📁 QADAM 7 — Frontend: TypeScript types

### `design/src/types.ts` ga qo'shing:

```typescript
// ── Notification types ────────────────────────────────────────────────────
export type NotifType =
  | 'course_enrolled'
  | 'deadline_warning'
  | 'deadline_overdue'
  | 'deadline_extended'
  | 'extension_approved'
  | 'extension_rejected'
  | 'system';

export type NotifPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface LoginAlert {
  id: number;
  type: NotifType;
  priority: NotifPriority;
  title: string;
  message: string;
  link: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

// ── Extension Request ─────────────────────────────────────────────────────
export interface ExtensionRequest {
  id: number;
  student_name: string;
  student_id: number;
  assignment_id: number;
  assignment_title: string;
  course_title: string;
  original_deadline: string | null;
  requested_deadline: string;
  approved_deadline: string | null;
  reason: string;
  admin_note: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at: string | null;
}
```

---

## 📁 QADAM 8 — Frontend: API layer

### `design/src/api/lms.ts` ga qo'shing:

```typescript
export async function fetchLoginAlerts(): Promise<{ alerts: LoginAlert[]; count: number }> {
  const res = await apiFetch('/api/lms/login-alerts/');
  if (!res.ok) throw new Error('Login alerts yuklanmadi');
  return res.json();
}

export async function createExtensionRequest(
  assignmentId: number,
  payload: { reason: string; requested_deadline: string }
): Promise<{ success: boolean; request_id: number }> {
  const res = await apiFetch(`/api/lms/assignments/${assignmentId}/extension-request/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'So\'rov yuborilmadi');
  }
  return res.json();
}

export async function fetchExtensionRequests(status = 'pending'): Promise<ExtensionRequest[]> {
  const res = await apiFetch(`/api/lms/admin/extension-requests/?status=${status}`);
  if (!res.ok) throw new Error('So\'rovlar yuklanmadi');
  const data = await res.json();
  return data.requests;
}

export async function reviewExtensionRequest(
  requestId: number,
  payload: { action: 'approve' | 'reject'; admin_note?: string; new_deadline?: string }
): Promise<{ success: boolean; status: string }> {
  const res = await apiFetch(`/api/lms/admin/extension-requests/${requestId}/review/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Amal bajarilmadi');
  }
  return res.json();
}
```

---

## 📁 QADAM 9 — Frontend: LoginAlertModal komponenti

### Yangi fayl: `design/src/components/notifications/LoginAlertModal.tsx`

```tsx
/**
 * LoginAlertModal
 * ─────────────────────────────────────────────────────────────────────────────
 * Talaba login qilgandan so'ng birinchi sahifaga kirganida chiqadi.
 * Bir sessionda faqat bir marta: sessionStorage flag orqali nazorat qilinadi.
 *
 * Dizayn: glassmorphism backdrop + slide-up card + staggered alert items
 * Animation: Framer Motion
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, Bell, BookOpen, CheckCircle2, Clock,
  ExternalLink, X, XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchLoginAlerts } from '@/src/api/lms';
import type { LoginAlert, NotifType } from '@/src/types';

const SESSION_KEY = 'lms.login_alerts_shown';

// ── Icon & colour per notification type ─────────────────────────────────────
function alertMeta(type: NotifType, priority: string) {
  const urgent = priority === 'urgent';
  switch (type) {
    case 'course_enrolled':
      return { Icon: BookOpen,      colour: 'text-primary',      bg: 'bg-primary/10',      label: 'Yangi kurs'     };
    case 'deadline_warning':
      return { Icon: Clock,         colour: urgent ? 'text-rose-500' : 'text-amber-500',
               bg: urgent ? 'bg-rose-50' : 'bg-amber-50',                                  label: 'Muddat yaqin'   };
    case 'deadline_overdue':
      return { Icon: AlertTriangle, colour: 'text-rose-600',     bg: 'bg-rose-50',          label: 'Muddat o\'tdi' };
    case 'extension_approved':
      return { Icon: CheckCircle2,  colour: 'text-emerald-600',  bg: 'bg-emerald-50',        label: 'Tasdiqlandi'    };
    case 'extension_rejected':
      return { Icon: XCircle,       colour: 'text-rose-500',     bg: 'bg-rose-50',           label: 'Rad etildi'     };
    default:
      return { Icon: Bell,          colour: 'text-primary',      bg: 'bg-primary/10',        label: 'Xabar'          };
  }
}

// ── Single alert card ────────────────────────────────────────────────────────
function AlertCard({ alert, index }: { alert: LoginAlert; index: number }) {
  const { Icon, colour, bg, label } = alertMeta(alert.type, alert.priority);
  const isUrgent = alert.priority === 'urgent';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0,  scale: 1     }}
      transition={{ duration: 0.3, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className={`flex items-start gap-4 rounded-2xl border p-4 ${bg} ${
        isUrgent ? 'border-rose-200 ring-1 ring-rose-200/60' : 'border-border/50'
      }`}
    >
      {/* Pulse ring for urgent */}
      <div className="relative mt-0.5 flex-shrink-0">
        {isUrgent && (
          <span className="absolute inset-0 animate-ping rounded-full bg-rose-400 opacity-30" />
        )}
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg}`}>
          <Icon className={`${colour}`} size={18} />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`label-micro rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${bg} ${colour}`}>
            {label}
          </span>
          {isUrgent && (
            <span className="label-micro rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600">
              Shoshilinch
            </span>
          )}
        </div>
        <p className="mt-1.5 text-sm font-bold text-text-primary leading-snug">{alert.title}</p>
        <p className="mt-1 text-xs font-medium leading-relaxed text-text-secondary">{alert.message}</p>
      </div>

      {alert.link && (
        <Link
          to={alert.link}
          className="flex-shrink-0 mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white text-text-secondary hover:bg-slate-50 hover:text-primary transition-colors"
        >
          <ExternalLink size={14} />
        </Link>
      )}
    </motion.div>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────────
export function LoginAlertModal() {
  const [alerts, setAlerts] = useState<LoginAlert[]>([]);
  const [open,   setOpen  ] = useState(false);

  useEffect(() => {
    // Session başına bir marta
    if (sessionStorage.getItem(SESSION_KEY)) return;

    fetchLoginAlerts()
      .then(({ alerts }) => {
        if (alerts.length === 0) return;
        sessionStorage.setItem(SESSION_KEY, '1');
        setAlerts(alerts);
        // Kichik kechikish — sahifa to'liq render bo'lgandan keyin
        setTimeout(() => setOpen(true), 600);
      })
      .catch(() => {/* silent fail */});
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const urgentCount = alerts.filter((a) => a.priority === 'urgent' || a.priority === 'high').length;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* ── Glassmorphism backdrop ── */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-sm"
            onClick={close}
          />

          {/* ── Modal card ── */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-1/2 top-1/2 z-[91] w-full max-w-lg -translate-x-1/2 -translate-y-1/2
                       rounded-3xl border border-border bg-white shadow-[0_32px_80px_rgba(0,0,0,0.18)] p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="alert-modal-title"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* Animated bell */}
                <motion.div
                  animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
                  transition={{ duration: 0.7, delay: 0.5 }}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10"
                >
                  <Bell className="text-primary" size={22} />
                </motion.div>
                <div>
                  <h2 id="alert-modal-title" className="text-lg font-black text-text-primary">
                    Xush kelibsiz! 👋
                  </h2>
                  <p className="text-xs font-medium text-text-secondary">
                    {urgentCount > 0
                      ? `${urgentCount} ta shoshilinch xabaringiz bor`
                      : `${alerts.length} ta yangi bildirishnoma`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl
                           border border-border bg-white text-text-secondary transition-colors
                           hover:bg-slate-50 hover:text-text-primary"
                aria-label="Yopish"
              >
                <X size={16} />
              </button>
            </div>

            {/* Divider */}
            <div className="my-4 h-px bg-border/60" />

            {/* Alerts list — scrollable if many */}
            <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1
                            [&::-webkit-scrollbar]:w-1.5
                            [&::-webkit-scrollbar-thumb]:rounded-full
                            [&::-webkit-scrollbar-thumb]:bg-border">
              {alerts.map((alert, i) => (
                <AlertCard key={alert.id} alert={alert} index={i} />
              ))}
            </div>

            {/* Footer */}
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Link
                to="/notifications"
                onClick={close}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border
                           border-border bg-white px-4 py-3 text-sm font-bold text-text-primary
                           transition-colors hover:bg-slate-50"
              >
                <Bell size={15} />
                Barcha bildirish nomalari
              </Link>
              <button
                type="button"
                onClick={close}
                className="btn btn-primary flex-1 sm:flex-none"
              >
                Tushunarli, davom etish
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

---

## 📁 QADAM 10 — Frontend: Toast Notification System

### Yangi fayl: `design/src/components/notifications/ToastProvider.tsx`

```tsx
/**
 * ToastProvider — global animated toast stack
 * Ishlatish: useToast() hook orqali istalgan joydan chaqiriladi
 *
 * Joylashuv: top-right corner
 * Animatsiya: slide-in-right + auto-dismiss (5 soniya)
 * Stack: max 5 ta bir vaqtda
 */
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Bell, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useId, useState } from 'react';
import type { ReactNode } from 'react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error:   (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info:    (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const ICONS: Record<ToastVariant, typeof Bell> = {
  success: CheckCircle2,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
};

const STYLES: Record<ToastVariant, { bg: string; icon: string; border: string }> = {
  success: { bg: 'bg-white', icon: 'text-emerald-500', border: 'border-emerald-200' },
  error:   { bg: 'bg-white', icon: 'text-rose-500',    border: 'border-rose-200'    },
  warning: { bg: 'bg-white', icon: 'text-amber-500',   border: 'border-amber-200'   },
  info:    { bg: 'bg-white', icon: 'text-primary',     border: 'border-primary/30'  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const { bg, icon, border } = STYLES[toast.variant];
  const Icon = ICONS[toast.variant];
  const duration = toast.duration ?? 5000;

  // Auto-dismiss
  useState(() => {
    const t = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(t);
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.9 }}
      animate={{ opacity: 1, x: 0,  scale: 1   }}
      exit={{ opacity: 0, x: 60, scale: 0.9 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`flex w-80 items-start gap-3 rounded-2xl border ${border} ${bg}
                  p-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)]`}
      role="alert"
    >
      {/* Progress bar */}
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: duration / 1000, ease: 'linear' }}
        style={{ transformOrigin: 'left' }}
        className={`absolute bottom-0 left-0 h-0.5 w-full rounded-b-2xl ${
          toast.variant === 'success' ? 'bg-emerald-400'
          : toast.variant === 'error' ? 'bg-rose-400'
          : toast.variant === 'warning' ? 'bg-amber-400'
          : 'bg-primary'
        }`}
      />
      <Icon className={`mt-0.5 flex-shrink-0 ${icon}`} size={18} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-text-primary leading-snug">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs font-medium text-text-secondary">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 rounded-lg p-1 text-text-secondary hover:bg-slate-100 transition-colors"
        aria-label="Yopish"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const prefix = useId();

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev.slice(-4), { ...opts, id }]);  // max 5
  }, [prefix]);

  const success = useCallback((title: string, desc?: string) =>
    toast({ variant: 'success', title, description: desc }), [toast]);
  const error   = useCallback((title: string, desc?: string) =>
    toast({ variant: 'error',   title, description: desc }), [toast]);
  const warning = useCallback((title: string, desc?: string) =>
    toast({ variant: 'warning', title, description: desc }), [toast]);
  const info    = useCallback((title: string, desc?: string) =>
    toast({ variant: 'info',    title, description: desc }), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      {/* Toast stack — fixed top-right */}
      <div className="fixed right-4 top-24 z-[100] flex flex-col gap-3" aria-live="polite">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
```

---

## 📁 QADAM 11 — Frontend: Enhanced Notification Bell (AppShell)

### `design/src/components/layout/app-shell.tsx` — Bell tugmasini yangilang:

```tsx
// AppShell ichida Bell dropdown komponenti

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { fetchNotifications, markNotificationRead } from '@/src/api/lms';

function NotificationBell({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Awaited<ReturnType<typeof fetchNotifications>>['items']>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click-outside close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Load notifications on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchNotifications(1, 8).then((d) => {
      setItems(d.items);
      setLoading(false);
    });
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-2xl
                   border border-border bg-white shadow-premium text-text-secondary
                   transition-all hover:bg-slate-50 hover:text-primary"
        aria-label={`${count} ta bildirishnoma`}
      >
        <Bell size={18} />
        <AnimatePresence>
          {count > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center
                         rounded-full bg-rose-500 px-1 text-[10px] font-black text-white"
            >
              {count > 99 ? '99+' : count}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1    }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-border
                       bg-white shadow-[0_16px_48px_rgba(0,0,0,0.14)] overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-black text-text-primary">Bildirish nomalar</p>
              {count > 0 && (
                <span className="label-micro rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-500">
                  {count} yangi
                </span>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-secondary">
                  <span className="animate-spin">⏳</span> Yuklanmoqda...
                </div>
              ) : items.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-secondary">Bildirish noma yo'q</p>
              ) : (
                items.map((n, i) => (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`border-b border-border/50 px-4 py-3 last:border-0 ${
                      n.is_read ? 'opacity-60' : 'bg-primary/3'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.is_read && (
                        <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-text-primary leading-snug">{n.title}</p>
                        <p className="mt-0.5 text-[11px] font-medium text-text-secondary line-clamp-2">
                          {n.message}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            <div className="border-t border-border p-3">
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary/5 px-4 py-2.5
                           text-xs font-bold text-primary transition-colors hover:bg-primary/10"
              >
                Barchasini ko'rish <ExternalLink size={12} />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

---

## 📁 QADAM 12 — Frontend: DeadlineExtensionModal (Talaba uchun)

### Yangi fayl: `design/src/components/notifications/DeadlineExtensionModal.tsx`

```tsx
/**
 * AssignmentDetailPage da muddati o'tgan topshiriq uchun chiqadi.
 * Talaba sabab yozadi + so'ralgan yangi muddat kiritadi → so'rov yuboriladi.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, SendHorizonal, X } from 'lucide-react';
import { useState } from 'react';
import { createExtensionRequest } from '@/src/api/lms';
import { useToast } from '@/src/components/notifications/ToastProvider';

interface Props {
  open: boolean;
  assignmentId: number;
  assignmentTitle: string;
  originalDeadline: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeadlineExtensionModal({
  open, assignmentId, assignmentTitle, originalDeadline, onClose, onSuccess
}: Props) {
  const { success, error } = useToast();
  const [reason, setReason] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim() || !newDeadline) return;
    setLoading(true);
    try {
      await createExtensionRequest(assignmentId, {
        reason,
        requested_deadline: new Date(newDeadline).toISOString(),
      });
      success('So\'rov yuborildi', 'Admin ko\'rib chiqadi va sizga xabar beradi');
      onSuccess();
      onClose();
    } catch (err) {
      error('Xatolik', err instanceof Error ? err.message : 'So\'rov yuborilmadi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-1/2 top-1/2 z-[81] w-full max-w-md
                       -translate-x-1/2 -translate-y-1/2 rounded-3xl
                       border border-border bg-white p-6 shadow-[0_24px_72px_rgba(0,0,0,0.16)]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50">
                  <CalendarClock className="text-amber-500" size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-text-primary">Muddat uzaytirish</h3>
                  <p className="text-xs font-medium text-text-secondary">So'rov yuborish</p>
                </div>
              </div>
              <button type="button" onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-border
                           text-text-secondary hover:bg-slate-50 transition-colors">
                <X size={15} />
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-bold text-amber-700">{assignmentTitle}</p>
              <p className="text-[11px] font-medium text-amber-600 mt-0.5">
                Asl muddat: {new Date(originalDeadline).toLocaleString('uz-UZ')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="label-micro mb-2 block">Sabab *</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Muddat o'tib ketgani uchun sababingizni yozing..."
                  rows={3}
                  required
                  className="input w-full resize-none"
                />
              </div>
              <div>
                <label className="label-micro mb-2 block">So'ralgan yangi muddat *</label>
                <input
                  type="datetime-local"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  required
                  className="input w-full"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose}
                  className="flex-1 rounded-2xl border border-border bg-white px-4 py-3
                             text-sm font-bold text-text-primary hover:bg-slate-50 transition-colors">
                  Bekor qilish
                </button>
                <button type="submit" disabled={loading}
                  className="btn btn-primary flex-1 flex items-center justify-center gap-2">
                  {loading ? (
                    <span className="animate-spin text-lg">⏳</span>
                  ) : (
                    <><SendHorizonal size={15} /> Yuborish</>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

---

## 📁 QADAM 13 — Frontend: Admin Extension Requests Page

### Yangi fayl: `design/src/pages/AdminExtensionRequestsPage.tsx`

```tsx
/**
 * Admin panel — Muddat uzaytirish so'rovlari boshqaruvi
 * Route: /admin/extension-requests
 *
 * Tab'lar: Kutilmoqda | Tasdiqlangan | Rad etilgan
 * Har bir so'rovda: talaba ma'lumoti, topshiriq, sabab, yangi muddat + approve/reject form
 */
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarClock, CheckCircle2, Clock, RefreshCw, User, XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { fetchExtensionRequests, reviewExtensionRequest } from '@/src/api/lms';
import type { ExtensionRequest } from '@/src/types';
import { useToast } from '@/src/components/notifications/ToastProvider';

type TabStatus = 'pending' | 'approved' | 'rejected';

// ── Review form (inline inside card) ─────────────────────────────────────────
function ReviewForm({
  request,
  onDone,
}: {
  request: ExtensionRequest;
  onDone: () => void;
}) {
  const { success, error } = useToast();
  const [newDeadline, setNewDeadline] = useState('');
  const [adminNote,   setAdminNote  ] = useState('');
  const [loading,     setLoading    ] = useState(false);

  async function submit(action: 'approve' | 'reject') {
    if (action === 'approve' && !newDeadline) {
      error('Yangi muddat kiriting', '');
      return;
    }
    setLoading(true);
    try {
      await reviewExtensionRequest(request.id, {
        action,
        admin_note: adminNote,
        ...(action === 'approve' ? { new_deadline: new Date(newDeadline).toISOString() } : {}),
      });
      success(
        action === 'approve' ? 'Tasdiqlandi ✅' : 'Rad etildi ❌',
        `${request.student_name}ga xabar yuborildi`
      );
      onDone();
    } catch (err) {
      error('Xatolik', err instanceof Error ? err.message : 'Amal bajarilmadi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-4 space-y-3 border-t border-border pt-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label-micro mb-1 block">Yangi muddat (tasdiqlash uchun)</label>
          <input
            type="datetime-local"
            value={newDeadline}
            onChange={(e) => setNewDeadline(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            className="input w-full text-sm"
          />
        </div>
        <div>
          <label className="label-micro mb-1 block">Izoh (ixtiyoriy)</label>
          <input
            type="text"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="Talabaga eslatma..."
            className="input w-full text-sm"
          />
        </div>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={() => submit('approve')}
          className="btn btn-primary flex items-center gap-2 py-2.5 text-sm"
        >
          <CheckCircle2 size={15} /> Tasdiqlash
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => submit('reject')}
          className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50
                     px-4 py-2.5 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-100"
        >
          <XCircle size={15} /> Rad etish
        </button>
      </div>
    </motion.div>
  );
}

// ── Request card ──────────────────────────────────────────────────────────────
function RequestCard({
  request,
  showActions,
  onRefresh,
}: {
  request: ExtensionRequest;
  showActions: boolean;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="card p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Left */}
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="label-micro rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              {request.course_title}
            </span>
            {request.status === 'pending' && (
              <span className="label-micro rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                Kutilmoqda
              </span>
            )}
          </div>
          <p className="text-sm font-black text-text-primary">{request.assignment_title}</p>
          <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
            <User size={12} />
            <span>{request.student_name}</span>
          </div>
        </div>

        {/* Right — dates */}
        <div className="flex flex-shrink-0 flex-col gap-1 text-right text-xs font-medium">
          <div className="flex items-center justify-end gap-1 text-text-secondary">
            <Clock size={11} />
            <span>Asl: {request.original_deadline
              ? new Date(request.original_deadline).toLocaleString('uz-UZ') : '—'}</span>
          </div>
          <div className="flex items-center justify-end gap-1 text-amber-600">
            <CalendarClock size={11} />
            <span>So'rov: {new Date(request.requested_deadline).toLocaleString('uz-UZ')}</span>
          </div>
          {request.approved_deadline && (
            <div className="flex items-center justify-end gap-1 text-emerald-600">
              <CheckCircle2 size={11} />
              <span>Tasdiqlandi: {new Date(request.approved_deadline).toLocaleString('uz-UZ')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Sabab */}
      <div className="mt-3 rounded-xl bg-slate-50 p-3">
        <p className="text-xs font-bold text-text-secondary mb-0.5">Sabab:</p>
        <p className="text-xs font-medium text-text-primary">{request.reason}</p>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-bold text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {expanded ? 'Yig\'ish ↑' : 'Ko\'rib chiqish ↓'}
          </button>
          <AnimatePresence>
            {expanded && <ReviewForm request={request} onDone={() => { setExpanded(false); onRefresh(); }} />}
          </AnimatePresence>
        </div>
      )}

      {request.admin_note && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 border border-border">
          <p className="text-xs font-bold text-text-secondary">Admin izohi: {request.admin_note}</p>
        </div>
      )}
    </motion.div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AdminExtensionRequestsPage() {
  const [tab,      setTab     ] = useState<TabStatus>('pending');
  const [requests, setRequests] = useState<ExtensionRequest[]>([]);
  const [loading,  setLoading ] = useState(true);

  const load = useCallback(async (status: TabStatus) => {
    setLoading(true);
    try {
      setRequests(await fetchExtensionRequests(status));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(tab); }, [tab, load]);

  const TABS: { label: string; value: TabStatus; colour: string }[] = [
    { label: 'Kutilmoqda', value: 'pending',  colour: 'text-amber-600'   },
    { label: 'Tasdiqlangan', value: 'approved', colour: 'text-emerald-600' },
    { label: 'Rad etilgan', value: 'rejected', colour: 'text-rose-500'    },
  ];

  return (
    <div className="space-y-8">
      <section className="card p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-text-primary">
              Muddat uzaytirish so'rovlari
            </h2>
            <p className="mt-1 text-sm font-medium text-text-secondary">
              Talabalar tomonidan yuborilgan so'rovlarni ko'rib chiqing
            </p>
          </div>
          <button type="button" onClick={() => void load(tab)}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold">
            <RefreshCw size={15} /> Yangilash
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-1 rounded-2xl bg-slate-50 p-1 w-fit">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                tab === t.value
                  ? `bg-white shadow-sm ${t.colour}`
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t.label}
              {tab === t.value && requests.length > 0 && (
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-black
                  ${t.value === 'pending' ? 'bg-amber-50 text-amber-600'
                    : t.value === 'approved' ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-rose-50 text-rose-500'}`}>
                  {requests.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="card flex items-center justify-center gap-3 p-16 text-text-secondary">
          <span className="animate-spin text-2xl">⏳</span> Yuklanmoqda...
        </div>
      ) : requests.length === 0 ? (
        <div className="card p-12 text-center">
          <CalendarClock className="mx-auto text-text-secondary/30" size={48} />
          <p className="mt-4 text-lg font-black text-text-primary">So'rovlar yo'q</p>
          <p className="mt-2 text-sm text-text-secondary">Bu bo'limda hozircha so'rov mavjud emas</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {requests.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                showActions={tab === 'pending'}
                onRefresh={() => void load(tab)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
```

---

## 📁 QADAM 14 — Providers va Router integratsiyasi

### `design/src/app/providers.tsx` — ToastProvider qo'shing:

```tsx
import { ToastProvider } from '@/src/components/notifications/ToastProvider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </AuthProvider>
  );
}
```

### `design/src/components/layout/app-shell.tsx` — LoginAlertModal qo'shing:

```tsx
import { LoginAlertModal } from '@/src/components/notifications/LoginAlertModal';

// AppShell return ichida, <Outlet /> dan oldin:
export function AppShell() {
  // ... existing code ...
  return (
    <div className="min-h-screen mesh-bg text-text-primary">
      <LoginAlertModal />   {/* ← shu qatorni qo'shing */}
      <div className="flex min-h-screen">
        {/* ... sidebar, header, outlet ... */}
      </div>
    </div>
  );
}
```

### `design/src/app/router.tsx` — yangi admin route:

```tsx
const AdminExtensionRequestsPage = lazy(() => import('@/src/pages/AdminExtensionRequestsPage'));

// AppShell routes ichida:
<Route path="/admin/extension-requests" element={<AdminExtensionRequestsPage />} />
```

---

## 📁 QADAM 15 — Database migrations

```bash
python manage.py makemigrations lms --name="add_notification_type_deadline_extension"
python manage.py migrate
```

---

## 📁 QADAM 16 — `index.css` animatsiya qo'shimchalari

### `design/src/index.css` ga qo'shing:

```css
/* ── Notification animations ─────────────────────────────────────────────── */

@keyframes bell-ring {
  0%   { transform: rotate(0deg); }
  10%  { transform: rotate(-15deg); }
  20%  { transform: rotate(15deg); }
  30%  { transform: rotate(-10deg); }
  40%  { transform: rotate(10deg); }
  50%  { transform: rotate(0deg); }
  100% { transform: rotate(0deg); }
}

.animate-bell-ring {
  animation: bell-ring 1s ease-in-out;
}

@keyframes urgent-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  50%       { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);  }
}

.animate-urgent-pulse {
  animation: urgent-pulse 2s ease-in-out infinite;
}

/* Toast slide-in */
@keyframes toast-slide-in {
  from { transform: translateX(calc(100% + 1rem)); opacity: 0; }
  to   { transform: translateX(0);                opacity: 1; }
}

.animate-toast-in {
  animation: toast-slide-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

/* Modal scale-in */
@keyframes modal-in {
  from { transform: translate(-50%, -45%) scale(0.95); opacity: 0; }
  to   { transform: translate(-50%, -50%) scale(1);    opacity: 1; }
}

.animate-modal-in {
  animation: modal-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
```

---

## ✅ Yakuniy Tekshiruv Ro'yxati

### Backend
- [ ] `DeadlineExtensionRequest` va `AssignmentStudentDeadline` modellari yaratildi
- [ ] `Notification` modeli `notif_type`, `priority`, `meta`, `expires_at`, `is_dismissed` fieldlari bilan kengaytirildi
- [ ] `lms/services/notification_service.py` — barcha factory funksiyalar ishlaydi
- [ ] `lms/tasks.py` → `check_approaching_deadlines` task Celery Beat bilan ishlaydi
- [ ] `api_login_alerts` — faqat `is_dismissed=False` va muddati o'tmagan alertlarni qaytaradi va dismiss qiladi
- [ ] Extension request CRUD API endpointlari ishlaydi
- [ ] `lms/signals.py` — Enrollment yaratilganda avtomatik notification
- [ ] Migration muvaffaqiyatli bajarildi

### Frontend
- [ ] `LoginAlertModal` — session boshida bir marta chiqadi, framer-motion animatsiyali
- [ ] `ToastProvider` — global toast stack, `useToast()` hook ishlaydi
- [ ] Bell dropdown — animatsiyali badge, real-time notif list, click-outside close
- [ ] `DeadlineExtensionModal` — muddati o'tgan assignment uchun so'rov yuborish
- [ ] `AdminExtensionRequestsPage` — 3 tab (pending/approved/rejected), inline review form
- [ ] Router'da `/admin/extension-requests` route ro'yxatdan o'tgan
- [ ] `Providers` ichida `ToastProvider` ulangan
- [ ] `AppShell` da `LoginAlertModal` qo'shilgan

### LMS Standartlari
- [ ] Modal faqat bir marta ko'rinadi (sessionStorage flag)
- [ ] Urgent alertlar pulse animatsiyasi bilan ajralib turadi
- [ ] Toast 5 soniyada auto-dismiss + progress bar
- [ ] Admin panel so'rovlarni filter qiladi (status tabs)
- [ ] Talaba individual deadline oladi (`AssignmentStudentDeadline`)
- [ ] Celery task har kuni ertalab 8:00 da ishga tushadi

---

## 📦 Kerakli paketlar

```bash
# Backend
pip install celery redis django-celery-beat --break-system-packages

# Frontend (allaqachon o'rnatilgan bo'lishi kerak)
npm install framer-motion lucide-react
```

---

*Ushbu prompt Django LMS loyihasining mavjud `Notification`, `Assignment`, `Enrollment`, `auth-context.tsx`, `app-shell.tsx` va `router.tsx` fayllari asosida yozilgan. Barcha kod komponentlar mavjud dizayn sistema (`.card`, `.btn`, `.btn-primary`, `.input`, `.label-micro`, `shadow-premium`) bilan mos keladi.*
