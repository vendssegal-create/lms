from django.db.models import Count
from django.db import models
import logging

from django.conf import settings
from django.core.files.base import ContentFile
from django.http import FileResponse, HttpResponse, JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET, require_POST, require_http_methods

import json
import mimetypes
import os
import re
import zipfile
from datetime import timedelta
from decimal import Decimal

from lms.models import (
    Assignment,
    AssignmentStudentDeadline,
    Course,
    CourseMeeting,
    Enrollment,
    ForumPost,
    ForumTopic,
    GradebookEntry,
    ProctorLog,
    CourseGradebook,
    Question,
    Section,
    SectionCompletion,
    SectionResource,
    SectionResourceType,
    ResourceView,
    BookChapter,
    GlossaryEntry,
    FolderFile,
    Submission,
    Test,
    TestAttempt,
    Notification,
    NotificationType,
    DeadlineExtensionRequest,
    UserCertificate,
    CertificateTrigger,
    CertificateTemplate,
)
from lms.services.certificate_docx_service import CertificateDocxService
from lms.services.certificate_service import (
    certificate_api_download_path,
    certificate_default_download_format,
    certificate_docx_source_ready,
    certificate_print_path,
    certificate_print_preview_path,
    check_certificate_eligibility,
    get_certificate_grade_info,
    get_course_certificate_template_for_preview,
    issue_certificate,
    staff_can_certificate_preview,
    user_certificate_pdf_cache_is_fresh,
)

logger = logging.getLogger(__name__)
from lms.tasks import generate_certificate_async
from lms.services.notification_service import notify_extension_result
from lms.utils.context_builders import build_staff_dashboard_context
from lms.utils.tests import build_test_question_order, calculate_test_score, get_attempt_end_time, get_questions_from_order
from users.utils.roles import (
    Role,
    can_manage_course_content,
    can_manage_enrollments,
    can_manage_tests,
    can_view_test_reporting,
    get_role_label,
    get_user_role,
)
from users.models import TeacherProfile, StudentProfile, User
from retake.models import RetakeApplication, RetakeApplicationItem, RetakeItemStatus
from users.utils.hemis_helpers import get_snapshot_for_user


def _iso(value):
    return value.isoformat() if value else None


def _coerce_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _coerce_int(value):
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _require_super_admin(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)
    role = get_user_role(request.user, getattr(request, "session", None))
    if role != Role.SUPER_ADMIN and not request.user.is_superuser:
        return JsonResponse({"error": "Faqat super admin."}, status=403)
    return None


def _require_staff_like(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)
    role = get_user_role(request.user, getattr(request, "session", None))
    if _has_global_admin_access(request):
        return None
    if role in (Role.TEACHER, Role.SUPER_ADMIN, Role.ACADEMIC_BOARD, Role.REGISTRATOR):
        return None
    return JsonResponse({"error": "Ruxsat yo'q."}, status=403)


@require_GET
def login_alerts(request):
    now = timezone.now()
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    # Modal policy:
    # - deadline warning/overdue: always show while valid (3 kun qolgandan deadlinegacha)
    # - other alerts: one-time show via is_dismissed flag
    alerts = (
        Notification.objects.filter(user=request.user)
        .filter(models.Q(expires_at__isnull=True) | models.Q(expires_at__gte=now))
        .filter(
            models.Q(
                notif_type__in=[
                    NotificationType.DEADLINE_WARNING,
                    NotificationType.DEADLINE_OVERDUE,
                ],
                priority__in=["medium", "high", "urgent"],
            )
            | models.Q(is_dismissed=False, priority__in=["high", "urgent"])
        )
        .order_by("-created_at")[:10]
    )

    data = []
    ids = []
    for n in alerts:
        data.append({
            "id": n.id,
            "type": n.notif_type,
            "priority": n.priority,
            "title": n.title,
            "message": n.message,
            "link": n.link,
            "meta": n.meta,
            "created_at": _iso(n.created_at),
        })
        ids.append(n.id)

    # Do not dismiss deadline alerts so they can keep appearing.
    dismissable_ids = [
        n.id for n in alerts
        if n.notif_type not in (NotificationType.DEADLINE_WARNING, NotificationType.DEADLINE_OVERDUE)
    ]
    if dismissable_ids:
        Notification.objects.filter(id__in=dismissable_ids).update(is_dismissed=True)

    return JsonResponse({"alerts": data, "count": len(data)})


@require_POST
def extension_request_create(request, assignment_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)
    assignment = get_object_or_404(Assignment, id=assignment_id)

    if assignment.deadline and assignment.deadline > timezone.now():
        return JsonResponse({"error": "Muddat hali o'tmagan."}, status=400)

    existing = DeadlineExtensionRequest.objects.filter(
        student=request.user,
        assignment=assignment,
        status=DeadlineExtensionRequest.Status.PENDING,
    ).first()
    if existing:
        return JsonResponse({"error": "Sizning so'rovingiz ko'rib chiqilmoqda."}, status=400)

    payload = _json_body(request)
    reason = (payload.get("reason") or "").strip()
    requested_deadline_raw = payload.get("requested_deadline")
    if not reason:
        return JsonResponse({"error": "Sabab ko'rsating."}, status=400)
    if not requested_deadline_raw:
        return JsonResponse({"error": "Yangi muddat sanasini kiriting."}, status=400)

    requested_deadline = _parse_datetime(str(requested_deadline_raw).strip())
    if requested_deadline is None:
        return JsonResponse({"error": "Sana formati noto'g'ri."}, status=400)

    ext_req = DeadlineExtensionRequest.objects.create(
        student=request.user,
        assignment=assignment,
        reason=reason,
        requested_deadline=requested_deadline,
    )

    # Notify staff-like users (keep it simple: teacher/super admins will see it).
    staff_qs = User.objects.filter(
        models.Q(is_superuser=True)
        | models.Q(role__in=[Role.SUPER_ADMIN, Role.TEACHER, Role.ACADEMIC_BOARD, Role.REGISTRATOR])
    ).distinct()
    for admin_user in staff_qs:
        Notification.objects.create(
            user=admin_user,
            title="📋 Muddat uzaytirish so'rovi",
            message=(f"{request.user.get_full_name() or request.user.username} → "
                     f"«{assignment.title}» — so'rov yuborildi."),
            notif_type=NotificationType.SYSTEM,
            priority="medium",
            link=f"/super-admin/extension-requests",
            meta={
                "request_id": ext_req.id,
                "student_name": request.user.get_full_name() or request.user.username,
                "assignment_id": assignment.id,
                "assignment_title": assignment.title,
            },
        )

    return JsonResponse({"success": True, "request_id": ext_req.id})


def _serialize_extension_request(r: DeadlineExtensionRequest):
    return {
        "id": r.id,
        "student_name": r.student.get_full_name() or r.student.username,
        "student_id": r.student_id,
        "assignment_id": r.assignment_id,
        "assignment_title": r.assignment.title,
        "course_title": r.assignment.course.title,
        "original_deadline": _iso(r.assignment.deadline),
        "requested_deadline": _iso(r.requested_deadline),
        "approved_deadline": _iso(r.approved_deadline),
        "reason": r.reason,
        "admin_note": r.admin_note,
        "status": r.status,
        "created_at": _iso(r.created_at),
        "reviewed_at": _iso(r.reviewed_at),
    }


@require_GET
def admin_extension_requests_list(request):
    deny = _require_staff_like(request)
    if deny:
        return deny
    status_filter = (request.GET.get("status") or "pending").strip().lower()
    if status_filter not in ("pending", "approved", "rejected"):
        status_filter = "pending"
    qs = (
        DeadlineExtensionRequest.objects
        .filter(status=status_filter)
        .select_related("student", "assignment", "assignment__course")
        .order_by("-created_at")
    )
    return JsonResponse({"requests": [_serialize_extension_request(r) for r in qs]})


@require_POST
def admin_extension_request_review(request, request_id: int):
    deny = _require_staff_like(request)
    if deny:
        return deny

    ext_req = get_object_or_404(
        DeadlineExtensionRequest.objects.select_related("student", "assignment", "assignment__course"),
        id=request_id,
    )
    if ext_req.status != DeadlineExtensionRequest.Status.PENDING:
        return JsonResponse({"error": "So'rov allaqachon ko'rib chiqilgan."}, status=400)

    payload = _json_body(request)
    action = (payload.get("action") or "").strip().lower()
    admin_note = (payload.get("admin_note") or "").strip()
    new_deadline_raw = payload.get("new_deadline")

    if action == "approve":
        if not new_deadline_raw:
            return JsonResponse({"error": "Yangi muddat kiriting."}, status=400)
        new_deadline = _parse_datetime(str(new_deadline_raw).strip())
        if new_deadline is None:
            return JsonResponse({"error": "Sana formati noto'g'ri."}, status=400)

        ext_req.status = DeadlineExtensionRequest.Status.APPROVED
        ext_req.approved_deadline = new_deadline
        ext_req.admin_note = admin_note
        ext_req.reviewed_by = request.user
        ext_req.reviewed_at = timezone.now()
        ext_req.save()

        AssignmentStudentDeadline.objects.update_or_create(
            student=ext_req.student,
            assignment=ext_req.assignment,
            defaults={"deadline": new_deadline, "set_by": request.user},
        )
        notify_extension_result(ext_req, approved=True)
        return JsonResponse({"success": True, "status": ext_req.status})

    if action == "reject":
        ext_req.status = DeadlineExtensionRequest.Status.REJECTED
        ext_req.admin_note = admin_note
        ext_req.reviewed_by = request.user
        ext_req.reviewed_at = timezone.now()
        ext_req.save()
        notify_extension_result(ext_req, approved=False)
        return JsonResponse({"success": True, "status": ext_req.status})

    return JsonResponse({"error": "action noto'g'ri."}, status=400)


def _serialize_attempt(attempt):
    return {
        "id": attempt.id,
        "student_name": attempt.student.full_name,
        "score": attempt.score,
        "correct_count": attempt.correct_count,
        "finished_at": _iso(attempt.finished_at),
        "test": {
            "id": attempt.test_id,
            "name": attempt.test.name,
            "max_score": attempt.test.max_score,
            "course_title": attempt.test.course.title,
        },
    }


def _serialize_test(test, student_profile=None):
    attempts_done = 0
    last_attempt = None
    active_attempt = None
    if student_profile is not None:
        completed_attempts = TestAttempt.objects.filter(
            student=student_profile,
            test=test,
            is_completed=True,
        ).order_by("-finished_at")
        active_attempt = TestAttempt.objects.filter(
            student=student_profile,
            test=test,
            is_completed=False,
        ).order_by("-started_at").first()
        attempts_done = completed_attempts.count()
        last_attempt = completed_attempts.first()

    return {
        "id": test.id,
        "name": test.name,
        "description": test.description,
        "is_active": test.is_active,
        "control_type": test.control_type,
        "control_type_label": test.get_control_type_display(),
        "start_datetime": _iso(test.start_datetime),
        "end_datetime": _iso(test.end_datetime),
        "duration_minutes": test.duration_minutes,
        "max_score": test.max_score,
        "attempts_allowed": test.attempts_allowed,
        "attempts_done": attempts_done,
        "attempts_left": max(test.attempts_allowed - attempts_done, 0),
        "question_count": test.question_count,
        "proctoring_enabled": test.proctoring_enabled,
        "face_id_required": test.face_id_required,
        "course": {
            "id": test.course_id,
            "title": test.course.title,
        },
        "section": {
            "id": test.section_id,
            "name": test.section.name if test.section_id else "",
        } if test.section_id else None,
        "status": _get_test_status(test, active_attempt),
        "status_label": _get_test_status_label(test, active_attempt),
        "last_score": last_attempt.score if last_attempt else None,
        "has_active_attempt": active_attempt is not None,
        "spa_take_path": f"/tests/{test.id}/take",
        "spa_result_path": f"/tests/{test.id}/result",
        "spa_edit_path": f"/tests/{test.id}/edit",
        # Keep legacy fields for backward compatibility, but point to SPA.
        "take_url": f"/tests/{test.id}/take",
        "result_url": f"/tests/{test.id}/result",
        "edit_url": f"/tests/{test.id}/edit",
    }


def _get_test_status(test, active_attempt):
    now = timezone.now()
    if active_attempt is not None:
        return "in_progress"
    if not test.is_active:
        return "inactive"
    if test.end_datetime and test.end_datetime < now:
        return "closed"
    if test.start_datetime and test.start_datetime > now:
        return "scheduled"
    return "open"


def _get_test_status_label(test, active_attempt):
    labels = {
        "in_progress": "Jarayonda",
        "inactive": "Faol emas",
        "closed": "Yakunlangan",
        "scheduled": "Rejalashtirilgan",
        "open": "Ochiq",
    }
    return labels[_get_test_status(test, active_attempt)]


def _serialize_course(course, *, student=None, completed_ids=None):
    section_count = getattr(course, "sections_count", course.sections.count())
    test_count = getattr(course, "tests_count", course.tests.count())
    assignment_count = getattr(course, "assignments_count", course.assignments.count())
    student_count = getattr(course, "students_count", course.enrollments.count())
    completed_count = 0
    progress_percentage = 0

    if student is not None:
        course_section_ids = list(course.sections.values_list("id", flat=True))
        if course_section_ids:
            completed_count = len([section_id for section_id in course_section_ids if section_id in (completed_ids or set())])
            progress_percentage = int((completed_count / len(course_section_ids)) * 100)

    return {
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "is_active": course.is_active,
        "deadline": _iso(course.deadline),
        "image_url": course.image.url if course.image else (getattr(course, "image_url", None) or None),
        "spa_path": f"/courses/{course.id}",
        "teacher": {
            "id": course.teacher_id,
            "full_name": course.teacher.get_full_name() or course.teacher.username,
        },
        "sections_count": section_count,
        "tests_count": test_count,
        "assignments_count": assignment_count,
        "students_count": student_count,
        "completed_sections": completed_count,
        "progress_percentage": progress_percentage,
        "detail_url": f"/courses/{course.id}",
        "certificate": _get_course_certificate_info(course, student) if student else None,
    }

def _get_course_certificate_info(course, student):
    has_cert_setup = CertificateTemplate.objects.filter(course=course, is_active=True).exists()
    if not has_cert_setup:
        return None

    download_path = certificate_api_download_path(course.id)
    print_path = certificate_print_path(course.id)
    user_cert = (
        UserCertificate.objects.filter(user=student, course=course).select_related("template").first()
    )

    if user_cert and user_cert.pdf_file:
        return {
            "is_available": True,
            "is_generated": True,
            "url": user_cert.pdf_file.url,
            "serial": user_cert.serial_number,
            "download_url": download_path,
            "print_url": print_path,
        }

    is_eligible, result = check_certificate_eligibility(student, course)
    tpl = result if is_eligible else None
    docx_ready = bool(tpl and certificate_docx_source_ready(tpl))

    if user_cert and docx_ready:
        return {
            "is_available": True,
            "is_generated": False,
            "message": "Sertifikat yuklab olishga tayyor!",
            "serial": user_cert.serial_number,
            "download_url": download_path,
            "print_url": print_path,
        }

    return {
        "is_available": is_eligible,
        "is_generated": False,
        "message": result if not is_eligible else "Sertifikat yuklab olishga tayyor!",
        "download_url": download_path if is_eligible else None,
        "print_url": print_path if is_eligible else None,
        "serial": user_cert.serial_number if user_cert else None,
    }


def _get_staff_certificate_preview_info(request, course):
    """
    Talaba emas, lekin kursni boshqaruvchi foydalanuvchilar uchun namuna chop etish.
    Rasmiy sertifikat emas — UserCertificate yaratilmaydi.
    """
    if not staff_can_certificate_preview(request, course):
        return None
    tpl = get_course_certificate_template_for_preview(course)
    if not tpl or not certificate_docx_source_ready(tpl):
        return None
    return {
        "is_available": True,
        "is_generated": False,
        "is_preview": True,
        "message": "Namuna: rasmiy talaba sertifikati emas. Shablon va chop etishni tekshirish uchun.",
        "download_url": None,
        "print_url": certificate_print_preview_path(course.id),
        "serial": None,
    }

