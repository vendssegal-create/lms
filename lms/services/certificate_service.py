"""
Sertifikat huquqi, DOCX manbasi, PDF kesh.

Strategiya (`CERTIFICATE_STRATEGY`): docx_primary (standart) | commercial_pdf | html_weasyprint.
Standart yuklab olish formati: `CERTIFICATE_DEFAULT_DOWNLOAD_FORMAT` (odatda docx).

PDF (format=pdf) DOCX dan konvert qilinadi (`CERTIFICATE_PDF_BACKEND`: libreoffice yoki docx2pdf + Word).
LibreOffice/Word bo‘lmasa, talaba `?format=docx` bilan DOCX olishi mumkin.
Yangi sertifikat yaratilganda Celery orqali PDF oldindan tayyorlanishi mumkin (`schedule_certificate_pdf_warm`).
"""
from __future__ import annotations

import logging
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from lms.models import (
    CertificateTemplate,
    CertificateTrigger,
    GradebookEntry,
    SectionCompletion,
    TestAttempt,
    UserCertificate,
)

logger = logging.getLogger(__name__)


def certificate_default_download_format() -> str:
    fmt = (getattr(settings, "CERTIFICATE_DEFAULT_DOWNLOAD_FORMAT", None) or "docx").strip().lower()
    return fmt if fmt in ("docx", "pdf") else "docx"


def certificate_api_download_path(course_id: int) -> str:
    q = certificate_default_download_format()
    return f"/api/lms/courses/{int(course_id)}/certificate/download/?format={q}"


def certificate_print_path(course_id: int) -> str:
    """Brauzer chop etish / «PDF ga saqlash» uchun HTML sahifa (serverda LO talab qilinmaydi)."""
    return f"/lms/courses/{int(course_id)}/certificate/print/"


def certificate_print_preview_path(course_id: int) -> str:
    """Kurs boshqaruvchilari uchun namuna chop etish (UserCertificate yaratilmaydi)."""
    return f"/lms/courses/{int(course_id)}/certificate/print/?preview=1"


def staff_can_certificate_preview(request, course) -> bool:
    """
    Namuna sertifikat: faqat kurs kontentini boshqaruvchi rollar va tegishli o‘qituvchi.
    Talaba progressi yoki enrolled superuser ni «talaba» deb hisoblamaymiz — alohida namuna oqimi.
    """
    from users.utils.roles import Role, can_manage_course_content, get_user_role

    user = request.user
    if not getattr(user, "is_authenticated", False):
        return False
    if not can_manage_course_content(user, request.session):
        return False
    if user.is_superuser or getattr(user, "role", None) == Role.SUPER_ADMIN:
        return True
    role = get_user_role(user, request.session)
    if role == Role.TEACHER:
        return course.teacher_id == user.id
    return True


def get_course_certificate_template_for_preview(course):
    """Faol shablon yoki trigger orqali bog‘langan shablon (talaba huquqisiz)."""
    tpl = (
        CertificateTemplate.objects.filter(course=course, is_active=True)
        .order_by("-created_at")
        .first()
    )
    if tpl:
        return tpl
    trig = (
        CertificateTrigger.objects.filter(course=course)
        .select_related("template")
        .order_by("id")
        .first()
    )
    return trig.template if trig else None


def build_staff_preview_serial(course_id: int) -> str:
    year = timezone.now().year
    return f"NAMUNA-{year}-C{int(course_id):04d}"


