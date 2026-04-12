"""
Sertifikatni HTML da ko‘rsatish — foydalanuvchi brauzer orqali chop etish / PDF ga saqlaydi.
"""
from __future__ import annotations

import logging

from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, render

from lms.models import Course
from lms.services.certificate_docx_service import CertificateDocxService
from lms.services.certificate_service import (
    build_staff_preview_serial,
    certificate_docx_source_ready,
    get_certificate_grade_info,
    get_course_certificate_template_for_preview,
    issue_certificate,
    staff_can_certificate_preview,
)

logger = logging.getLogger(__name__)


@login_required
def course_certificate_print(request, course_id: int):
    course = get_object_or_404(Course, id=course_id)
    is_preview = request.GET.get("preview") == "1"

    if is_preview:
        if not staff_can_certificate_preview(request, course):
            return render(
                request,
                "lms/certificate_print.html",
                {
                    "error": "Namuna sertifikatni ko‘rish huquqi yo‘q.",
                    "course_title": course.title,
                },
                status=403,
            )
        template = get_course_certificate_template_for_preview(course)
        if not template:
            return render(
                request,
                "lms/certificate_print.html",
                {
                    "error": "Ushbu kurs uchun sertifikat shabloni topilmadi.",
                    "course_title": course.title,
                },
                status=404,
            )
        if not certificate_docx_source_ready(template):
            return render(
                request,
                "lms/certificate_print.html",
                {
                    "error": "DOCX shablon topilmadi. Admin orqali .docx yuklang.",
                    "course_title": course.title,
                },
                status=500,
            )
        service = CertificateDocxService(template_model=template)
        serial = build_staff_preview_serial(course.id)
        score, max_score, hours = get_certificate_grade_info(request.user, course, template)
        try:
            ctx = service.build_display_context(
                student=request.user,
                course=course,
                serial=serial,
                score=score,
                max_score=max_score,
                hours=hours,
            )
        except Exception as exc:
            logger.exception("Namuna sertifikat HTML konteksti: %s", exc)
            return render(
                request,
                "lms/certificate_print.html",
                {"error": str(exc), "course_title": course.title},
                status=500,
            )
        return render(
            request,
            "lms/certificate_print.html",
            {
                "error": None,
                "certificate": ctx,
                "course_title": course.title,
                "is_preview": True,
            },
        )

    user_cert, issue_msg = issue_certificate(request.user, course)
    if not user_cert:
        return render(
            request,
            "lms/certificate_print.html",
            {"error": issue_msg, "course_title": course.title},
            status=403,
        )

    template = user_cert.template
    if not template:
        return render(
            request,
            "lms/certificate_print.html",
            {"error": "Sertifikat shabloni topilmadi.", "course_title": course.title},
            status=500,
        )

    if not certificate_docx_source_ready(template):
        return render(
            request,
            "lms/certificate_print.html",
            {
                "error": "DOCX shablon topilmadi. Admin orqali .docx yuklang.",
                "course_title": course.title,
            },
            status=500,
        )

    service = CertificateDocxService(template_model=template)
    score, max_score, hours = get_certificate_grade_info(request.user, course, template)

    try:
        ctx = service.build_display_context(
            student=request.user,
            course=course,
            serial=user_cert.serial_number,
            score=score,
            max_score=max_score,
            hours=hours,
        )
    except Exception as exc:
        logger.exception("Sertifikat HTML konteksti: %s", exc)
        return render(
            request,
            "lms/certificate_print.html",
            {"error": str(exc), "course_title": course.title},
            status=500,
        )

    return render(
        request,
        "lms/certificate_print.html",
        {
            "error": None,
            "certificate": ctx,
            "course_title": course.title,
            "is_preview": False,
        },
    )
