from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from lms.models import Assignment, AssignmentStudentDeadline, Enrollment, Notification, NotificationType


def _create(
    *,
    user,
    title: str,
    message: str,
    notif_type: str,
    priority: str = "medium",
    link: str | None = None,
    meta: dict | None = None,
    expires_hours: int | None = None,
):
    expires_at = None
    if expires_hours:
        expires_at = timezone.now() + timedelta(hours=int(expires_hours))
    return Notification.objects.create(
        user=user,
        title=title,
        message=message,
        notif_type=notif_type,
        priority=priority,
        link=link,
        meta=meta or {},
        expires_at=expires_at,
    )


def notify_course_enrolled(enrollment: Enrollment):
    _create(
        user=enrollment.student,
        title="🎓 Yangi kursga qo'shildingiz!",
        message=f"«{enrollment.course.title}» kursiga muvaffaqiyatli ro'yxatdan o'tdingiz.",
        notif_type=NotificationType.COURSE_ENROLLED,
        priority="high",
        link=f"/courses/{enrollment.course.id}",
        meta={"course_id": enrollment.course.id, "course_title": enrollment.course.title},
        expires_hours=48,
    )


def notify_deadline_warning_generic(
    *,
    user,
    resource_type: str,
    resource_id: int,
    resource_title: str,
    course_id: int | None,
    deadline,
    days_left: int,
    link: str,
):
    already_sent = Notification.objects.filter(
        user=user,
        notif_type=NotificationType.DEADLINE_WARNING,
        meta__resource_type=resource_type,
        meta__resource_id=resource_id,
        created_at__gte=timezone.now() - timedelta(hours=20),
    ).exists()
    if already_sent:
        return
    priority = "urgent" if days_left == 0 else ("high" if days_left <= 1 else "medium")
    label = "Bugun!" if days_left == 0 else f"{days_left} kun qoldi"
    noun = "topshirig'i" if resource_type == "assignment" else "testi"
    _create(
        user=user,
        title=f"⏰ Muddat yaqinlashmoqda — {label}",
        message=f"«{resource_title}» {noun} muddati tugaydi: {deadline.strftime('%d.%m.%Y %H:%M')}",
        notif_type=NotificationType.DEADLINE_WARNING,
        priority=priority,
        link=link,
        meta={
            "resource_type": resource_type,
            "resource_id": resource_id,
            "resource_title": resource_title,
            "assignment_id": resource_id if resource_type == "assignment" else None,
            "assignment_title": resource_title if resource_type == "assignment" else "",
            "days_left": days_left,
            "course_id": course_id,
            "deadline": deadline.isoformat(),
        },
        expires_hours=24,
    )


def notify_deadline_warning(
    user,
    assignment: Assignment,
    days_left: int,
    custom_deadline=None,
):
    deadline = custom_deadline or assignment.deadline
    notify_deadline_warning_generic(
        user=user,
        resource_type="assignment",
        resource_id=assignment.id,
        resource_title=assignment.title,
        course_id=assignment.course_id,
        deadline=deadline,
        days_left=days_left,
        link=f"/assignments/{assignment.id}",
    )


def notify_extension_result(request_obj, *, approved: bool):
    assignment = request_obj.assignment
    if approved:
        new_dl = request_obj.approved_deadline.strftime("%d.%m.%Y %H:%M")
        _create(
            user=request_obj.student,
            title="✅ Muddat uzaytirish tasdiqlandi",
            message=f"«{assignment.title}» topshirig'i uchun yangi muddat: {new_dl}",
            notif_type=NotificationType.EXTENSION_APPROVED,
            priority="high",
            link=f"/assignments/{assignment.id}",
            meta={
                "assignment_id": assignment.id,
                "assignment_title": assignment.title,
                "new_deadline": request_obj.approved_deadline.isoformat(),
            },
            expires_hours=72,
        )
    else:
        note = f" Sabab: {request_obj.admin_note}" if request_obj.admin_note else ""
        _create(
            user=request_obj.student,
            title="❌ Muddat uzaytirish rad etildi",
            message=f"«{assignment.title}» uchun so'rovingiz rad etildi.{note}",
            notif_type=NotificationType.EXTENSION_REJECTED,
            priority="medium",
            link=f"/assignments/{assignment.id}",
            meta={"assignment_id": assignment.id},
        )


def get_effective_assignment_deadline(*, student, assignment: Assignment):
    try:
        custom = AssignmentStudentDeadline.objects.get(student=student, assignment=assignment)
        return custom.deadline
    except AssignmentStudentDeadline.DoesNotExist:
        return assignment.deadline