def _certificate_pdf_response(pdf_bytes: bytes, serial: str) -> HttpResponse:
    resp = HttpResponse(pdf_bytes, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="sertifikat_{serial}.pdf"'
    return resp


@require_GET
def course_certificate_download(request, course_id):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    course = get_object_or_404(Course, id=course_id)
    fmt = (request.GET.get("format") or certificate_default_download_format()).lower()
    regen = request.GET.get("regen", "0") == "1"

    user_cert, issue_msg = issue_certificate(request.user, course)
    if not user_cert:
        return JsonResponse({"error": issue_msg}, status=403)

    template = user_cert.template
    if not template:
        return JsonResponse({"error": "Sertifikat shabloni topilmadi."}, status=500)

    if not certificate_docx_source_ready(template):
        return JsonResponse(
            {
                "error": "DOCX shablon topilmadi. Admin orqali .docx yuklang yoki "
                "lms/certificate_assets/certificate_template.docx faylini joylashtiring.",
            },
            status=500,
        )

    if (
        not regen
        and fmt == "pdf"
        and user_cert.pdf_file
        and user_cert.pdf_file.name
        and user_certificate_pdf_cache_is_fresh(user_cert, template)
    ):
        fname = (user_cert.pdf_file.name or "").rsplit("/", 1)[-1] or f"sertifikat_{user_cert.serial_number}.pdf"
        return FileResponse(
            user_cert.pdf_file.open("rb"),
            as_attachment=True,
            filename=fname,
            content_type="application/pdf",
        )

    service = CertificateDocxService(template_model=template)
    score, max_score, hours = get_certificate_grade_info(request.user, course, template)

    try:
        if fmt == "docx":
            content = service.generate(
                student=request.user,
                course=course,
                serial=user_cert.serial_number,
                score=score,
                max_score=max_score,
                hours=hours,
                as_docx=True,
            )
            resp = HttpResponse(
                content,
                content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
            resp["Content-Disposition"] = f'attachment; filename="sertifikat_{user_cert.serial_number}.docx"'
            return resp

        pdf_bytes = service.generate(
            student=request.user,
            course=course,
            serial=user_cert.serial_number,
            score=score,
            max_score=max_score,
            hours=hours,
        )
        fname = f"cert_{user_cert.serial_number}.pdf"
        user_cert.pdf_file.save(fname, ContentFile(pdf_bytes), save=True)
        user_cert.pdf_generated_at = timezone.now()
        user_cert.save(update_fields=["pdf_generated_at"])
        return _certificate_pdf_response(pdf_bytes, user_cert.serial_number)

    except Exception as exc:
        logger.exception("DOCX sertifikat generatsiya xatosi: %s", exc)
        return JsonResponse({"error": str(exc)}, status=500)


@require_GET
def course_certificate_check(request, course_id):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    course = get_object_or_404(Course, id=course_id)
    is_eligible, result = check_certificate_eligibility(request.user, course)
    existing_cert = (
        UserCertificate.objects.filter(user=request.user, course=course).select_related("template").first()
    )
    has_pdf = existing_cert is not None and bool(existing_cert.pdf_file)
    is_ready = is_eligible or has_pdf
    has_certificate = has_pdf or (existing_cert is not None and is_eligible)

    return JsonResponse({
        "is_eligible": is_eligible,
        "message": "Sertifikat tayyor!" if is_ready else result,
        "has_certificate": has_certificate,
        "download_url": (certificate_api_download_path(course_id) if is_ready else None),
        "print_url": (certificate_print_path(course_id) if is_ready else None),
    })


@require_GET
def api_certificate_verify(request, serial: str):
    cert = (
        UserCertificate.objects.filter(serial_number=serial)
        .select_related("user", "course", "template")
        .first()
    )
    if not cert:
        return JsonResponse(
            {"valid": False, "message": "Sertifikat topilmadi yoki haqiqiy emas."},
            status=404,
        )

    student_name = cert.user.get_full_name() or cert.user.username
    inst = ""
    if cert.template and getattr(cert.template, "institution_name", ""):
        inst = cert.template.institution_name
    else:
        inst = getattr(settings, "LMS_INSTITUTION_NAME", "")

    return JsonResponse(
        {
            "valid": True,
            "serial_number": cert.serial_number,
            "student_name": student_name,
            "course_name": cert.course.title,
            "issued_at": cert.issued_at.strftime("%d.%m.%Y"),
            "institution": inst,
            "message": "Sertifikat haqiqiy va tekshirildi.",
        }
    )


@require_POST
def resource_mark_viewed(request, resource_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    resource = get_object_or_404(SectionResource, id=resource_id)
    if not Enrollment.objects.filter(
        student=request.user,
        course=resource.section.course
    ).exists():
        return JsonResponse({"error": "Sizda bu kursga kirish huquqi yo'q."}, status=403)
    rv, created = ResourceView.objects.get_or_create(resource=resource, student=request.user)
    if not created:
        rv.view_count += 1
        rv.save(update_fields=["view_count", "last_viewed_at"])
    return JsonResponse({"success": True, "view_count": rv.view_count})


@require_POST
def resource_mark_completed(request, resource_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    resource = get_object_or_404(SectionResource, id=resource_id)
    if not Enrollment.objects.filter(
        student=request.user,
        course=resource.section.course
    ).exists():
        return JsonResponse({"error": "Sizda bu kursga kirish huquqi yo'q."}, status=403)
    payload = _json_body(request)
    time_spent = _coerce_int(payload.get("time_spent_seconds")) or 0

    rv, _ = ResourceView.objects.get_or_create(resource=resource, student=request.user)
    rv.is_completed = True
    rv.completed_at = timezone.now()
    rv.time_spent_seconds = max(0, rv.time_spent_seconds + time_spent)
    rv.save(update_fields=["is_completed", "completed_at", "time_spent_seconds", "last_viewed_at"])
    return JsonResponse({"success": True, "completed_at": _iso(rv.completed_at)})


@require_POST
def section_mark_complete(request, section_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    section = get_object_or_404(Section.objects.select_related("course"), id=section_id)

    if not Enrollment.objects.filter(course=section.course, student=request.user).exists():
        return JsonResponse({"error": "Bu kursga ro'yxatdan o'tilmagan."}, status=403)

    SectionCompletion.objects.get_or_create(student=request.user, section=section)

    course = section.course
    total_sections = course.sections.count()
    completed_count = SectionCompletion.objects.filter(
        student=request.user,
        section__course=course,
    ).count()
    progress_percentage = int((completed_count / total_sections) * 100) if total_sections else 0

    return JsonResponse({
        "success": True,
        "section_id": section_id,
        "is_completed": True,
        "progress_percentage": progress_percentage,
        "completed_sections": completed_count,
        "total_sections": total_sections,
    })


@require_GET
def resource_book_chapter(request, resource_id: int, chapter_id: int):
    resource = get_object_or_404(SectionResource, id=resource_id, resource_type=SectionResourceType.BOOK)
    chapter = get_object_or_404(BookChapter, id=chapter_id, resource=resource)
    return JsonResponse({
        "id": chapter.id,
        "title": chapter.title,
        "content": chapter.content,
        "order": chapter.order,
    })


@require_POST
def teacher_book_chapter_save(request, resource_id: int):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    resource = get_object_or_404(
        SectionResource.objects.select_related("section", "section__course"),
        id=resource_id,
        resource_type=SectionResourceType.BOOK,
    )
    if not _can_manage_course(request, resource.section.course):
        return JsonResponse({"error": "Bu kurs sizga tegishli emas."}, status=403)

    payload = _json_body(request)
    chapter_id = payload.get("id")
    title = (payload.get("title") or "").strip()
    content = payload.get("content") or ""
    if not title:
        return JsonResponse({"error": "title shart."}, status=400)

    if chapter_id:
        chapter = get_object_or_404(BookChapter, id=chapter_id, resource=resource)
        chapter.title = title
        chapter.content = content
        chapter.save(update_fields=["title", "content"])
    else:
        next_order = (BookChapter.objects.filter(resource=resource).aggregate(max_order=models.Max("order")).get("max_order") or 0) + 1
        chapter = BookChapter.objects.create(resource=resource, title=title, content=content, order=next_order)

    return JsonResponse({"success": True, "chapter": {"id": chapter.id, "title": chapter.title, "order": chapter.order}})


@require_POST
def teacher_book_chapter_delete(request, resource_id: int, chapter_id: int):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    chapter = get_object_or_404(
        BookChapter.objects.select_related("resource", "resource__section", "resource__section__course"),
        id=chapter_id,
        resource_id=resource_id,
    )
    if not _can_manage_course(request, chapter.resource.section.course):
        return JsonResponse({"error": "Bu kurs sizga tegishli emas."}, status=403)

    chapter.delete()
    return JsonResponse({"success": True})


@require_POST
def teacher_glossary_entry_save(request, resource_id: int):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    resource = get_object_or_404(
        SectionResource.objects.select_related("section", "section__course"),
        id=resource_id,
        resource_type=SectionResourceType.GLOSSARY,
    )
    if not _can_manage_course(request, resource.section.course):
        return JsonResponse({"error": "Bu kurs sizga tegishli emas."}, status=403)

    payload = _json_body(request)
    entry_id = payload.get("id")
    term = (payload.get("term") or "").strip()
    definition = (payload.get("definition") or "").strip()
    if not term or not definition:
        return JsonResponse({"error": "term va definition shart."}, status=400)

    if entry_id:
        entry = get_object_or_404(GlossaryEntry, id=entry_id, resource=resource)
        entry.term = term
        entry.definition = definition
        entry.save(update_fields=["term", "definition"])
    else:
        entry = GlossaryEntry.objects.create(resource=resource, term=term, definition=definition, created_by=request.user)

    return JsonResponse({"success": True, "entry": {"id": entry.id, "term": entry.term, "definition": entry.definition}})


@require_POST
def teacher_glossary_entry_delete(request, resource_id: int, entry_id: int):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    entry = get_object_or_404(
        GlossaryEntry.objects.select_related("resource", "resource__section", "resource__section__course"),
        id=entry_id,
        resource_id=resource_id,
    )
    if not _can_manage_course(request, entry.resource.section.course):
        return JsonResponse({"error": "Bu kurs sizga tegishli emas."}, status=403)

    entry.delete()
    return JsonResponse({"success": True})


@require_POST
def teacher_folder_file_upload(request, resource_id: int):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    resource = get_object_or_404(
        SectionResource.objects.select_related("section", "section__course"),
        id=resource_id,
        resource_type=SectionResourceType.FOLDER,
    )
    if not _can_manage_course(request, resource.section.course):
        return JsonResponse({"error": "Bu kurs sizga tegishli emas."}, status=403)

    uploaded_file = request.FILES.get("file")
    if not uploaded_file:
        return JsonResponse({"error": "file shart."}, status=400)

    next_order = (FolderFile.objects.filter(resource=resource).aggregate(max_order=models.Max("order")).get("max_order") or 0) + 1
    mime_type, _ = mimetypes.guess_type(uploaded_file.name)
    folder_file = FolderFile.objects.create(
        resource=resource,
        file=uploaded_file,
        original_filename=uploaded_file.name,
        file_size=uploaded_file.size,
        mime_type=mime_type or "",
        order=next_order,
    )
    return JsonResponse({
        "success": True,
        "file": {
            "id": folder_file.id,
            "original_filename": folder_file.original_filename,
            "file_url": folder_file.file.url if folder_file.file else None,
            "file_size": folder_file.file_size,
            "mime_type": folder_file.mime_type,
        },
    })


@require_POST
def teacher_folder_file_delete(request, resource_id: int, file_id: int):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    folder_file = get_object_or_404(
        FolderFile.objects.select_related("resource", "resource__section", "resource__section__course"),
        id=file_id,
        resource_id=resource_id,
    )
    if not _can_manage_course(request, folder_file.resource.section.course):
        return JsonResponse({"error": "Bu kurs sizga tegishli emas."}, status=403)

    folder_file.file.delete(save=False)
    folder_file.delete()
    return JsonResponse({"success": True})


def _serialize_staff_course_card(card):
    course = card["course"]
    return {
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "is_active": course.is_active,
        "deadline": _iso(course.deadline),
        "spa_path": f"/courses/{course.id}",
        "deadline_label": card["deadline_label"],
        "student_count": card["student_count"],
        "test_count": card["test_count"],
        "assignment_count": card["assignment_count"],
        "section_count": card["section_count"],
        "detail_url": f"/courses/{course.id}",
    }


def _build_student_dashboard(user):
    enrollments = (
        Enrollment.objects.filter(student=user)
        .select_related("course", "course__teacher")
        .order_by("-enrolled_at")
    )
    course_ids = [enrollment.course_id for enrollment in enrollments]
    tests_qs = (
        Test.objects.filter(course_id__in=course_ids, is_active=True)
        .select_related("course", "section")
        .order_by("start_datetime")
    )
    assignments_due = Assignment.objects.filter(
        course_id__in=course_ids,
        is_active=True,
    ).count()

    completed_ids = set(
        SectionCompletion.objects.filter(student=user, section__course_id__in=course_ids).values_list("section_id", flat=True)
    )
    courses = [_serialize_course(enrollment.course, student=user, completed_ids=completed_ids) for enrollment in enrollments]
    student_profile = getattr(user, "student_profile", None)

    return {
        "role": Role.STUDENT,
        "role_label": get_role_label(Role.STUDENT),
        "hero": {
            "kicker": "Talaba paneli",
            "title": "O'quv jarayoni nazorati",
            "subtitle": "Biriktirilgan kurslar, test oynalari va shaxsiy progress bir sahifada jamlandi.",
        },
        "stats": [
            {"label": "Kurslar", "value": len(courses), "subtitle": "Biriktirilgan fanlar"},
            {"label": "Faol testlar", "value": tests_qs.count(), "subtitle": "Yaqin va ochiq test oynalari"},
            {"label": "Topshiriqlar", "value": assignments_due, "subtitle": "Faol assignment lar"},
        ],
        "courses": courses[:6],
        "upcoming_tests": [_serialize_test(test, student_profile=student_profile) for test in tests_qs[:6]],
        "recent_attempts": [
            _serialize_attempt(attempt)
            for attempt in TestAttempt.objects.filter(student=student_profile, is_completed=True)
            .select_related("test", "test__course", "student")
            .order_by("-finished_at")[:5]
        ] if student_profile is not None else [],
        "actions": {
            "courses_path": "/courses",
            "tests_path": "/tests",
        },
    }


@require_GET
def dashboard_summary(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    role = get_user_role(request.user, request.session)
    if role == Role.STUDENT:
        return JsonResponse(_build_student_dashboard(request.user))

    context = build_staff_dashboard_context(request.user, request.session, role)
    return JsonResponse({
        "role": role,
        "role_label": get_role_label(role),
        "hero": {
            "kicker": context["dashboard_kicker"],
            "title": context["dashboard_title"],
            "subtitle": context["hero_subtitle"],
        },
        "stats": [
            {"label": "Kurslar", "value": context["total_courses"], "subtitle": "Umumiy kurslar soni"},
            {"label": "Talabalar", "value": context["total_students"], "subtitle": "Faol kontingent"},
            {"label": "Faol testlar", "value": context["active_tests"], "subtitle": "Ochiq test oynalari"},
            {"label": "Topshiriqlar", "value": context["total_assignments"], "subtitle": "Jami assignment lar"},
        ],
        "courses": [_serialize_staff_course_card(card) for card in context["course_cards"][:8]],
        "upcoming_tests": [_serialize_test(test) for test in context["upcoming_tests"]],
        "recent_attempts": [_serialize_attempt(attempt) for attempt in context["recent_attempts"]],
        "pending_retake_groups": [
            {
                "id": group.id,
                "subject_name": group.subject_snapshot.subject_name,
                "cycle_name": group.cycle.name,
                "course_title": group.lms_course.title,
            }
            for group in context["pending_retake_groups"]
        ],
        "permissions": {
            "can_manage_courses": context["can_manage_course_content"],
            "can_manage_enrollments": context["can_manage_enrollments"],
            "can_view_students": context["can_view_students"],
        },
    })


@require_GET
def courses_list(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    role = get_user_role(request.user, request.session)
    query = request.GET.get("q", "").strip()

    if role == Role.STUDENT:
        enrollments = (
            Enrollment.objects.filter(student=request.user)
            .select_related("course", "course__teacher")
            .order_by("-enrolled_at")
        )
        if query:
            enrollments = enrollments.filter(course__title__icontains=query)
        course_ids = [enrollment.course_id for enrollment in enrollments]
        completed_ids = set(
            SectionCompletion.objects.filter(student=request.user, section__course_id__in=course_ids).values_list("section_id", flat=True)
        )
        courses = [_serialize_course(enrollment.course, student=request.user, completed_ids=completed_ids) for enrollment in enrollments]
    else:
        courses_qs = (
            Course.objects.select_related("teacher")
            .annotate(
                sections_count=Count("sections", distinct=True),
                tests_count=Count("tests", distinct=True),
                assignments_count=Count("assignments", distinct=True),
                students_count=Count("enrollments", distinct=True),
            )
            .order_by("-created_at")
        )
        if role == Role.TEACHER:
            courses_qs = courses_qs.filter(teacher=request.user)
        if query:
            courses_qs = courses_qs.filter(title__icontains=query)
        courses = [_serialize_course(course) for course in courses_qs]

    return JsonResponse({
        "role": role,
        "role_label": get_role_label(role),
        "query": query,
        "permissions": {
            "can_manage_courses": can_manage_course_content(request.user, request.session),
        },
        "courses": courses,
    })


@require_GET
def tests_list(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    role = get_user_role(request.user, request.session)
    primary_role = getattr(request.user, "role", None)
    is_student_view = (
        role == Role.STUDENT
        and primary_role == Role.STUDENT
        and not request.user.is_superuser
    )

    if is_student_view:
        enrolled_course_ids = Enrollment.objects.filter(student=request.user).values_list("course_id", flat=True)
        tests_qs = (
            Test.objects.filter(course_id__in=enrolled_course_ids, is_active=True)
            .select_related("course", "section")
            .order_by("start_datetime")
        )
        student_profile = getattr(request.user, "student_profile", None)
        tests = [_serialize_test(test, student_profile=student_profile) for test in tests_qs]
        summary = {
            "total": len(tests),
            "open": len([item for item in tests if item["status"] == "open"]),
            "scheduled": len([item for item in tests if item["status"] == "scheduled"]),
            "in_progress": len([item for item in tests if item["status"] == "in_progress"]),
        }
    else:
        tests_qs = Test.objects.select_related("course", "section", "course__teacher").order_by("-created_at")
        if role == Role.TEACHER or primary_role == Role.TEACHER:
            tests_qs = tests_qs.filter(course__teacher=request.user)
        tests = [_serialize_test(test) for test in tests_qs]
        summary = {
            "total": len(tests),
            "active": len([item for item in tests if item["is_active"]]),
            "inactive": len([item for item in tests if not item["is_active"]]),
        }

    return JsonResponse({
        "role": Role.STUDENT if is_student_view else role,
        "role_label": get_role_label(Role.STUDENT if is_student_view else role),
        "summary": summary,
        "permissions": {
            "can_manage_tests": bool(
                can_manage_tests(request.user, request.session)
                or primary_role in (Role.TEACHER, Role.SUPER_ADMIN, Role.ACADEMIC_BOARD)
                or request.user.is_superuser
            ),
            "can_view_reporting": can_view_test_reporting(request.user, request.session),
        },
        "tests": tests,
    })


def _json_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body)
    except json.JSONDecodeError:
        return {}


def _require_can_manage_tests(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)
    can_manage = can_manage_tests(request.user, request.session)
    if not can_manage:
        primary_role = getattr(request.user, "role", None)
        if primary_role in (Role.TEACHER, Role.SUPER_ADMIN, Role.ACADEMIC_BOARD) or request.user.is_superuser:
            can_manage = True
    if not can_manage:
        return JsonResponse({"error": "Sizda testlarni boshqarish huquqi yo'q."}, status=403)
    return None


def _require_can_manage_courses(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)
    if not can_manage_course_content(request.user, request.session):
        return JsonResponse({"error": "Sizda kurs kontentini boshqarish huquqi yo'q."}, status=403)
    return None


def _require_can_manage_enrollments(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)
    if not can_manage_enrollments(request.user, request.session):
        return JsonResponse({"error": "Sizda biriktirish huquqi yo'q."}, status=403)
    return None


def _parse_datetime(value):
    if not value:
        return None
    # Accept 'YYYY-MM-DD HH:MM' or ISO-ish 'YYYY-MM-DDTHH:MM'
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M", "%Y-%m-%dT%H:%M:%S"):
        try:
            return timezone.make_aware(timezone.datetime.strptime(value, fmt))
        except ValueError:
            continue
    try:
        dt = timezone.datetime.fromisoformat(value)
        return timezone.make_aware(dt) if timezone.is_naive(dt) else dt
    except ValueError:
        return None


def _serialize_question(question: Question):
    return {
        "id": question.id,
        "text": question.text,
        "options": [
            {"value": "1", "label": question.option1},
            {"value": "2", "label": question.option2},
            {"value": "3", "label": question.option3},
            {"value": "4", "label": question.option4},
        ],
        "score": question.score,
    }


def _serialize_question_for_edit(question: Question):
    return {
        "id": question.id,
        "text": question.text,
        "option1": question.option1,
        "option2": question.option2,
        "option3": question.option3,
        "option4": question.option4,
        "correct_answer": str(question.correct_answer),
        "score": question.score,
    }


def _to_int(value, default: int, min_value: int | None = None, max_value: int | None = None) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    if min_value is not None and parsed < min_value:
        parsed = min_value
    if max_value is not None and parsed > max_value:
        parsed = max_value
    return parsed


def _teacher_course_queryset(request):
    role = get_user_role(request.user, request.session)
    qs = Course.objects.select_related("teacher").order_by("-created_at")
    if role == Role.TEACHER and not _has_global_admin_access(request):
        qs = qs.filter(teacher=request.user)
    return qs


def _has_global_admin_access(request) -> bool:
    # Global access for platform-level admins even when active_role is switched.
    return bool(
        request.user.is_superuser or getattr(request.user, "role", None) == Role.SUPER_ADMIN
    )


def _can_manage_course(request, course: Course) -> bool:
    role = get_user_role(request.user, request.session)
    if _has_global_admin_access(request):
        return True
    if role == Role.TEACHER:
        return course.teacher_id == request.user.id
    # Academic board/super can manage any when allowed by can_manage_course_content().
    return True


def _serialize_section_for_manage(section: Section):
    return {
        "id": section.id,
        "name": section.name,
        "description": section.description,
        "order": section.order,
        "is_published": section.is_published,
        "unlock_mode": section.unlock_mode,
        "prerequisite_section_id": section.prerequisite_section_id,
    }


@require_POST
def teacher_course_create(request):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    has_files = len(request.FILES) > 0
    if has_files or request.content_type == 'multipart/form-data':
        data = request.POST
    else:
        data = _json_body(request)

    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    if not title:
        return JsonResponse({"error": "title shart."}, status=400)

    deadline = data.get("deadline")
    deadline_date = None
    if deadline:
        try:
            deadline_date = timezone.datetime.fromisoformat(str(deadline)).date()
        except ValueError:
            deadline_date = None

    course = Course.objects.create(
        title=title,
        description=description,
        deadline=deadline_date,
        is_active=str(data.get("is_active", True)).lower() == "true",
        teacher=request.user,
        image_url=(data.get("image_url") or "").strip() or None,
        image=request.FILES.get("image")
    )
    return JsonResponse({"success": True, "course_id": course.id, "manage_path": f"/courses/{course.id}/manage"})


@require_GET
def teacher_course_manage(request, course_id: int):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    course = get_object_or_404(Course.objects.select_related("teacher"), id=course_id)
    if not _can_manage_course(request, course):
        return JsonResponse({"error": "Bu kurs sizga tegishli emas."}, status=403)

    sections = list(Section.objects.filter(course=course).order_by("order"))
    section_ids = [s.id for s in sections]
    resources = (
        SectionResource.objects.filter(section_id__in=section_ids)
        .select_related("section")
        .prefetch_related("folder_files", "chapters", "glossary_entries")
        .order_by("section_id", "order")
    )
    resources_by_section = {}
    for resource in resources:
        resources_by_section.setdefault(resource.section_id, []).append(_serialize_resource(resource))

    assignments = Assignment.objects.filter(course=course).select_related("section").order_by("deadline", "-created_at")
    assignments_by_section = {}
    for assignment in assignments:
        assignments_by_section.setdefault(assignment.section_id or 0, []).append(_serialize_assignment(assignment))

    tests = Test.objects.filter(course=course).select_related("section", "course").order_by("section_id", "-created_at")
    tests_by_section = {}
    for test in tests:
        tests_by_section.setdefault(test.section_id or 0, []).append(_serialize_test(test))

    meetings = CourseMeeting.objects.filter(course=course).select_related("section").order_by("section_id", "start_time")
    meetings_by_section = {}
    for meeting in meetings:
        meetings_by_section.setdefault(meeting.section_id or 0, []).append(_serialize_meeting(meeting))

    enrollments = []
    if can_manage_enrollments(request.user, request.session):
        enrollments_qs = Enrollment.objects.filter(course=course).select_related("student", "student__student_profile").order_by("student__username")
        for enrollment in enrollments_qs[:500]:
            profile = getattr(enrollment.student, "student_profile", None)
            enrollments.append({
                "id": enrollment.id,
                "student_id": enrollment.student_id,
                "username": enrollment.student.username,
                "full_name": (profile.full_name if profile else "") or (enrollment.student.get_full_name() or enrollment.student.username),
                "group_name": (profile.group_name if profile else "") or "",
                "student_id_number": (profile.student_id_number if profile else "") or "",
            })

    # Certificates
    certificate_templates = CertificateTemplate.objects.filter(course=course, is_active=True).order_by("-created_at")
    certificate_triggers = CertificateTrigger.objects.filter(course=course).select_related("template", "target_section", "target_test")

    return JsonResponse({
        "course": _serialize_course(course),
        "permissions": {
            "can_manage_courses": True,
            "can_manage_enrollments": can_manage_enrollments(request.user, request.session),
        },
        "sections": [
            {
                **_serialize_section_for_manage(section),
                "resources": resources_by_section.get(section.id, []),
                "tests": tests_by_section.get(section.id, []),
                "meetings": meetings_by_section.get(section.id, []),
                "assignments": assignments_by_section.get(section.id, []),
            }
            for section in sections
        ],
        "orphans": {
            "tests": tests_by_section.get(0, []),
            "meetings": meetings_by_section.get(0, []),
            "assignments": assignments_by_section.get(0, []),
        },
        "enrollments": enrollments,
        "certificates": {
            "templates": [
                {
                    "id": t.id,
                    "name": t.name,
                    "institution_name": t.institution_name,
                    "issued_by": t.issued_by,
                    "position": t.position,
                    "hours_per_course": t.hours_per_course,
                    "docx_file": t.docx_file.url if t.docx_file else None,
                }
                for t in certificate_templates
            ],
            "triggers": [
                {
                    "id": tr.id,
                    "template_id": tr.template_id,
                    "trigger_type": tr.trigger_type,
                    "target_section_id": tr.target_section_id,
                    "target_test_id": tr.target_test_id,
                    "min_score_percentage": tr.min_score_percentage,
                }
                for tr in certificate_triggers
            ]
        }
    })


@require_POST
def teacher_enrollment_add(request, course_id: int):
    deny = _require_can_manage_enrollments(request)
    if deny:
        return deny

    from users.models import StudentProfile, User

    course = get_object_or_404(Course, id=course_id)
    payload = _json_body(request)
    student_id_number = (payload.get("student_id_number") or "").strip()
    username = (payload.get("username") or "").strip()

    user = None
    if username:
        user = User.objects.filter(username=username).first()
    if user is None and student_id_number:
        profile = StudentProfile.objects.filter(student_id_number=student_id_number).select_related("user").first()
        user = profile.user if profile else None

    if user is None:
        return JsonResponse({"error": "Talaba topilmadi."}, status=404)

    if Enrollment.objects.filter(course=course, student=user).exists():
        return JsonResponse({"error": "Talaba allaqachon biriktirilgan."}, status=400)

    enrollment = Enrollment.objects.create(course=course, student=user)
    profile = getattr(user, "student_profile", None)
    return JsonResponse({
        "success": True,
        "enrollment": {
            "id": enrollment.id,
            "student_id": user.id,
            "username": user.username,
            "full_name": (profile.full_name if profile else "") or (user.get_full_name() or user.username),
            "group_name": (profile.group_name if profile else "") or "",
            "student_id_number": (profile.student_id_number if profile else "") or "",
        },
    })


@require_POST
def teacher_enrollment_delete(request, enrollment_id: int):
    deny = _require_can_manage_enrollments(request)
    if deny:
        return deny

    enrollment = get_object_or_404(Enrollment, id=enrollment_id)
    if not _can_manage_course(request, enrollment.course):
        return JsonResponse({"error": "Bu kurs sizga tegishli emas."}, status=403)
    enrollment.delete()
    return JsonResponse({"success": True})


@require_GET
def teacher_enrollment_search(request, course_id: int):
    deny = _require_can_manage_enrollments(request)
    if deny:
        return deny

    from users.models import User

    course = get_object_or_404(Course, id=course_id)
    query = (request.GET.get("q") or "").strip()
    group = (request.GET.get("group") or "").strip()

    enrolled_ids = Enrollment.objects.filter(course=course).values_list("student_id", flat=True)
    qs = User.objects.filter(role=User.Role.STUDENT).exclude(id__in=enrolled_ids).select_related("student_profile")

    if group:
        qs = qs.filter(student_profile__group_name=group)
    if query:
        qs = qs.filter(
            models.Q(student_profile__full_name__icontains=query)
            | models.Q(username__icontains=query)
            | models.Q(student_profile__student_id_number__icontains=query)
            | models.Q(student_profile__group_name__icontains=query)
        )

    items = []
    for user in qs.order_by("student_profile__full_name")[:30]:
        profile = getattr(user, "student_profile", None)
        items.append({
            "id": user.id,
            "username": user.username,
            "full_name": (profile.full_name if profile else "") or (user.get_full_name() or user.username),
            "group_name": (profile.group_name if profile else "") or "",
            "student_id_number": (profile.student_id_number if profile else "") or "",
        })

    return JsonResponse({"items": items})


def _can_manage_assignment_for_course(request, course: Course) -> bool:
    role = get_user_role(request.user, request.session)
    if role not in (Role.TEACHER, Role.SUPER_ADMIN, Role.ACADEMIC_BOARD):
        return False
    if request.user.is_superuser:
        return True
    if role == Role.TEACHER:
        return course.teacher_id == request.user.id
    return True


@require_POST
def teacher_assignment_create(request, course_id: int):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    course = get_object_or_404(Course, id=course_id)
    if not _can_manage_assignment_for_course(request, course):
        return JsonResponse({"error": "Sizda topshiriq yaratish huquqi yo'q."}, status=403)

    payload = _json_body(request)
    title = (payload.get("title") or "").strip()
    description = (payload.get("description") or "").strip()
    if not title:
        return JsonResponse({"error": "title shart."}, status=400)

    section_id = payload.get("section_id")
    if section_id is not None and str(section_id).strip().isdigit():
        section_id = int(section_id)
        if not Section.objects.filter(pk=section_id, course=course).exists():
            section_id = None
    else:
        section_id = None

    deadline = _parse_datetime(payload.get("deadline"))
    assignment = Assignment.objects.create(
        course=course,
        section_id=section_id,
        title=title,
        description=description,
        max_score=int(payload.get("max_score") or 100),
        deadline=deadline,
        is_active=bool(payload.get("is_active", True)),
        allow_late=bool(payload.get("allow_late", False)),
    )

    enrollments = Enrollment.objects.filter(course=course)
    notifications = [
        Notification(
            user=enrollment.student,
            title="Yangi topshiriq!",
            message=f"{course.title} kursida yangi topshiriq: {assignment.title}",
            link=f"/assignments/{assignment.id}",
        )
        for enrollment in enrollments
    ]
    Notification.objects.bulk_create(notifications)

    return JsonResponse({"success": True, "assignment": _serialize_assignment(assignment)})


@require_POST
def teacher_assignment_update(request, assignment_id: int):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    assignment = get_object_or_404(Assignment.objects.select_related("course"), id=assignment_id)
    if not _can_manage_assignment_for_course(request, assignment.course):
        return JsonResponse({"error": "Sizda topshiriqni tahrirlash huquqi yo'q."}, status=403)

    payload = _json_body(request)
    if "title" in payload:
        assignment.title = (payload.get("title") or assignment.title).strip() or assignment.title
    if "description" in payload:
        assignment.description = (payload.get("description") or "").strip()
    if "max_score" in payload:
        assignment.max_score = int(payload.get("max_score") or assignment.max_score)
    if "deadline" in payload:
        deadline = payload.get("deadline")
        assignment.deadline = _parse_datetime(deadline) if deadline else None
    if "is_active" in payload:
        assignment.is_active = bool(payload.get("is_active"))
    if "allow_late" in payload:
        assignment.allow_late = bool(payload.get("allow_late"))
    if "section_id" in payload:
        section_id = payload.get("section_id")
        if section_id is not None and str(section_id).strip().isdigit():
            section_id = int(section_id)
            if not Section.objects.filter(pk=section_id, course=assignment.course).exists():
                section_id = None
        else:
            section_id = None
        assignment.section_id = section_id

    assignment.save()
    return JsonResponse({"success": True, "assignment": _serialize_assignment(assignment)})


@require_POST
def teacher_assignment_delete(request, assignment_id: int):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    assignment = get_object_or_404(Assignment.objects.select_related("course"), id=assignment_id)
    if not _can_manage_assignment_for_course(request, assignment.course):
        return JsonResponse({"error": "Sizda o'chirish huquqi yo'q."}, status=403)
    assignment.delete()
    return JsonResponse({"success": True})


@require_POST
def teacher_resource_update(request, resource_id: int):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    resource = get_object_or_404(SectionResource.objects.select_related("section", "section__course"), id=resource_id)
    if not _can_manage_course(request, resource.section.course):
        return JsonResponse({"error": "Bu kurs sizga tegishli emas."}, status=403)

    payload = _json_body(request)
    if "title" in payload:
        title = (payload.get("title") or "").strip()
        if title:
            resource.title = title
    if "description" in payload:
        resource.description = (payload.get("description") or "").strip()
    if "is_visible" in payload:
        resource.is_visible = _coerce_bool(payload.get("is_visible"), default=resource.is_visible)
    if "require_completion" in payload:
        resource.require_completion = _coerce_bool(payload.get("require_completion"), default=resource.require_completion)
    if "estimated_time_minutes" in payload:
        resource.estimated_time_minutes = _coerce_int(payload.get("estimated_time_minutes"))

    if resource.resource_type in (
        SectionResourceType.LINK,
        SectionResourceType.VIDEO,
        SectionResourceType.AUDIO,
        SectionResourceType.EMBED,
    ):
        if "url" in payload:
            resource.url = (payload.get("url") or "").strip() or None
        if "open_in_new_tab" in payload:
            resource.open_in_new_tab = _coerce_bool(payload.get("open_in_new_tab"), default=resource.open_in_new_tab)

    if resource.resource_type in (SectionResourceType.TEXT, SectionResourceType.BOOK):
        if "content" in payload:
            resource.content = (payload.get("content") or "").strip()

    if resource.resource_type == SectionResourceType.VIDEO:
        if "video_source" in payload:
            resource.video_source = (payload.get("video_source") or "url").strip() or "url"
        if "video_poster_url" in payload:
            resource.video_poster_url = (payload.get("video_poster_url") or "").strip() or None

    if resource.resource_type == SectionResourceType.AUDIO and "audio_transcript" in payload:
        resource.audio_transcript = payload.get("audio_transcript") or ""

    if resource.resource_type == SectionResourceType.H5P and "h5p_embed_code" in payload:
        resource.h5p_embed_code = payload.get("h5p_embed_code") or ""

    if resource.resource_type == SectionResourceType.SCORM:
        if "scorm_version" in payload:
            resource.scorm_version = (payload.get("scorm_version") or "").strip()
        if "scorm_entry_url" in payload:
            resource.scorm_entry_url = (payload.get("scorm_entry_url") or "").strip()

    if resource.resource_type == SectionResourceType.EMBED:
        if "embed_width" in payload:
            resource.embed_width = (payload.get("embed_width") or "").strip() or "100%"
        if "embed_height" in payload:
            resource.embed_height = (payload.get("embed_height") or "").strip() or "500px"

    resource.save()
    return JsonResponse({"success": True, "resource": _serialize_resource(resource)})


@require_POST
def teacher_resource_replace_file(request, resource_id: int):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    resource = get_object_or_404(SectionResource.objects.select_related("section", "section__course"), id=resource_id)
    if not _can_manage_course(request, resource.section.course):
        return JsonResponse({"error": "Bu kurs sizga tegishli emas."}, status=403)
    if resource.resource_type not in (
        SectionResourceType.FILE,
        SectionResourceType.AUDIO,
        SectionResourceType.VIDEO,
        SectionResourceType.SCORM,
    ):
        return JsonResponse({"error": "Bu resurs turi uchun fayl almashtirish mavjud emas."}, status=400)

    uploaded_file = request.FILES.get("file")
    if not uploaded_file:
        return JsonResponse({"error": "file shart."}, status=400)

    mime_type, _ = mimetypes.guess_type(uploaded_file.name)
    resource.file = uploaded_file
    resource.original_filename = uploaded_file.name
    resource.file_size = uploaded_file.size
    resource.mime_type = mime_type or ""
    if resource.resource_type == SectionResourceType.VIDEO:
        resource.video_source = "file"
    resource.save(update_fields=["file", "original_filename", "file_size", "mime_type", "video_source"])
    return JsonResponse({"success": True, "resource": _serialize_resource(resource)})


@require_POST
def teacher_course_update(request, course_id: int):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    course = get_object_or_404(Course, id=course_id)
    if not _can_manage_course(request, course):
        return JsonResponse({"error": "Bu kurs sizga tegishli emas."}, status=403)

    has_files = len(request.FILES) > 0
    if has_files or request.content_type == 'multipart/form-data':
        payload = request.POST
    else:
        payload = _json_body(request)

    if "title" in payload:
        title = (payload.get("title") or "").strip()
        if title:
            course.title = title
    if "description" in payload:
        course.description = (payload.get("description") or "").strip()
    if "is_active" in payload:
        val = payload.get("is_active")
        course.is_active = str(val).lower() == "true" if isinstance(val, str) else bool(val)

    if "image_url" in payload:
        course.image_url = (payload.get("image_url") or "").strip() or None
    if "image" in request.FILES:
        course.image = request.FILES["image"]

    deadline = payload.get("deadline")
    if deadline is not None:
        if str(deadline).strip() == "":
            course.deadline = None
        else:
            try:
                # Handle possible ISO string from Frontend
                ds = str(deadline).split("T")[0]
                course.deadline = timezone.datetime.fromisoformat(ds).date()
            except ValueError:
                pass

    course.save()
    return JsonResponse({"success": True})


@require_POST
def teacher_course_delete(request, course_id: int):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    course = get_object_or_404(Course, id=course_id)
    if not _can_manage_course(request, course):
        return JsonResponse({"error": "Bu kurs sizga tegishli emas."}, status=403)
    course.delete()
    return JsonResponse({"success": True})


@require_POST
def teacher_section_create(request, course_id: int):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    course = get_object_or_404(Course, id=course_id)
    if not _can_manage_course(request, course):
        return JsonResponse({"error": "Bu kurs sizga tegishli emas."}, status=403)

    payload = _json_body(request)
    name = (payload.get("name") or "Yangi bo'lim").strip()
    description = (payload.get("description") or "").strip()
    is_published = bool(payload.get("is_published", True))
    unlock_mode = (payload.get("unlock_mode") or "open").strip() or "open"
    prereq_id = payload.get("prerequisite_section_id")
    prerequisite_section_id = None
    if prereq_id is not None and str(prereq_id).strip().isdigit():
        cand = int(prereq_id)
        if Section.objects.filter(pk=cand, course=course).exists():
            prerequisite_section_id = cand

    next_order = (Section.objects.filter(course=course).aggregate(max_order=models.Max("order")).get("max_order") or 0) + 1
    section = Section.objects.create(
        course=course,
        name=name,
        description=description,
        is_published=is_published,
        unlock_mode=unlock_mode,
        prerequisite_section_id=prerequisite_section_id,
        order=next_order,
    )
    return JsonResponse({"success": True, "section": _serialize_section_for_manage(section)})


@require_POST
def teacher_section_update(request, section_id: int):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    section = get_object_or_404(Section.objects.select_related("course"), id=section_id)
    if not _can_manage_course(request, section.course):
        return JsonResponse({"error": "Bu kurs sizga tegishli emas."}, status=403)

    payload = _json_body(request)
    if "name" in payload:
        section.name = (payload.get("name") or section.name).strip() or section.name
    if "description" in payload:
        section.description = (payload.get("description") or "").strip()
    if "is_published" in payload:
        section.is_published = bool(payload.get("is_published"))
    if "unlock_mode" in payload:
        section.unlock_mode = (payload.get("unlock_mode") or "open").strip() or "open"
    if "prerequisite_section_id" in payload:
        prereq_id = payload.get("prerequisite_section_id")
        prerequisite_section_id = None
        if prereq_id is not None and str(prereq_id).strip().isdigit():
            cand = int(prereq_id)
            if Section.objects.filter(pk=cand, course=section.course).exists():
                prerequisite_section_id = cand
        section.prerequisite_section_id = prerequisite_section_id

    section.save()
    return JsonResponse({"success": True, "section": _serialize_section_for_manage(section)})


@require_POST
def teacher_section_delete(request, section_id: int):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    section = get_object_or_404(Section.objects.select_related("course"), id=section_id)
    if not _can_manage_course(request, section.course):
        return JsonResponse({"error": "Bu kurs sizga tegishli emas."}, status=403)
    section.delete()
    return JsonResponse({"success": True})


@require_POST
def teacher_sections_reorder(request, course_id: int):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    course = get_object_or_404(Course, id=course_id)
    if not _can_manage_course(request, course):
        return JsonResponse({"error": "Bu kurs sizga tegishli emas."}, status=403)

    payload = _json_body(request)
    section_ids = payload.get("order")
    if not isinstance(section_ids, list):
        return JsonResponse({"error": "order list bo'lishi kerak."}, status=400)
    for idx, sid in enumerate(section_ids, start=1):
        try:
            Section.objects.filter(id=int(sid), course=course).update(order=idx)
        except (TypeError, ValueError):
            continue
    return JsonResponse({"success": True})


@require_GET
def teacher_resource_stats(request, resource_id: int):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    resource = get_object_or_404(SectionResource.objects.select_related("section__course"), id=resource_id)
    if not _can_manage_course(request, resource.section.course):
        return JsonResponse({"error": "Ruxsat yo'q."}, status=403)

    views = ResourceView.objects.filter(resource=resource).select_related("student")
    total_enrolled = Enrollment.objects.filter(course=resource.section.course).count()
    completed_count = views.filter(is_completed=True).count()
    viewed_count = views.count()
    avg_time = views.aggregate(avg=models.Avg("time_spent_seconds"))["avg"] or 0

    return JsonResponse({
        "success": True,
        "total_enrolled": total_enrolled,
        "viewed_count": viewed_count,
        "completed_count": completed_count,
        "completion_rate": round(completed_count / total_enrolled * 100, 1) if total_enrolled else 0,
        "avg_time_seconds": round(avg_time),
        "students": [
            {
                "id": rv.student.id,
                "name": rv.student.get_full_name() or rv.student.username,
                "view_count": rv.view_count,
                "is_completed": rv.is_completed,
                "completed_at": rv.completed_at.isoformat() if rv.completed_at else None,
                "time_spent_seconds": rv.time_spent_seconds,
            }
            for rv in views
        ]
    })


@require_POST
def teacher_resource_create(request, section_id: int):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    section = get_object_or_404(Section.objects.select_related("course"), id=section_id)
    if not _can_manage_course(request, section.course):
        return JsonResponse({"error": "Bu kurs sizga tegishli emas."}, status=403)

    is_multipart = bool(request.content_type and "multipart" in request.content_type)
    payload = {} if is_multipart else _json_body(request)
    resource_type = ((request.POST.get("resource_type") if is_multipart else payload.get("resource_type")) or "").strip()
    title = ((request.POST.get("title") if is_multipart else payload.get("title")) or "").strip()
    description = ((request.POST.get("description") if is_multipart else payload.get("description")) or "").strip()
    if not title:
        return JsonResponse({"error": "title shart."}, status=400)

    allowed_types = (
        SectionResourceType.FILE,
        SectionResourceType.LINK,
        SectionResourceType.VIDEO,
        SectionResourceType.TEXT,
        SectionResourceType.AUDIO,
        SectionResourceType.EMBED,
        SectionResourceType.H5P,
        SectionResourceType.SCORM,
        SectionResourceType.FOLDER,
        SectionResourceType.BOOK,
        SectionResourceType.GLOSSARY,
        SectionResourceType.CERTIFICATE,
    )
    if resource_type not in allowed_types:
        return JsonResponse({"error": "resource_type noto'g'ri."}, status=400)

    next_order = (SectionResource.objects.filter(section=section).aggregate(max_order=models.Max("order")).get("max_order") or 0) + 1
    resource = SectionResource(
        section=section,
        title=title,
        description=description,
        resource_type=resource_type,
        order=next_order,
        require_completion=_coerce_bool(request.POST.get("require_completion") if is_multipart else payload.get("require_completion")),
        estimated_time_minutes=_coerce_int(request.POST.get("estimated_time_minutes") if is_multipart else payload.get("estimated_time_minutes")),
        is_visible=_coerce_bool(request.POST.get("is_visible") if is_multipart else payload.get("is_visible"), default=True),
    )

    if resource_type == SectionResourceType.FILE:
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return JsonResponse({"error": "file shart."}, status=400)
        mime_type, _ = mimetypes.guess_type(uploaded_file.name)
        resource.file = uploaded_file
        resource.original_filename = uploaded_file.name
        resource.file_size = uploaded_file.size
        resource.mime_type = mime_type or ""
    elif resource_type == SectionResourceType.LINK:
        url = ((request.POST.get("url") if is_multipart else payload.get("url")) or "").strip()
        if not url:
            return JsonResponse({"error": "url shart."}, status=400)
        resource.url = url
        resource.open_in_new_tab = _coerce_bool(request.POST.get("open_in_new_tab") if is_multipart else payload.get("open_in_new_tab"), default=True)
    elif resource_type == SectionResourceType.VIDEO:
        resource.video_source = (((request.POST.get("video_source") if is_multipart else payload.get("video_source")) or "url").strip() or "url")
        resource.video_poster_url = (((request.POST.get("video_poster_url") if is_multipart else payload.get("video_poster_url")) or "").strip() or None)
        if resource.video_source == "file":
            uploaded_file = request.FILES.get("file")
            if not uploaded_file:
                return JsonResponse({"error": "video fayli shart."}, status=400)
            mime_type, _ = mimetypes.guess_type(uploaded_file.name)
            resource.file = uploaded_file
            resource.original_filename = uploaded_file.name
            resource.file_size = uploaded_file.size
            resource.mime_type = mime_type or ""
        else:
            url = ((request.POST.get("url") if is_multipart else payload.get("url")) or "").strip()
            if not url:
                return JsonResponse({"error": "url shart."}, status=400)
            resource.url = url
    elif resource_type == SectionResourceType.TEXT:
        content = ((request.POST.get("content") if is_multipart else payload.get("content")) or "").strip()
        if not content:
            return JsonResponse({"error": "content shart."}, status=400)
        resource.content = content
    elif resource_type == SectionResourceType.AUDIO:
        uploaded_file = request.FILES.get("file")
        url = ((request.POST.get("url") if is_multipart else payload.get("url")) or "").strip()
        if not uploaded_file and not url:
            return JsonResponse({"error": "audio file yoki url shart."}, status=400)
        if uploaded_file:
            mime_type, _ = mimetypes.guess_type(uploaded_file.name)
            resource.file = uploaded_file
            resource.original_filename = uploaded_file.name
            resource.file_size = uploaded_file.size
            resource.mime_type = mime_type or ""
        if url:
            resource.url = url
        resource.audio_transcript = (request.POST.get("audio_transcript") if is_multipart else payload.get("audio_transcript")) or ""
    elif resource_type == SectionResourceType.EMBED:
        url = ((request.POST.get("url") if is_multipart else payload.get("url")) or "").strip()
        if not url:
            return JsonResponse({"error": "url shart."}, status=400)
        resource.url = url
        resource.open_in_new_tab = _coerce_bool(request.POST.get("open_in_new_tab") if is_multipart else payload.get("open_in_new_tab"), default=True)
        resource.embed_width = (((request.POST.get("embed_width") if is_multipart else payload.get("embed_width")) or "100%").strip() or "100%")
        resource.embed_height = (((request.POST.get("embed_height") if is_multipart else payload.get("embed_height")) or "500px").strip() or "500px")
    elif resource_type == SectionResourceType.H5P:
        resource.h5p_embed_code = ((request.POST.get("h5p_embed_code") if is_multipart else payload.get("h5p_embed_code")) or "").strip()
        if not resource.h5p_embed_code.strip():
            return JsonResponse({"error": "h5p_embed_code shart."}, status=400)
    elif resource_type == SectionResourceType.SCORM:
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return JsonResponse({"error": "SCORM zip fayli shart."}, status=400)
        
        resource.file = uploaded_file
        resource.original_filename = uploaded_file.name
        resource.file_size = uploaded_file.size
        resource.scorm_version = ((request.POST.get("scorm_version") if is_multipart else payload.get("scorm_version")) or "1.2").strip()
        
        # Auto-extract SCORM if it's a zip
        if uploaded_file.name.lower().endswith('.zip'):
            resource.save() # Save to get ID and file path
            try:
                extract_path = os.path.join(settings.MEDIA_ROOT, 'scorm', str(resource.id))
                os.makedirs(extract_path, exist_ok=True)
                with zipfile.ZipFile(resource.file.path, 'r') as zip_ref:
                    zip_ref.extractall(extract_path)
                
                # Try to find entry point
                entry_url = ""
                potential_entries = ['index.html', 'index.htm', 'launcher.html', 'default.html']
                for root, dirs, files in os.walk(extract_path):
                    for f in files:
                        if f.lower() in potential_entries:
                            rel_dir = os.path.relpath(root, extract_path)
                            entry_url = os.path.join(rel_dir, f).replace('\\', '/')
                            if entry_url.startswith('./'): entry_url = entry_url[2:]
                            break
                    if entry_url: break
                
                if entry_url:
                    resource.scorm_entry_url = f"/media/scorm/{resource.id}/{entry_url}"
                    # No need to save here, it will be saved at the end of the function
            except Exception as e:
                print(f"SCORM extraction error: {e}")
    elif resource_type == SectionResourceType.BOOK:
        resource.content = ((request.POST.get("content") if is_multipart else payload.get("content")) or "").strip() or None
    elif resource_type == SectionResourceType.CERTIFICATE:
        resource.url = certificate_api_download_path(section.course_id)

    resource.save()
    return JsonResponse({"success": True, "resource": _serialize_resource(resource)})


@require_POST
def teacher_resource_rename(request, resource_id: int):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    resource = get_object_or_404(SectionResource.objects.select_related("section", "section__course"), id=resource_id)
    if not _can_manage_course(request, resource.section.course):
        return JsonResponse({"error": "Bu kurs sizga tegishli emas."}, status=403)

    payload = _json_body(request)
    title = (payload.get("title") or "").strip()
    if not title:
        return JsonResponse({"error": "title shart."}, status=400)
    resource.title = title
    resource.save(update_fields=["title"])
    return JsonResponse({"success": True, "resource": _serialize_resource(resource)})


@require_POST
def teacher_resource_delete(request, resource_id: int):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    resource = get_object_or_404(SectionResource.objects.select_related("section", "section__course"), id=resource_id)
    if not _can_manage_course(request, resource.section.course):
        return JsonResponse({"error": "Bu kurs sizga tegishli emas."}, status=403)
    resource.delete()
    return JsonResponse({"success": True})


@require_POST
def teacher_resources_reorder(request, section_id: int):
    deny = _require_can_manage_courses(request)
    if deny:
        return deny

    section = get_object_or_404(Section.objects.select_related("course"), id=section_id)
    if not _can_manage_course(request, section.course):
        return JsonResponse({"error": "Bu kurs sizga tegishli emas."}, status=403)

    payload = _json_body(request)
    resource_ids = payload.get("order")
    if not isinstance(resource_ids, list):
        return JsonResponse({"error": "order list bo'lishi kerak."}, status=400)
    for idx, rid in enumerate(resource_ids):
        try:
            SectionResource.objects.filter(id=int(rid), section=section).update(order=idx)
        except (TypeError, ValueError):
            continue
    return JsonResponse({"success": True})


@require_GET
def teacher_courses(request):
    deny = _require_can_manage_tests(request)
    if deny:
        return deny

    courses = _teacher_course_queryset(request)
    return JsonResponse({
        "courses": [
            {"id": course.id, "title": course.title}
            for course in courses
        ],
    })


@require_GET
def teacher_test_detail(request, test_id: int):
    deny = _require_can_manage_tests(request)
    if deny:
        return deny

    test = get_object_or_404(
        Test.objects.select_related("course", "section", "course__teacher"),
        id=test_id,
    )
    if get_user_role(request.user, request.session) == Role.TEACHER and not _has_global_admin_access(request):
        if test.course.teacher_id != request.user.id:
            return JsonResponse({"error": "Bu test sizga tegishli emas."}, status=403)

    sections = list(Section.objects.filter(course=test.course).order_by("order"))
    questions = list(test.questions.order_by("id"))

    return JsonResponse({
        "test": {
            "id": test.id,
            "name": test.name,
            "description": test.description,
            "course_id": test.course_id,
            "section_id": test.section_id,
            "control_type": test.control_type,
            "is_active": test.is_active,
            "start_datetime": _iso(test.start_datetime),
            "end_datetime": _iso(test.end_datetime),
            "duration_minutes": test.duration_minutes,
            "max_score": test.max_score,
            "attempts_allowed": test.attempts_allowed,
            "question_count": test.question_count,
            "is_random_order": test.is_random_order,
            "proctoring_enabled": test.proctoring_enabled,
            "face_id_required": test.face_id_required,
            "max_tab_switches": test.max_tab_switches,
        },
        "course": {"id": test.course_id, "title": test.course.title},
        "sections": [{"id": section.id, "name": section.name} for section in sections],
        "questions": [_serialize_question_for_edit(q) for q in questions],
    })


@require_POST
def teacher_test_create(request):
    deny = _require_can_manage_tests(request)
    if deny:
        return deny

    payload = _json_body(request)
    course_id = int(payload.get("course_id") or 0)
    course = get_object_or_404(Course, id=course_id)

    role = get_user_role(request.user, request.session)
    if role == Role.TEACHER and not _has_global_admin_access(request) and course.teacher_id != request.user.id:
        return JsonResponse({"error": "Bu kurs sizga tegishli emas."}, status=403)

    raw_section_id = payload.get("section_id")
    section_id = None
    if raw_section_id is not None and str(raw_section_id).strip().isdigit():
        section_id = int(raw_section_id)
        if not Section.objects.filter(pk=section_id, course=course).exists():
            section_id = None

    start_dt = _parse_datetime(payload.get("start_datetime")) or timezone.now()
    end_dt = _parse_datetime(payload.get("end_datetime")) or (start_dt + timedelta(hours=1))

    test = Test.objects.create(
        name=(payload.get("name") or "").strip(),
        description=(payload.get("description") or "").strip(),
        is_active=bool(payload.get("is_active")),
        start_datetime=start_dt,
        end_datetime=end_dt,
        duration_minutes=int(payload.get("duration_minutes") or 30),
        max_score=int(payload.get("max_score") or 100),
        course=course,
        section_id=section_id,
        control_type=(payload.get("control_type") or "other"),
        attempts_allowed=int(payload.get("attempts_allowed") or 1),
        question_count=int(payload.get("question_count") or 10),
        is_random_order=bool(payload.get("is_random_order")),
        proctoring_enabled=bool(payload.get("proctoring_enabled")),
        face_id_required=bool(payload.get("face_id_required")),
        max_tab_switches=int(payload.get("max_tab_switches") or 3),
    )

    return JsonResponse({"success": True, "test_id": test.id, "edit_path": f"/tests/{test.id}/edit"})


@require_POST
def teacher_test_update(request, test_id: int):
    deny = _require_can_manage_tests(request)
    if deny:
        return deny

    test = get_object_or_404(Test.objects.select_related("course"), id=test_id)
    role = get_user_role(request.user, request.session)
    if role == Role.TEACHER and not _has_global_admin_access(request) and test.course.teacher_id != request.user.id:
        return JsonResponse({"error": "Bu test sizga tegishli emas."}, status=403)

    payload = _json_body(request)
    test.name = (payload.get("name") or test.name).strip()
    test.description = (payload.get("description") or test.description).strip()
    test.is_active = bool(payload.get("is_active"))
    test.control_type = payload.get("control_type") or test.control_type

    start_dt = _parse_datetime(payload.get("start_datetime")) or test.start_datetime
    end_dt = _parse_datetime(payload.get("end_datetime")) or test.end_datetime
    test.start_datetime = start_dt
    test.end_datetime = end_dt

    test.duration_minutes = int(payload.get("duration_minutes") or test.duration_minutes)
    test.max_score = int(payload.get("max_score") or test.max_score)
    test.attempts_allowed = int(payload.get("attempts_allowed") or test.attempts_allowed)
    test.question_count = int(payload.get("question_count") or test.question_count)
    test.is_random_order = bool(payload.get("is_random_order"))
    test.proctoring_enabled = bool(payload.get("proctoring_enabled"))
    test.face_id_required = bool(payload.get("face_id_required"))
    test.max_tab_switches = int(payload.get("max_tab_switches") or test.max_tab_switches)

    raw_section_id = payload.get("section_id")
    section_id = None
    if raw_section_id is not None and str(raw_section_id).strip().isdigit():
        section_id = int(raw_section_id)
        if not Section.objects.filter(pk=section_id, course=test.course).exists():
            section_id = None
    test.section_id = section_id

    test.save()
    return JsonResponse({"success": True})


@require_POST
def teacher_test_delete(request, test_id: int):
    deny = _require_can_manage_tests(request)
    if deny:
        return deny

    test = get_object_or_404(Test.objects.select_related("course"), id=test_id)
    role = get_user_role(request.user, request.session)
    if role == Role.TEACHER and not _has_global_admin_access(request) and test.course.teacher_id != request.user.id:
        return JsonResponse({"error": "Bu test sizga tegishli emas."}, status=403)

    test.delete()
    return JsonResponse({"success": True})


@require_POST
def teacher_test_questions(request, test_id: int):
    deny = _require_can_manage_tests(request)
    if deny:
        return deny

    test = get_object_or_404(Test.objects.select_related("course"), id=test_id)
    role = get_user_role(request.user, request.session)
    if role == Role.TEACHER and not _has_global_admin_access(request) and test.course.teacher_id != request.user.id:
        return JsonResponse({"error": "Bu test sizga tegishli emas."}, status=403)

    payload = _json_body(request)
    memo_text = (payload.get("memo_text") or "").strip()
    created = []

    if memo_text:
        # Support both "++++" and "+++++" separators from memo import formats.
        blocks = [block.strip() for block in re.split(r"\+{4,}", memo_text) if block.strip()]
        for block in blocks:
            parts = [part.strip() for part in block.split("====") if part.strip()]
            if len(parts) < 3:
                continue

            correct_idx = "1"
            options = []
            for idx, opt in enumerate(parts[1:], start=1):
                if opt.startswith("#"):
                    correct_idx = str(idx)
                    opt = opt[1:].strip()
                options.append(opt)
            while len(options) < 4:
                options.append("")

            q = Question.objects.create(
                test=test,
                text=parts[0],
                option1=options[0],
                option2=options[1],
                option3=options[2],
                option4=options[3],
                correct_answer=correct_idx,
                score=1,
            )
            created.append(_serialize_question_for_edit(q))
    else:
        text = (payload.get("text") or "").strip()
        if not text:
            return JsonResponse({"error": "Savol matni shart."}, status=400)

        q = Question.objects.create(
            test=test,
            text=text,
            option1=(payload.get("option1") or "").strip(),
            option2=(payload.get("option2") or "").strip(),
            option3=(payload.get("option3") or "").strip(),
            option4=(payload.get("option4") or "").strip(),
            correct_answer=str(payload.get("correct_answer") or "1"),
            score=int(payload.get("score") or 1),
        )
        created.append(_serialize_question_for_edit(q))

    return JsonResponse({"success": True, "created": created})


@require_GET
def teacher_test_questions_list(request, test_id: int):
    deny = _require_can_manage_tests(request)
    if deny:
        return deny

    test = get_object_or_404(Test.objects.select_related("course"), id=test_id)
    role = get_user_role(request.user, request.session)
    if role == Role.TEACHER and not _has_global_admin_access(request) and test.course.teacher_id != request.user.id:
        return JsonResponse({"error": "Bu test sizga tegishli emas."}, status=403)

    query = (request.GET.get("q") or "").strip()
    page = _to_int(request.GET.get("page"), default=1, min_value=1)
    page_size = _to_int(request.GET.get("page_size"), default=20, min_value=1, max_value=100)

    qs = Question.objects.filter(test=test).order_by("id")
    if query:
        qs = qs.filter(text__icontains=query)

    total = qs.count()
    start = (page - 1) * page_size
    end = start + page_size
    items = [_serialize_question_for_edit(question) for question in qs[start:end]]

    return JsonResponse({
        "test": {
            "id": test.id,
            "name": test.name,
            "course_id": test.course_id,
            "course_title": test.course.title,
        },
        "query": query,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": (total + page_size - 1) // page_size if total else 0,
        "has_previous": page > 1,
        "has_next": end < total,
        "items": items,
    })


@require_http_methods(["POST"])
def teacher_question_update(request, question_id: int):
    deny = _require_can_manage_tests(request)
    if deny:
        return deny

    question = get_object_or_404(Question.objects.select_related("test", "test__course"), id=question_id)
    role = get_user_role(request.user, request.session)
    if role == Role.TEACHER and not _has_global_admin_access(request) and question.test.course.teacher_id != request.user.id:
        return JsonResponse({"error": "Bu savol sizga tegishli emas."}, status=403)

    payload = _json_body(request)

    if "text" in payload:
        text = (payload.get("text") or "").strip()
        if not text:
            return JsonResponse({"error": "Savol matni bo'sh bo'lishi mumkin emas."}, status=400)
        question.text = text

    for field in ("option1", "option2", "option3", "option4"):
        if field in payload:
            setattr(question, field, (payload.get(field) or "").strip())

    if "correct_answer" in payload:
        correct_answer = str(payload.get("correct_answer") or "").strip()
        if correct_answer not in {"1", "2", "3", "4"}:
            return JsonResponse({"error": "To'g'ri javob 1..4 oralig'ida bo'lishi kerak."}, status=400)
        question.correct_answer = correct_answer

    if "score" in payload:
        score = _to_int(payload.get("score"), default=1, min_value=1)
        question.score = score

    question.save()
    return JsonResponse({"success": True, "question": _serialize_question_for_edit(question)})


@require_POST
def teacher_question_delete(request, question_id: int):
    deny = _require_can_manage_tests(request)
    if deny:
        return deny

    question = get_object_or_404(Question.objects.select_related("test", "test__course"), id=question_id)
    role = get_user_role(request.user, request.session)
    if role == Role.TEACHER and not _has_global_admin_access(request) and question.test.course.teacher_id != request.user.id:
        return JsonResponse({"error": "Bu savol sizga tegishli emas."}, status=403)

    question.delete()
    return JsonResponse({"success": True})


def _serialize_attempt_for_take(test: Test, attempt: TestAttempt, *, questions):
    end_time = get_attempt_end_time(test, attempt)
    remaining_seconds = None
    if end_time:
        remaining = (end_time - timezone.now()).total_seconds()
        remaining_seconds = max(0, int(remaining))
    elif test.duration_minutes:
        remaining_seconds = max(0, int(test.duration_minutes * 60))

    return {
        "id": attempt.id,
        "started_at": _iso(attempt.started_at),
        "end_time": _iso(end_time),
        "remaining_seconds": remaining_seconds,
        "answers": attempt.answers or {},
        "question_order": attempt.question_order or [],
        "per_question_score": calculate_test_score(test, len(questions), 1) if questions else 0,
        "is_completed": attempt.is_completed,
    }


@ensure_csrf_cookie
@require_GET
def test_take_payload(request, test_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    role = get_user_role(request.user, request.session)
    if role != Role.STUDENT:
        return JsonResponse({"error": "Faqat talaba test topshiradi."}, status=403)

    test = get_object_or_404(Test.objects.select_related("course", "section"), id=test_id)
    if not Enrollment.objects.filter(student=request.user, course=test.course).exists():
        return JsonResponse({"error": "Siz ushbu test uchun ro'yxatdan o'tmagansiz."}, status=403)

    student_profile = getattr(request.user, "student_profile", None)
    if not student_profile:
        return JsonResponse({"error": "Talaba profili topilmadi."}, status=403)

    now = timezone.now()
    active_attempt = TestAttempt.objects.filter(student=student_profile, test=test, is_completed=False).order_by("-started_at").first()

    if not test.is_active:
        return JsonResponse({"error": "Bu test hozirda faol emas."}, status=400)
    if not active_attempt and test.start_datetime and test.start_datetime > (now + timedelta(minutes=2)):
        return JsonResponse({"error": "Test hali boshlanmadi."}, status=400)
    if not active_attempt and test.end_datetime and test.end_datetime < now:
        return JsonResponse({"error": "Test muddati tugagan."}, status=400)

    face_verified_key = f"face_verified_{test.id}"
    face_verified = bool(request.session.get(face_verified_key))

    # Create attempt if needed.
    attempt = active_attempt
    if attempt is None:
        completed_count = TestAttempt.objects.filter(student=student_profile, test=test, is_completed=True).count()
        if completed_count >= test.attempts_allowed:
            return JsonResponse({"error": "Urinishlar tugagan."}, status=400)

        question_order = build_test_question_order(test)
        if not question_order:
            return JsonResponse({"error": "Savollar topilmadi."}, status=400)

        attempt = TestAttempt.objects.create(
            student=student_profile,
            test=test,
            question_order=question_order,
            answers={},
        )

    questions = get_questions_from_order(test, attempt.question_order)
    # If student has no real uploaded photo, don't enforce FaceID for this attempt.
    has_face_image = bool(student_profile.image)
    face_image_url = student_profile.image_url if has_face_image else None

    return JsonResponse({
        "role": role,
        "role_label": get_role_label(role),
        "test": _serialize_test(test, student_profile=student_profile),
        "attempt": _serialize_attempt_for_take(test, attempt, questions=questions),
        "questions": [_serialize_question(q) for q in questions],
        "face": {
            "required": bool(test.face_id_required and has_face_image),
            "verified": face_verified,
            "image_url": face_image_url,
        },
        "proctoring": {
            "enabled": bool(test.proctoring_enabled),
            "max_tab_switches": test.max_tab_switches,
        },
    })


@require_POST
def test_face_verify(request, test_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    role = get_user_role(request.user, request.session)
    if role != Role.STUDENT:
        return JsonResponse({"error": "Faqat talaba."}, status=403)

    test = get_object_or_404(Test, id=test_id)
    if not test.face_id_required:
        return JsonResponse({"error": "Bu test uchun Face ID talab qilinmaydi."}, status=400)
    if not Enrollment.objects.filter(student=request.user, course=test.course).exists():
        return JsonResponse({"error": "Siz ushbu test uchun ro'yxatdan o'tmagansiz."}, status=403)

    request.session[f"face_verified_{test.id}"] = True
    return JsonResponse({"success": True})


@require_POST
def test_submit(request, test_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    role = get_user_role(request.user, request.session)
    if role != Role.STUDENT:
        return JsonResponse({"error": "Faqat talaba."}, status=403)

    test = get_object_or_404(Test, id=test_id)
    if not Enrollment.objects.filter(student=request.user, course=test.course).exists():
        return JsonResponse({"error": "Siz ushbu test uchun ro'yxatdan o'tmagansiz."}, status=403)

    student_profile = getattr(request.user, "student_profile", None)
    if not student_profile:
        return JsonResponse({"error": "Talaba profili topilmadi."}, status=403)

    attempt = TestAttempt.objects.filter(student=student_profile, test=test, is_completed=False).order_by("-started_at").first()
    if attempt is None:
        return JsonResponse({"error": "Faol urinish topilmadi."}, status=400)

    if test.face_id_required and not request.session.get(f"face_verified_{test.id}"):
        return JsonResponse({"error": "Face ID tasdiqlanmagan."}, status=400)

    questions = get_questions_from_order(test, attempt.question_order)
    payload = _json_body(request)
    answers_in = payload.get("answers") if isinstance(payload, dict) else None
    if not isinstance(answers_in, dict):
        return JsonResponse({"error": "Answers noto'g'ri formatda."}, status=400)

    answers = {}
    correct_count = 0
    for q in questions:
        raw = answers_in.get(str(q.id)) or answers_in.get(q.id)
        if raw is None:
            answers[str(q.id)] = ""
            continue
        val = str(raw)
        if val not in ("1", "2", "3", "4"):
            val = ""
        answers[str(q.id)] = val
        if val and val == str(q.correct_answer):
            correct_count += 1

    attempt.score = calculate_test_score(test, len(questions), correct_count)
    attempt.correct_count = correct_count
    attempt.answers = answers
    attempt.finished_at = timezone.now()
    attempt.is_completed = True
    attempt.save(update_fields=["score", "correct_count", "answers", "finished_at", "is_completed"])

    return JsonResponse({
        "success": True,
        "result": {
            "score": attempt.score,
            "max_score": test.max_score,
            "correct_count": correct_count,
            "total_questions": len(questions),
        },
        "redirect_url": f"/tests/{test.id}/result",
    })


@require_POST
def proctor_log(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    role = get_user_role(request.user, request.session)
    if role != Role.STUDENT:
        return JsonResponse({"error": "Faqat talaba."}, status=403)

    student_profile = getattr(request.user, "student_profile", None)
    if not student_profile:
        return JsonResponse({"error": "Talaba profili topilmadi."}, status=403)

    payload = _json_body(request)
    attempt_id = payload.get("attempt_id")
    event_type = payload.get("event_type") or payload.get("event")
    details = payload.get("details", {})

    if not attempt_id or not event_type:
        return JsonResponse({"error": "attempt_id va event_type shart."}, status=400)

    attempt = get_object_or_404(TestAttempt, id=attempt_id, student=student_profile)
    ProctorLog.objects.create(
        attempt=attempt,
        test=attempt.test,
        event_type=str(event_type),
        details=details if isinstance(details, dict) else {},
    )

    violations = ProctorLog.objects.filter(
        attempt=attempt,
        event_type__in=["tab_switch", "fullscreen_exit", "face_mismatch", "camera_denied"],
    ).count()

    auto_submit = False
    if violations >= attempt.test.max_tab_switches:
        auto_submit = True
        if not attempt.is_completed:
            questions = get_questions_from_order(attempt.test, attempt.question_order)
            answers_map = attempt.answers or {}
            if not isinstance(answers_map, dict):
                answers_map = {}

            correct_count = 0
            for q in questions:
                val = str(answers_map.get(str(q.id)) or "")
                if val and val == str(q.correct_answer):
                    correct_count += 1

            attempt.score = calculate_test_score(attempt.test, len(questions), correct_count)
            attempt.correct_count = correct_count
            attempt.is_completed = True
            attempt.finished_at = timezone.now()
            attempt.save(update_fields=["score", "correct_count", "is_completed", "finished_at"])

    return JsonResponse({"success": True, "auto_submit": auto_submit, "violations": violations})


def _can_manage_meetings(user, session, course: Course) -> bool:
    role = get_user_role(user, session)
    if role in (Role.SUPER_ADMIN, Role.REGISTRATOR):
        return True
    if user.is_superuser:
        return True
    return course.teacher_id == user.id


@require_GET
def notifications_list(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    page = int(request.GET.get("page") or 1)
    page_size = int(request.GET.get("page_size") or 20)
    page = max(1, page)
    page_size = min(100, max(5, page_size))

    qs = Notification.objects.filter(user=request.user).order_by("-created_at")
    total = qs.count()
    offset = (page - 1) * page_size
    items = list(qs[offset:offset + page_size])
    unread_count = Notification.objects.filter(user=request.user, is_read=False).count()

    return JsonResponse({
        "page": page,
        "page_size": page_size,
        "total": total,
        "unread_count": unread_count,
        "items": [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "link": n.link or "",
                "is_read": n.is_read,
                "created_at": _iso(n.created_at),
            }
            for n in items
        ],
    })


@require_POST
def notification_read(request, notif_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)
    notif = get_object_or_404(Notification, id=notif_id, user=request.user)
    if not notif.is_read:
        notif.is_read = True
        notif.save(update_fields=["is_read"])
    unread_count = Notification.objects.filter(user=request.user, is_read=False).count()
    return JsonResponse({"success": True, "unread_count": unread_count})


@require_POST
def notifications_read_all(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)
    Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
    return JsonResponse({"success": True, "unread_count": 0})


@require_POST
def meeting_create(request, course_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    course = get_object_or_404(Course, id=course_id)
    if not _can_manage_meetings(request.user, request.session, course):
        return JsonResponse({"error": "Sizda dars qo'shish huquqi yo'q."}, status=403)

    payload = _json_body(request)
    title = (payload.get("title") or "").strip()
    meeting_url = (payload.get("meeting_url") or "").strip()
    meeting_type = (payload.get("meeting_type") or "zoom").strip() or "zoom"
    start_time_str = (payload.get("start_time") or "").strip()
    duration = int(payload.get("duration_minutes") or 60)

    if not title or not meeting_url or not start_time_str:
        return JsonResponse({"error": "title, meeting_url, start_time shart."}, status=400)

    section_id = None
    raw_section = payload.get("section_id")
    if raw_section is not None and str(raw_section).strip().isdigit():
        cand = int(raw_section)
        if Section.objects.filter(pk=cand, course=course).exists():
            section_id = cand

    try:
        start_time = timezone.make_aware(timezone.datetime.fromisoformat(start_time_str))
    except ValueError:
        start_time = _parse_datetime(start_time_str)
    if start_time is None:
        return JsonResponse({"error": "start_time noto'g'ri formatda."}, status=400)

    meeting = CourseMeeting.objects.create(
        course=course,
        section_id=section_id,
        title=title,
        meeting_url=meeting_url,
        meeting_type=meeting_type,
        start_time=start_time,
        duration_minutes=duration,
    )

    enrollments = Enrollment.objects.filter(course=course)
    notifications = [
        Notification(
            user=enrollment.student,
            title="Yangi onlayn dars!",
            message=f"{course.title} kursida yangi uchrashuv rejalashtirildi: {meeting.title}",
            link="/notifications",
        )
        for enrollment in enrollments
    ]
    Notification.objects.bulk_create(notifications)

    return JsonResponse({"success": True, "meeting": _serialize_meeting(meeting)})


@require_POST
def meeting_delete(request, meeting_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)
    meeting = get_object_or_404(CourseMeeting.objects.select_related("course"), id=meeting_id)
    if not _can_manage_meetings(request.user, request.session, meeting.course):
        return JsonResponse({"error": "Sizda o'chirish huquqi yo'q."}, status=403)
    meeting.delete()
    return JsonResponse({"success": True})


def _can_access_course(user, session, course: Course) -> bool:
    role = get_user_role(user, session)
    if role == Role.STUDENT:
        return Enrollment.objects.filter(student=user, course=course).exists()
    return True


@require_GET
def forum_topics_list(request, course_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)
    course = get_object_or_404(Course, id=course_id)
    if not _can_access_course(request.user, request.session, course):
        return JsonResponse({"error": "Siz ushbu kursga biriktirilmagansiz."}, status=403)
    topics = ForumTopic.objects.filter(course=course).select_related("author").order_by("-created_at")[:200]
    return JsonResponse({
        "course": {"id": course.id, "title": course.title, "spa_path": f"/courses/{course.id}"},
        "topics": [
            {
                "id": t.id,
                "title": t.title,
                "content": t.content,
                "author_name": t.author.get_full_name() or t.author.username,
                "created_at": _iso(t.created_at),
                "spa_path": f"/forum/topics/{t.id}",
            }
            for t in topics
        ],
    })


@require_POST
def forum_topic_create(request, course_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)
    course = get_object_or_404(Course, id=course_id)
    if not _can_access_course(request.user, request.session, course):
        return JsonResponse({"error": "Siz ushbu kursga biriktirilmagansiz."}, status=403)
    payload = _json_body(request)
    title = (payload.get("title") or "").strip()
    content = (payload.get("content") or "").strip()
    if not title or not content:
        return JsonResponse({"error": "title va content shart."}, status=400)
    section_id = payload.get("section_id")
    if section_id is not None and str(section_id).strip().isdigit():
        section_id = int(section_id)
        if not Section.objects.filter(pk=section_id, course=course).exists():
            section_id = None
    else:
        section_id = None

    topic = ForumTopic.objects.create(
        course=course,
        section_id=section_id,
        author=request.user,
        title=title,
        content=content,
    )

    Notification.objects.create(
        user=course.teacher,
        title="Yangi forum mavzusi",
        message=f"{request.user.get_full_name() or request.user.username} '{course.title}' kursida yangi mavzu ochdi: '{title}'",
        link=f"/forum/topics/{topic.id}",
    )

    return JsonResponse({"success": True, "topic_id": topic.id, "spa_path": f"/forum/topics/{topic.id}"})


@require_GET
def forum_topic_detail(request, topic_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)
    topic = get_object_or_404(ForumTopic.objects.select_related("course", "author", "course__teacher"), id=topic_id)
    if not _can_access_course(request.user, request.session, topic.course):
        return JsonResponse({"error": "Siz ushbu kursga biriktirilmagansiz."}, status=403)
    replies = ForumPost.objects.filter(topic=topic).select_related("author").order_by("created_at")[:500]
    return JsonResponse({
        "topic": {
            "id": topic.id,
            "title": topic.title,
            "content": topic.content,
            "author_name": topic.author.get_full_name() or topic.author.username,
            "created_at": _iso(topic.created_at),
            "course": {"id": topic.course_id, "title": topic.course.title, "spa_path": f"/courses/{topic.course_id}"},
        },
        "replies": [
            {
                "id": r.id,
                "content": r.content,
                "author_name": r.author.get_full_name() or r.author.username,
                "created_at": _iso(r.created_at),
            }
            for r in replies
        ],
    })


@require_POST
def forum_topic_reply(request, topic_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)
    topic = get_object_or_404(ForumTopic.objects.select_related("course", "author", "course__teacher"), id=topic_id)
    if not _can_access_course(request.user, request.session, topic.course):
        return JsonResponse({"error": "Siz ushbu kursga biriktirilmagansiz."}, status=403)
    payload = _json_body(request)
    content = (payload.get("content") or "").strip()
    if not content:
        return JsonResponse({"error": "content bo'sh bo'lishi mumkin emas."}, status=400)

    post = ForumPost.objects.create(topic=topic, author=request.user, content=content)

    if topic.author_id != request.user.id:
        Notification.objects.create(
            user=topic.author,
            title="Mavzungizga yangi javob",
            message=f"{request.user.get_full_name() or request.user.username} sizning '{topic.title}' mavzungizga javob qoldirdi.",
            link=f"/forum/topics/{topic.id}",
        )

    if topic.course.teacher_id not in (request.user.id, topic.author_id):
        Notification.objects.create(
            user=topic.course.teacher,
            title="Forumda yangi faollik",
            message=f"'{topic.course.title}' kursidagi '{topic.title}' mavzusida yangi xabar qoldirildi.",
            link=f"/forum/topics/{topic.id}",
        )

    return JsonResponse({
        "success": True,
        "reply": {
            "id": post.id,
            "content": post.content,
            "author_name": request.user.get_full_name() or request.user.username,
            "created_at": _iso(post.created_at),
        },
    })


def _can_manage_gradebook(user, session, course: Course) -> bool:
    role = get_user_role(user, session)
    if role not in (Role.TEACHER, Role.SUPER_ADMIN):
        return False
    if user.is_superuser:
        return True
    return course.teacher_id == user.id


@require_GET
def student_grades(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)
    role = get_user_role(request.user, request.session)
    if role != Role.STUDENT:
        return JsonResponse({"error": "Faqat talaba."}, status=403)

    enrollments = Enrollment.objects.filter(student=request.user).select_related("course")
    lms_items = []
    for enrollment in enrollments:
        gradebook = CourseGradebook.objects.filter(course=enrollment.course).first()
        entry = None
        if gradebook:
            entry = GradebookEntry.objects.filter(gradebook=gradebook, student=request.user).first()
        lms_items.append({
            "course": {"id": enrollment.course_id, "title": enrollment.course.title, "spa_path": f"/courses/{enrollment.course_id}"},
            "gradebook": {
                "current_max": gradebook.current_max,
                "midterm_max": gradebook.midterm_max,
                "final_max": gradebook.final_max,
            } if gradebook else None,
            "entry": {
                "current": float(entry.current_score) if entry and entry.current_score is not None else None,
                "midterm": float(entry.midterm_score) if entry and entry.midterm_score is not None else None,
                "final": float(entry.final_score) if entry and entry.final_score is not None else None,
                "total": float(entry.total_score) if entry and entry.total_score is not None else None,
                "updated_at": _iso(entry.updated_at) if entry else None,
            } if entry else None,
        })

    # Retake results: keep the same logic but optional.
    retake_items = []
    try:
        from retake.models import ExamSheetEntry, ExamSheetStatus

        snapshot = get_snapshot_for_user(request.user)
        snapshot_ids = [snapshot.id] if snapshot else []

        retake_entries = ExamSheetEntry.objects.filter(
            student_snapshot_id__in=snapshot_ids
        ).select_related(
            "sheet",
            "sheet__assessment_schedule",
            "sheet__assessment_schedule__group__subject_snapshot",
        ) if snapshot_ids else ExamSheetEntry.objects.none()

        for entry in retake_entries:
            if entry.sheet.status in (ExamSheetStatus.SUBMITTED, ExamSheetStatus.LOCKED):
                retake_items.append({
                    "subject_name": entry.sheet.assessment_schedule.group.subject_snapshot.subject_name,
                    "control_type": entry.sheet.assessment_schedule.control_type_label,
                    "score": entry.score,
                    "is_absent": entry.is_absent,
                    "status": entry.sheet.status,
                    "date": _iso(entry.sheet.assessment_schedule.scheduled_at),
                })
    except Exception:
        # Retake is optional here; don't break grades page.
        retake_items = []

    return JsonResponse({"lms": lms_items, "retake": retake_items})


@require_GET
def teacher_gradebook_detail(request, course_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)
    course = get_object_or_404(Course, id=course_id)
    if not _can_manage_gradebook(request.user, request.session, course):
        return JsonResponse({"error": "Sizda qaydnoma huquqi yo'q."}, status=403)

    gradebook, _ = CourseGradebook.objects.get_or_create(course=course)
    enrollments = Enrollment.objects.filter(course=course).select_related("student", "student__student_profile")
    entries = {e.student_id: e for e in GradebookEntry.objects.filter(gradebook=gradebook)}
    students = []
    for enrollment in enrollments:
        student = enrollment.student
        entry = entries.get(student.id)
        profile = getattr(student, "student_profile", None)
        students.append({
            "student_id": student.id,
            "student_name": student.get_full_name() or student.username,
            "student_id_number": getattr(profile, "student_id_number", ""),
            "entry_id": entry.id if entry else None,
            "current": float(entry.current_score) if entry and entry.current_score is not None else None,
            "midterm": float(entry.midterm_score) if entry and entry.midterm_score is not None else None,
            "final": float(entry.final_score) if entry and entry.final_score is not None else None,
            "total": float(entry.total_score) if entry and entry.total_score is not None else None,
        })

    tests = Test.objects.filter(course=course).order_by("-created_at")
    return JsonResponse({
        "course": {"id": course.id, "title": course.title, "spa_path": f"/courses/{course.id}"},
        "gradebook": {
            "current_max": gradebook.current_max,
            "midterm_max": gradebook.midterm_max,
            "final_max": gradebook.final_max,
            "is_locked": gradebook.is_locked,
        },
        "students": students,
        "tests": [{"id": t.id, "name": t.name, "control_type": t.control_type, "max_score": t.max_score} for t in tests],
    })


@require_POST
def teacher_gradebook_setup(request, course_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)
    course = get_object_or_404(Course, id=course_id)
    if not _can_manage_gradebook(request.user, request.session, course):
        return JsonResponse({"error": "Sizda qaydnoma huquqi yo'q."}, status=403)

    gradebook, _ = CourseGradebook.objects.get_or_create(course=course)
    payload = _json_body(request)
    gradebook.current_max = int(payload.get("current_max") or gradebook.current_max)
    gradebook.midterm_max = int(payload.get("midterm_max") or gradebook.midterm_max)
    gradebook.final_max = int(payload.get("final_max") or gradebook.final_max)
    gradebook.save(update_fields=["current_max", "midterm_max", "final_max"])
    return JsonResponse({"success": True})


@require_POST
def teacher_gradebook_save(request, course_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)
    course = get_object_or_404(Course, id=course_id)
    if not _can_manage_gradebook(request.user, request.session, course):
        return JsonResponse({"error": "Sizda qaydnoma huquqi yo'q."}, status=403)

    gradebook = get_object_or_404(CourseGradebook, course=course)
    if gradebook.is_locked:
        return JsonResponse({"error": "Qaydnoma yopilgan."}, status=400)

    payload = _json_body(request)
    items = payload.get("items") if isinstance(payload, dict) else None
    if not isinstance(items, list):
        return JsonResponse({"error": "items noto'g'ri formatda."}, status=400)

    for item in items:
        if not isinstance(item, dict):
            continue
        sid = int(item.get("student_id") or 0)
        if not Enrollment.objects.filter(course=course, student_id=sid).exists():
            continue
        entry, _ = GradebookEntry.objects.get_or_create(gradebook=gradebook, student_id=sid)
        raw_current = item.get("current")
        raw_midterm = item.get("midterm")
        raw_final = item.get("final")
        entry.current_score = Decimal(str(raw_current)) if raw_current is not None and raw_current != "" else None
        entry.midterm_score = Decimal(str(raw_midterm)) if raw_midterm is not None and raw_midterm != "" else None
        entry.final_score = Decimal(str(raw_final)) if raw_final is not None and raw_final != "" else None
        parts = [float(entry.current_score or 0), float(entry.midterm_score or 0), float(entry.final_score or 0)]
        entry.total_score = Decimal(str(round(sum(parts), 2)))
        entry.entered_by = request.user
        entry.save()

    return JsonResponse({"success": True})


@require_POST
def teacher_gradebook_import_test(request, course_id: int, test_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)
    course = get_object_or_404(Course, id=course_id)
    if not _can_manage_gradebook(request.user, request.session, course):
        return JsonResponse({"error": "Sizda qaydnoma huquqi yo'q."}, status=403)

    from django.db.models import Max
    from users.models import StudentProfile

    test = get_object_or_404(Test, id=test_id, course=course)
    gradebook, _ = CourseGradebook.objects.get_or_create(course=course)

    score_field = {
        "current": "current_score",
        "midterm": "midterm_score",
        "final": "final_score",
    }.get(test.control_type)
    if not score_field:
        return JsonResponse({"error": "Test turi aniqlanmadi."}, status=400)

    max_score_val = {
        "current": gradebook.current_max,
        "midterm": gradebook.midterm_max,
        "final": gradebook.final_max,
    }.get(test.control_type, 30)

    attempts = TestAttempt.objects.filter(test=test, is_completed=True).values("student_id").annotate(best_score=Max("score"))
    count = 0
    for row in attempts:
        student_profile = StudentProfile.objects.filter(id=row["student_id"]).first()
        if not student_profile or not student_profile.user_id:
            continue
        user_id = student_profile.user_id
        entry, _ = GradebookEntry.objects.get_or_create(gradebook=gradebook, student_id=user_id)
        raw_score = row["best_score"] or 0
        scaled = round((float(raw_score) / test.max_score) * float(max_score_val), 2) if test.max_score > 0 else 0
        setattr(entry, score_field, Decimal(str(scaled)))
        entry.linked_test = test
        entry.entered_by = request.user
        parts = [float(entry.current_score or 0), float(entry.midterm_score or 0), float(entry.final_score or 0)]
        entry.total_score = Decimal(str(round(sum(parts), 2)))
        entry.save()
        count += 1

    return JsonResponse({"success": True, "imported": count})


@require_GET
def test_result(request, test_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    role = get_user_role(request.user, request.session)
    if role != Role.STUDENT:
        return JsonResponse({"error": "Faqat talaba."}, status=403)

    test = get_object_or_404(Test.objects.select_related("course"), id=test_id)
    if not Enrollment.objects.filter(student=request.user, course=test.course).exists():
        return JsonResponse({"error": "Siz ushbu test uchun ro'yxatdan o'tmagansiz."}, status=403)

    student_profile = getattr(request.user, "student_profile", None)
    if not student_profile:
        return JsonResponse({"error": "Talaba profili topilmadi."}, status=403)

    attempt = (
        TestAttempt.objects.filter(student=student_profile, test=test, is_completed=True)
        .order_by("-finished_at")
        .first()
    )
    if not attempt:
        return JsonResponse({"error": "Natija topilmadi."}, status=404)

    questions = get_questions_from_order(test, attempt.question_order)
    answers_map = attempt.answers or {}
    if not isinstance(answers_map, dict):
        answers_map = {}

    items = []
    for idx, q in enumerate(questions, start=1):
        user_val = str(answers_map.get(str(q.id)) or "")
        correct_val = str(q.correct_answer)
        user_answer_text = getattr(q, f"option{user_val}", "") if user_val in ("1", "2", "3", "4") else ""
        correct_answer_text = getattr(q, f"option{correct_val}", "")
        items.append({
            "number": idx,
            "question_id": q.id,
            "question_text": q.text,
            "user_answer": user_val,
            "user_answer_text": user_answer_text,
            "correct_answer": correct_val,
            "correct_answer_text": correct_answer_text,
            "is_correct": bool(user_val) and user_val == correct_val,
        })

    return JsonResponse({
        "role": role,
        "role_label": get_role_label(role),
        "test": _serialize_test(test, student_profile=student_profile),
        "attempt": {
            "id": attempt.id,
            "score": attempt.score,
            "max_score": test.max_score,
            "correct_count": attempt.correct_count,
            "total_questions": len(questions),
            "finished_at": _iso(attempt.finished_at),
        },
        "items": items,
    })


def _serialize_resource(resource, user=None):
    data = {
        "id": resource.id,
        "title": resource.title,
        "description": resource.description,
        "resource_type": resource.resource_type,
        "resource_type_label": resource.get_resource_type_display(),
        "order": resource.order,
        "is_visible": resource.is_visible,
        "require_completion": resource.require_completion,
        "estimated_time_minutes": resource.estimated_time_minutes,
        "url": resource.url,
        "open_in_new_tab": resource.open_in_new_tab,
        "content": resource.content,
        "file_url": resource.file.url if resource.file else None,
        "original_filename": resource.original_filename,
        "file_size": resource.file_size,
        "mime_type": resource.mime_type,
        "video_source": resource.video_source,
        "video_poster_url": resource.video_poster_url,
        "audio_transcript": resource.audio_transcript,
        "h5p_embed_code": resource.h5p_embed_code,
        "scorm_version": resource.scorm_version,
        "scorm_entry_url": resource.scorm_entry_url,
        "embed_width": resource.embed_width,
        "embed_height": resource.embed_height,
        "view_data": None,
    }
    if resource.resource_type == SectionResourceType.FOLDER:
        data["folder_files"] = [
            {
                "id": folder_file.id,
                "original_filename": folder_file.original_filename,
                "file_url": folder_file.file.url if folder_file.file else None,
                "file_size": folder_file.file_size,
                "mime_type": folder_file.mime_type,
            }
            for folder_file in resource.folder_files.all()
        ]
    if resource.resource_type == SectionResourceType.BOOK:
        data["chapters"] = [
            {
                "id": chapter.id,
                "title": chapter.title,
                "order": chapter.order,
            }
            for chapter in resource.chapters.all()
        ]
    if resource.resource_type == SectionResourceType.GLOSSARY:
        data["glossary_entries"] = [
            {
                "id": entry.id,
                "term": entry.term,
                "definition": entry.definition,
            }
            for entry in resource.glossary_entries.all().order_by("term")
        ]
    if resource.resource_type == SectionResourceType.CERTIFICATE:
        data["certificate_download_url"] = certificate_api_download_path(resource.section.course_id)
        data["certificate_print_url"] = certificate_print_path(resource.section.course_id)
        data["certificate_check_url"] = f"/api/lms/courses/{resource.section.course_id}/certificate/check/"
    if user is not None and getattr(user, "is_authenticated", False):
        try:
            rv = ResourceView.objects.get(resource=resource, student=user)
            data["view_data"] = {
                "view_count": rv.view_count,
                "is_completed": rv.is_completed,
                "completed_at": _iso(rv.completed_at),
                "time_spent_seconds": rv.time_spent_seconds,
            }
        except ResourceView.DoesNotExist:
            data["view_data"] = {
                "view_count": 0,
                "is_completed": False,
                "completed_at": None,
                "time_spent_seconds": 0,
            }
    return data


def _serialize_assignment(assignment, *, student=None):
    submission = None
    if student is not None:
        submission = (
            Submission.objects.filter(assignment=assignment, student=student)
            .order_by("-submitted_at")
            .first()
        )

    return {
        "id": assignment.id,
        "title": assignment.title,
        "description": assignment.description,
        "max_score": assignment.max_score,
        "deadline": _iso(assignment.deadline),
        "is_active": assignment.is_active,
        "allow_late": assignment.allow_late,
        "section_id": assignment.section_id,
        "spa_path": f"/assignments/{assignment.id}",
        "submit_path": f"/api/lms/assignments/{assignment.id}/submit/",
        "latest_submission": {
            "id": submission.id,
            "submitted_at": _iso(submission.submitted_at),
            "file_url": submission.file.url if submission.file else None,
            "score": submission.score,
            "feedback": submission.feedback,
            "graded_at": _iso(submission.graded_at),
        } if submission else None,
    }


def _serialize_meeting(meeting):
    return {
        "id": meeting.id,
        "title": meeting.title,
        "meeting_url": meeting.meeting_url,
        "meeting_type": meeting.meeting_type,
        "start_time": _iso(meeting.start_time),
        "duration_minutes": meeting.duration_minutes,
        "section_id": meeting.section_id,
    }


@require_GET
def course_detail(request, course_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    role = get_user_role(request.user, request.session)
    primary_role = getattr(request.user, "role", None)

    course = get_object_or_404(Course.objects.select_related("teacher"), id=course_id)
    # If session active_role is stale (e.g., stayed STUDENT), but account role is staff/teacher,
    # do not force enrollment-only access for course detail.
    is_student = (
        role == Role.STUDENT
        and primary_role == Role.STUDENT
        and not request.user.is_superuser
    )
    if is_student:
        if not Enrollment.objects.filter(student=request.user, course=course).exists():
            return JsonResponse({"error": "Siz ushbu kursga biriktirilmagansiz."}, status=403)

    sections = list(course.sections.order_by("order"))
    section_ids = [section.id for section in sections]
    completed_ids = set(
        SectionCompletion.objects.filter(student=request.user, section_id__in=section_ids).values_list("section_id", flat=True)
    ) if is_student else set()

    resources = (
        SectionResource.objects.filter(section_id__in=section_ids)
        .select_related("section")
        .prefetch_related("folder_files", "chapters", "glossary_entries")
        .order_by("section_id", "order")
    )
    resources_by_section = {}
    for resource in resources:
        resources_by_section.setdefault(resource.section_id, []).append(_serialize_resource(resource, user=request.user))

    tests = (
        Test.objects.filter(course=course)
        .select_related("section", "course")
        .order_by("start_datetime")
    )
    student_profile = getattr(request.user, "student_profile", None) if is_student else None
    tests_by_section = {}
    for test in tests:
        tests_by_section.setdefault(test.section_id or 0, []).append(_serialize_test(test, student_profile=student_profile))

    assignments = (
        Assignment.objects.filter(course=course)
        .select_related("section")
        .order_by("deadline", "-created_at")
    )
    assignments_by_section = {}
    for assignment in assignments:
        assignments_by_section.setdefault(assignment.section_id or 0, []).append(
            _serialize_assignment(assignment, student=request.user if is_student else None)
        )

    meetings = CourseMeeting.objects.filter(course=course).order_by("start_time")
    meetings_by_section = {}
    for meeting in meetings:
        meetings_by_section.setdefault(meeting.section_id or 0, []).append(_serialize_meeting(meeting))

    # Student sequential locking matches template logic.
    completed_prev = True
    section_payload = []
    for section in sections:
        is_completed = section.id in completed_ids if is_student else False
        is_locked = False
        if is_student and section.unlock_mode == "sequential" and not completed_prev:
            is_locked = True

        section_payload.append({
            "id": section.id,
            "name": section.name,
            "description": section.description,
            "order": section.order,
            "is_published": section.is_published,
            "unlock_mode": section.unlock_mode,
            "prerequisite_section_id": section.prerequisite_section_id,
            "is_completed": is_completed,
            "is_locked": is_locked,
            "resources": resources_by_section.get(section.id, []),
            "tests": tests_by_section.get(section.id, []),
            "assignments": assignments_by_section.get(section.id, []),
            "meetings": meetings_by_section.get(section.id, []),
        })
        completed_prev = is_completed if is_student else True

    # Orphans: not attached to any section
    orphan_section_key = 0
    orphan_payload = {
        "resources": resources_by_section.get(orphan_section_key, []),
        "tests": tests_by_section.get(orphan_section_key, []),
        "assignments": assignments_by_section.get(orphan_section_key, []),
        "meetings": meetings_by_section.get(orphan_section_key, []),
    }

    course_payload = _serialize_course(
        course, student=request.user if is_student else None, completed_ids=completed_ids
    )
    if not course_payload.get("certificate"):
        preview_cert = _get_staff_certificate_preview_info(request, course)
        if preview_cert:
            course_payload = {**course_payload, "certificate": preview_cert}

    return JsonResponse({
        "role": role,
        "role_label": get_role_label(role),
        "course": course_payload,
        "sections": section_payload,
        "orphans": orphan_payload,
    })


@require_POST
def assignment_submit(request, assignment_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    role = get_user_role(request.user, request.session)
    if role != Role.STUDENT:
        return JsonResponse({"error": "Faqat talaba yubora oladi."}, status=403)

    assignment = get_object_or_404(Assignment.objects.select_related("course"), id=assignment_id)
    if not Enrollment.objects.filter(student=request.user, course=assignment.course).exists():
        return JsonResponse({"error": "Siz ushbu kursga biriktirilmagansiz."}, status=403)

    uploaded_file = request.FILES.get("file")
    if not uploaded_file:
        return JsonResponse({"error": "Fayl tanlanmagan."}, status=400)

    submission = Submission.objects.create(
        assignment=assignment,
        student=request.user,
        file=uploaded_file,
        comment=(request.POST.get("comment") or "").strip(),
    )

    return JsonResponse({
        "success": True,
        "submission": {
            "id": submission.id,
            "submitted_at": _iso(submission.submitted_at),
            "file_url": submission.file.url if submission.file else None,
        },
    })


def _can_manage_assignment(user, session, assignment: Assignment) -> bool:
    role = get_user_role(user, session)
    if role not in (Role.TEACHER, Role.SUPER_ADMIN):
        return False
    if user.is_superuser:
        return True
    return assignment.course.teacher_id == user.id


def _serialize_submission(submission: Submission):
    return {
        "id": submission.id,
        "student_id": submission.student_id,
        "student_name": submission.student.get_full_name() or submission.student.username,
        "comment": submission.comment,
        "file_url": submission.file.url if submission.file else None,
        "submitted_at": _iso(submission.submitted_at),
        "score": float(submission.score) if submission.score is not None else None,
        "feedback": submission.feedback,
        "graded_at": _iso(submission.graded_at),
        "status": submission.status,
    }


@require_GET
def assignment_detail(request, assignment_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    assignment = get_object_or_404(
        Assignment.objects.select_related("course", "section", "course__teacher"),
        id=assignment_id,
    )

    role = get_user_role(request.user, request.session)
    if role == Role.STUDENT:
        if not Enrollment.objects.filter(student=request.user, course=assignment.course).exists():
            return JsonResponse({"error": "Siz ushbu kursga biriktirilmagansiz."}, status=403)
        submissions_qs = Submission.objects.filter(assignment=assignment, student=request.user).order_by("-submitted_at")
    else:
        if not _can_manage_assignment(request.user, request.session, assignment):
            return JsonResponse({"error": "Sizda ushbu topshiriqni ko'rish huquqi yo'q."}, status=403)
        submissions_qs = Submission.objects.filter(assignment=assignment).select_related("student").order_by("-submitted_at")

    submissions = [_serialize_submission(sub) for sub in submissions_qs[:200]]

    return JsonResponse({
        "role": role,
        "role_label": get_role_label(role),
        "assignment": _serialize_assignment(assignment, student=request.user if role == Role.STUDENT else None),
        "course": {
            "id": assignment.course_id,
            "title": assignment.course.title,
            "spa_path": f"/courses/{assignment.course_id}",
        },
        "submissions": submissions,
        "permissions": {
            "can_grade": role in (Role.TEACHER, Role.SUPER_ADMIN) and _can_manage_assignment(request.user, request.session, assignment),
        },
    })


@require_POST
def submission_grade(request, submission_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Autentifikatsiya talab qilinadi."}, status=401)

    submission = get_object_or_404(
        Submission.objects.select_related("assignment", "assignment__course"),
        id=submission_id,
    )
    assignment = submission.assignment

    if not _can_manage_assignment(request.user, request.session, assignment):
        return JsonResponse({"error": "Sizda baholash huquqi yo'q."}, status=403)

    raw_score = (request.POST.get("score") or "").strip()
    feedback = (request.POST.get("feedback") or "").strip()

    score_value = None
    if raw_score != "":
        try:
            score_value = float(raw_score)
        except ValueError:
            return JsonResponse({"error": "Score noto'g'ri formatda."}, status=400)
        if score_value < 0:
            return JsonResponse({"error": "Score manfiy bo'lishi mumkin emas."}, status=400)
        if assignment.max_score and score_value > float(assignment.max_score):
            return JsonResponse({"error": "Score maksimal balldan yuqori."}, status=400)

    submission.score = score_value
    submission.feedback = feedback
    submission.graded_at = timezone.now()
    submission.status = "graded"
    submission.save(update_fields=["score", "feedback", "graded_at", "status"])

    return JsonResponse({"success": True, "submission": _serialize_submission(submission)})


@require_GET
def admin_dashboard_summary(request):
    error = _require_super_admin(request)
    if error:
        return error

    recent_users = User.objects.order_by("-date_joined")[:10]
    recent_courses = Course.objects.select_related("teacher").prefetch_related("sections").order_by("-created_at")[:10]

    return JsonResponse({
        "totals": {
            "users": User.objects.count(),
            "courses": Course.objects.count(),
            "teachers": User.objects.filter(role=Role.TEACHER).count(),
            "students": User.objects.filter(role=Role.STUDENT).count(),
        },
        "retake_stats": {
            "total_apps": RetakeApplication.objects.count(),
            "pending_finance": RetakeApplicationItem.objects.filter(status=RetakeItemStatus.SUBMITTED_TO_ACCOUNTING).count(),
            "approved_retakes": RetakeApplicationItem.objects.filter(status=RetakeItemStatus.APPROVED_FOR_GROUPING).count(),
            "completed_retakes": RetakeApplicationItem.objects.filter(status=RetakeItemStatus.COMPLETED).count(),
        },
        "recent_users": [
            {
                "id": user.id,
                "username": user.username,
                "full_name": user.get_full_name(),
                "role": user.role,
                "role_label": user.get_role_display(),
                "date_joined": _iso(user.date_joined),
            }
            for user in recent_users
        ],
        "recent_courses": [
            {
                "id": course.id,
                "title": course.title,
                "created_at": _iso(course.created_at),
                "is_active": course.is_active,
                "sections_count": course.sections.count(),
                "teacher": {
                    "id": course.teacher_id,
                    "full_name": course.teacher.get_full_name() or course.teacher.username,
                    "username": course.teacher.username,
                },
                "spa_path": f"/courses/{course.id}",
            }
            for course in recent_courses
        ],
    })


@require_POST
def admin_create_teacher(request):
    error = _require_super_admin(request)
    if error:
        return error

    payload = _json_body(request)
    username = (payload.get("username") or "").strip()
    password = (payload.get("password") or "").strip()
    full_name = (payload.get("full_name") or "").strip()
    email = (payload.get("email") or "").strip()
    phone = (payload.get("phone") or "").strip()
    department = (payload.get("department") or "").strip()

    if not username or not password or not full_name:
        return JsonResponse({"error": "username, password va full_name shart."}, status=400)
    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "Ushbu login band."}, status=400)

    first_name = full_name.split(" ")[0] if " " in full_name else full_name
    last_name = " ".join(full_name.split(" ")[1:]) if " " in full_name else ""

    user = User.objects.create_user(
        username=username,
        password=password,
        role=Role.TEACHER,
        first_name=first_name,
        last_name=last_name,
        email=email,
        phone=phone,
    )
    TeacherProfile.objects.create(
        user=user,
        full_name=full_name,
        department=department,
        phone=phone,
    )
    return JsonResponse({"success": True, "user_id": user.id, "redirect_path": "/super-admin"})


@require_POST
def admin_create_student(request):
    error = _require_super_admin(request)
    if error:
        return error

    payload = _json_body(request)
    username = (payload.get("username") or "").strip()
    password = (payload.get("password") or "").strip()
    full_name = (payload.get("full_name") or "").strip()
    student_id_number = (payload.get("student_id_number") or "").strip()
    university = (payload.get("university") or "").strip()
    faculty_name = (payload.get("faculty_name") or "").strip()
    group_name = (payload.get("group_name") or "").strip()

    if not username or not password or not full_name or not student_id_number:
        return JsonResponse({"error": "username, password, full_name va student_id_number shart."}, status=400)
    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "Ushbu login band."}, status=400)
    if StudentProfile.objects.filter(student_id_number=student_id_number).exists():
        return JsonResponse({"error": "Ushbu student ID band."}, status=400)

    first_name = full_name.split(" ")[0] if " " in full_name else full_name
    last_name = " ".join(full_name.split(" ")[1:]) if " " in full_name else ""

    user = User.objects.create_user(
        username=username,
        password=password,
        role=Role.STUDENT,
        first_name=first_name,
        last_name=last_name,
    )
    StudentProfile.objects.create(
        user=user,
        full_name=full_name,
        student_id_number=student_id_number,
        university=university,
        faculty_name=faculty_name,
        group_name=group_name,
    )
    return JsonResponse({"success": True, "user_id": user.id, "redirect_path": "/super-admin"})

@require_POST
def teacher_certificate_template_save(request, course_id: int):
    course = get_object_or_404(Course, id=course_id)
    if not _can_manage_course(request, course):
        return JsonResponse({"error": "Sizda ruxsat yo'q."}, status=403)

    if request.FILES.get("docx_file"):
        payload = request.POST
    else:
        payload = _json_body(request)

    template_id = payload.get("id")
    name = (payload.get("name") or "Asosiy sertifikat").strip()
    institution_name = (payload.get("institution_name") or "").strip()
    issued_by = (payload.get("issued_by") or "").strip()
    position = (payload.get("position") or "").strip()
    hours_raw = payload.get("hours_per_course")
    hours_per_course = None
    if hours_raw not in (None, ""):
        try:
            hours_per_course = int(hours_raw)
        except (TypeError, ValueError):
            hours_per_course = None

    if template_id:
        template = get_object_or_404(CertificateTemplate, id=int(template_id), course=course)
        template.name = name
        template.institution_name = institution_name
        template.issued_by = issued_by
        template.position = position
        template.hours_per_course = hours_per_course
        f = request.FILES.get("docx_file")
        if f:
            template.docx_file = f
        template.save()
    else:
        template = CertificateTemplate.objects.create(
            course=course,
            name=name,
            institution_name=institution_name,
            issued_by=issued_by,
            position=position,
            hours_per_course=hours_per_course,
        )
        f = request.FILES.get("docx_file")
        if f:
            template.docx_file = f
            template.save()

    return JsonResponse({
        "success": True,
        "template": {
            "id": template.id,
            "name": template.name,
            "institution_name": template.institution_name,
            "issued_by": template.issued_by,
            "position": template.position,
            "hours_per_course": template.hours_per_course,
            "docx_file": template.docx_file.url if template.docx_file else None,
        }
    })

@require_POST
def teacher_certificate_trigger_save(request, course_id: int):
    course = get_object_or_404(Course, id=course_id)
    if not _can_manage_course(request, course):
        return JsonResponse({"error": "Sizda ruxsat yo'q."}, status=403)

    payload = _json_body(request)
    trigger_id = payload.get("id")
    template_id = payload.get("template_id")
    trigger_type = payload.get("trigger_type")
    target_section_id = payload.get("target_section_id")
    target_test_id = payload.get("target_test_id")
    min_score = payload.get("min_score_percentage")

    if not template_id or not trigger_type:
        return JsonResponse({"error": "template_id va trigger_type shart."}, status=400)

    template = get_object_or_404(CertificateTemplate, id=template_id, course=course)

    if trigger_id:
        trigger = get_object_or_404(CertificateTrigger, id=trigger_id, course=course)
        trigger.template = template
        trigger.trigger_type = trigger_type
        trigger.target_section_id = target_section_id
        trigger.target_test_id = target_test_id
        trigger.min_score_percentage = min_score
        trigger.save()
    else:
        trigger = CertificateTrigger.objects.create(
            course=course,
            template=template,
            trigger_type=trigger_type,
            target_section_id=target_section_id,
            target_test_id=target_test_id,
            min_score_percentage=min_score
        )

    return JsonResponse({
        "success": True,
        "trigger": {
            "id": trigger.id,
            "template_id": trigger.template_id,
            "trigger_type": trigger.trigger_type
        }
    })

@require_POST
def teacher_certificate_trigger_delete(request, course_id: int, trigger_id: int):
    course = get_object_or_404(Course, id=course_id)
    if not _can_manage_course(request, course):
        return JsonResponse({"error": "Sizda ruxsat yo'q."}, status=403)
    
    trigger = get_object_or_404(CertificateTrigger, id=trigger_id, course=course)
    trigger.delete()
    return JsonResponse({"success": True})