def build_certificate_verify_url(serial: str) -> str:
    base = getattr(settings, "CERTIFICATE_VERIFY_BASE_URL", "") or ""
    if base:
        return f"{base}{serial}"
    lm = getattr(settings, "LMS_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
    return f"{lm}/verify/{serial}"


def certificate_default_docx_path() -> Path:
    return Path(settings.BASE_DIR) / "lms" / "certificate_assets" / "certificate_template.docx"


def ensure_default_certificate_docx_on_disk() -> None:
    """
    Loyihada certificate_template.docx yo'q bo'lsa (deploy, yangi clone) — bir marta yaratadi.
    DOCX maydoni bo'sh qoldirilganda shu fayl ishlatiladi.
    """
    p = certificate_default_docx_path()
    if p.exists():
        return
    try:
        from lms.utils.default_certificate_docx import write_default_certificate_docx_if_missing

        write_default_certificate_docx_if_missing(Path(settings.BASE_DIR))
    except OSError:
        pass


def user_certificate_pdf_cache_is_fresh(user_cert, template: CertificateTemplate | None) -> bool:
    """
    Saqlangan PDF hozirgi shablon versiyasi bilan mosmi.
    Shablon saqlanganda updated_at yangilanadi; undan keyin PDF qayta generatsiya qilinadi.
    """
    if not user_cert or not getattr(user_cert, "pdf_file", None) or not user_cert.pdf_file.name:
        return False
    gen_at = getattr(user_cert, "pdf_generated_at", None)
    if not gen_at:
        return False
    if not template:
        return False
    tpl_upd = getattr(template, "updated_at", None)
    if tpl_upd is None:
        return False
    return gen_at >= tpl_upd


def certificate_docx_source_ready(template: CertificateTemplate | None) -> bool:
    """DOCX generatsiya uchun shablon fayli (model yoki loyiha default) mavjudmi."""
    if template and getattr(template, "docx_file", None) and template.docx_file.name:
        try:
            if Path(template.docx_file.path).exists():
                return True
        except (ValueError, OSError):
            pass
    ensure_default_certificate_docx_on_disk()
    return certificate_default_docx_path().exists()


def generate_certificate_serial(user, course) -> str:
    prefix = (getattr(settings, "CERTIFICATE_SERIAL_PREFIX", "CERT") or "CERT").rstrip("-")
    year = timezone.now().year
    return f"{prefix}-{year}-{user.id:05d}{course.id:04d}"


def get_certificate_grade_info(user, course, template: CertificateTemplate | None):
    score = 0.0
    max_score = 0.0
    hours = 0
    try:
        entry = GradebookEntry.objects.filter(gradebook__course=course, student=user).first()
        if entry and entry.total_score is not None:
            score = float(entry.total_score)
            gb = entry.gradebook
            max_score = float(gb.current_max + gb.midterm_max + gb.final_max)
    except Exception:
        pass
    if template and getattr(template, "hours_per_course", None):
        hours = int(template.hours_per_course)
    return score, max_score, hours


def check_certificate_eligibility(user, course):
    """
    Checks if a user is eligible for a certificate based on triggers.
    Returns (is_eligible, message_or_template).
    """
    triggers = CertificateTrigger.objects.filter(course=course)
    if not triggers.exists():
        default_template = (
            CertificateTemplate.objects.filter(course=course, is_active=True)
            .order_by("-created_at")
            .first()
        )
        if default_template:
            return True, default_template
        return False, "Ushbu kurs uchun sertifikat ko'zda tutilmagan."

    eligible_triggers = []
    messages = []

    for trigger in triggers:
        if trigger.trigger_type == CertificateTrigger.TriggerType.COURSE_COMPLETE:
            total_sections = course.sections.count()
            completed_sections = SectionCompletion.objects.filter(student=user, section__course=course).count()
            if completed_sections >= total_sections:
                eligible_triggers.append(trigger)
            else:
                messages.append(f"Barcha mavzularni tugating ({completed_sections}/{total_sections}).")

        elif trigger.trigger_type == CertificateTrigger.TriggerType.SECTION_COMPLETE:
            if SectionCompletion.objects.filter(student=user, section=trigger.target_section).exists():
                eligible_triggers.append(trigger)
            else:
                messages.append(f"'{trigger.target_section.name}' mavzusini tugating.")

        elif trigger.trigger_type == CertificateTrigger.TriggerType.TEST_SCORE:
            best_attempt = (
                TestAttempt.objects.filter(
                    student__user=user,
                    test=trigger.target_test,
                    is_completed=True,
                )
                .order_by("-score")
                .first()
            )

            if best_attempt:
                score_percentage = (best_attempt.score / trigger.target_test.max_score) * 100
                if score_percentage >= trigger.min_score_percentage:
                    eligible_triggers.append(trigger)
                else:
                    messages.append(
                        f"'{trigger.target_test.name}' testidan kamida {trigger.min_score_percentage}% "
                        f"ball to'plang (Hozir: {round(score_percentage, 1)}%)."
                    )
            else:
                messages.append(f"'{trigger.target_test.name}' testini topshiring.")

    if eligible_triggers:
        return True, eligible_triggers[0].template

    return False, " & ".join(messages)


def warm_certificate_pdf(user, course, *, force: bool = False) -> tuple[bool, str | None]:
    """
    UserCertificate uchun PDF ni generatsiya qilib pdf_file ga yozadi.
    Kesh yangi bo‘lsa (force=False) hech narsa qilmaydi.
    """
    from django.core.files.base import ContentFile

    from lms.services.certificate_docx_service import CertificateDocxService

    user_cert = (
        UserCertificate.objects.filter(user=user, course=course).select_related("template").first()
    )
    if not user_cert or not user_cert.template:
        return False, "UserCertificate yoki shablon yo‘q"

    template = user_cert.template
    if not certificate_docx_source_ready(template):
        logger.info("warm_certificate_pdf: DOCX manbai tayyor emas (course_id=%s)", course.id)
        return False, "DOCX shablon yo‘q"

    if not force and user_certificate_pdf_cache_is_fresh(user_cert, template):
        return True, None

    try:
        service = CertificateDocxService(template_model=template)
        score, max_score, hours = get_certificate_grade_info(user, course, template)
        pdf_bytes = service.generate(
            student=user,
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
        return True, None
    except Exception as exc:
        logger.exception("warm_certificate_pdf: %s", exc)
        return False, str(exc)


def schedule_certificate_pdf_warm(user_id: int, course_id: int) -> None:
    """
    Celery orqali PDF oldindan tayyorlash.
    Broker ishlamasa yoki navbatga qo‘yish xato bersa — bir marta sinxron warm sinab ko‘riladi.
    """
    try:
        from lms.tasks import generate_certificate_async

        generate_certificate_async.delay(user_id, course_id)
    except Exception as exc:
        logger.warning(
            "certificate PDF warm navbati (%s, %s) ishlamadi: %s — sinxron generatsiya",
            user_id,
            course_id,
            exc,
        )
        try:
            from django.contrib.auth import get_user_model

            from lms.models import Course

            User = get_user_model()
            u = User.objects.get(pk=user_id)
            c = Course.objects.get(pk=course_id)
            warm_certificate_pdf(u, c)
        except Exception:
            logger.exception("Sinxron warm_certificate_pdf ham muvaffaqiyatsiz")


def issue_certificate(user, course, *, queue_pdf_warm: bool = True):
    """
    Huquqni tekshiradi, UserCertificate yaratadi/yangilaydi.
    PDF odatda diskda saqlanadi; yangi yozuv yoki shablon almashganda fon vazifada oldindan tayyorlash navbatga qo‘yiladi.
    """
    is_eligible, result = check_certificate_eligibility(user, course)
    if not is_eligible:
        return None, result

    template = result

    user_cert, created = UserCertificate.objects.get_or_create(
        user=user,
        course=course,
        defaults={
            "template": template,
            "serial_number": generate_certificate_serial(user, course),
        },
    )

    if not user_cert.serial_number:
        user_cert.serial_number = generate_certificate_serial(user, course)

    template_changed = user_cert.template_id != template.id
    if template_changed:
        user_cert.template = template
        old_pdf = user_cert.pdf_file
        if old_pdf:
            old_pdf.delete(save=False)
        user_cert.pdf_file = None
        user_cert.pdf_generated_at = None

    user_cert.qr_data = build_certificate_verify_url(user_cert.serial_number)
    user_cert.save()

    if queue_pdf_warm and (created or template_changed):
        schedule_certificate_pdf_warm(user.id, course.id)

    return user_cert, "Sertifikat tayyor. PDF/DOCX ni yuklab olish sahifasidan oling."
