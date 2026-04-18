"""
ExamService — Retake imtihon varaqalari va baholash biznes logikasi.

Holat o'tishlari:
  ExamSheet:  DRAFT → OPEN → SUBMITTED → LOCKED
              LOCKED → OPEN  (unlock, faqat admin/db_manager)

  ExamSheetEntry: baho kiritish va davomatsizlik belgilash

Qoidalar:
  - Baho max_score dan oshmasligi kerak (RetakeAssessmentConfig)
  - LOCKED varaqa faqat SUPER_ADMIN / RET_DB_MANAGER tomonidan ochilishi mumkin
  - final nazorat SUBMITTED o'rniga to'g'ridan-to'g'ri LOCKED ga o'tadi
  - LMS kursga biriktirilgan guruh uchun kursni tugatmagan talabaga
    baho kiritishga ogohlantirish beriladi (yumshoq tekshiruv)
"""

from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from retake.models import (
    AssessmentSchedule,
    ExamSheet,
    ExamSheetEntry,
    ExamSheetStatus,
    RetakeApplicationItem,
    RetakeGroupMembership,
    RetakeItemStatus,
    RetakeSubjectGroup,
    WorkflowEvent,
)


class ExamServiceError(Exception):
    """Imtihon xatosi."""


class ExamService:

    # ── Varaqa yaratish ────────────────────────────────────────────

    @staticmethod
    def create_sheet(
        schedule: AssessmentSchedule,
        sheet_no=None,
        actor=None,
    ) -> ExamSheet:
        """
        AssessmentSchedule asosida ExamSheet yaratish.
        Har bir guruh a'zosi uchun ExamSheetEntry avtomatik qo'shiladi.
        Bir jadvil uchun faqat bitta varaqa bo'lishi mumkin.
        """
        if hasattr(schedule, "exam_sheet"):
            raise ExamServiceError(
                "Bu jadval uchun imtihon varaqa allaqachon mavjud."
            )

        if not sheet_no:
            sheet_no = f"QO-{schedule.id:05d}-{schedule.control_type.upper()}"

        with transaction.atomic():
            sheet = ExamSheet.objects.create(
                assessment_schedule=schedule,
                sheet_no=sheet_no,
                status=ExamSheetStatus.DRAFT,
            )

            memberships = RetakeGroupMembership.objects.filter(
                group=schedule.group
            ).select_related("student_snapshot")

            if schedule.student_group_name:
                memberships = memberships.filter(
                    student_snapshot__group_name=schedule.student_group_name
                )

            ExamSheetEntry.objects.bulk_create([
                ExamSheetEntry(
                    sheet=sheet,
                    group_membership=m,
                    student_snapshot=m.student_snapshot,
                )
                for m in memberships
            ])

            WorkflowEvent.objects.create(
                entity_type="ExamSheet",
                object_id=sheet.id,
                action="sheet_created",
                from_status="",
                to_status=ExamSheetStatus.DRAFT,
                actor=actor,
                comment=f"Jadval #{schedule.id} uchun varaqa yaratildi.",
            )

        return sheet

    # ── Varaqa ochish ──────────────────────────────────────────────

    @staticmethod
    def open_sheet(sheet: ExamSheet, actor=None) -> None:
        """DRAFT → OPEN."""
        if sheet.status not in (ExamSheetStatus.DRAFT,):
            raise ExamServiceError(
                "Faqat DRAFT holatidagi varaqani ochish mumkin."
            )

        old = sheet.status
        sheet.status = ExamSheetStatus.OPEN
        sheet.opened_at = timezone.now()
        sheet.save(update_fields=["status", "opened_at"])

        WorkflowEvent.objects.create(
            entity_type="ExamSheet",
            object_id=sheet.id,
            action="sheet_opened",
            from_status=old,
            to_status=ExamSheetStatus.OPEN,
            actor=actor,
        )

    # ── Baho kiritish ──────────────────────────────────────────────

    @staticmethod
    def enter_score(
        entry: ExamSheetEntry,
        score_raw,
        is_absent: bool,
        actor,
        max_score=None,
    ) -> list[str]:
        """
        Bitta entry uchun baho kiritish.
        Qaytaradi: warnings ro'yxati (kursni tugatmagan, va h.k.)
        max_score=None bo'lsa tekshirilmaydi.
        Parallel yozishdan himoya: select_for_update() ishlatiladi.
        """
        warnings = []

        with transaction.atomic():
            # Race condition dan himoya — bir vaqtda ikki foydalanuvchi yozsa, ikkinchisi kutadi
            entry = ExamSheetEntry.objects.select_for_update().get(pk=entry.pk)
            sheet = entry.sheet

            if sheet.status == ExamSheetStatus.LOCKED:
                raise ExamServiceError(
                    "Yopilgan varaqa baholarini o'zgartirib bo'lmaydi."
                )

            if is_absent:
                score = Decimal("0.00")
            elif score_raw in (None, ""):
                score = None
            else:
                try:
                    score = Decimal(str(score_raw))
                except InvalidOperation:
                    raise ExamServiceError(f"Noto'g'ri ball qiymati: {score_raw!r}")

            if max_score is not None and score is not None and float(score) > max_score:
                raise ExamServiceError(
                    f"Ball {max_score} dan oshmasligi kerak "
                    f"({sheet.assessment_schedule.control_type})."
                )

            entry.score = score
            entry.is_absent = is_absent
            entry.entered_by = actor
            entry.entered_at = timezone.now()
            entry.save(update_fields=["score", "is_absent", "entered_by", "entered_at"])

        return warnings

    @staticmethod
    def bulk_enter_scores(
        sheet: ExamSheet,
        entries_payload: list[dict],
        actor,
        check_lms_completion: bool = True,
    ) -> list[str]:
        """
        Ko'p entry uchun baholarni bir vaqtda kiritish.
        entries_payload: [{"id": int, "score": float|None, "is_absent": bool}]
        Qaytaradi: warnings ro'yxati.
        """
        from retake.models import RetakeAssessmentConfig
        from lms.models import Section, SectionCompletion

        warnings = []

        if sheet.status == ExamSheetStatus.LOCKED:
            raise ExamServiceError("Yopilgan varaqa baholarini o'zgartirib bo'lmaydi.")

        config = RetakeAssessmentConfig.objects.filter(
            control_type=sheet.assessment_schedule.control_type,
            is_active=True,
        ).first()
        max_score = float(config.max_score) if config else None

        group = sheet.assessment_schedule.group
        lms_course = group.lms_course
        published_sections_count = (
            Section.objects.filter(course=lms_course, is_published=True).count()
            if lms_course and check_lms_completion
            else 0
        )

        entries_map = {e.id: e for e in sheet.entries.select_related("student_snapshot").all()}

        with transaction.atomic():
            for item in entries_payload:
                entry_id = item.get("id")
                entry = entries_map.get(entry_id)
                if not entry:
                    continue

                is_absent = bool(item.get("is_absent"))
                score_raw = item.get("score")

                # LMS kurs completion tekshiruvi (yumshoq)
                if lms_course and check_lms_completion and not is_absent and score_raw not in (None, ""):
                    from retake.api_views import _get_user_from_snapshot
                    student_user = _get_user_from_snapshot(entry.student_snapshot)
                    completed = (
                        SectionCompletion.objects.filter(
                            student=student_user, section__course=lms_course
                        ).count()
                        if student_user
                        else 0
                    )
                    if published_sections_count > 0 and completed < published_sections_count:
                        warnings.append(
                            f"{entry.student_snapshot.full_name} kursni tugatmagan "
                            f"({completed}/{published_sections_count}). Baho saqlanmadi."
                        )
                        continue

                try:
                    ExamService.enter_score(
                        entry=entry,
                        score_raw=score_raw,
                        is_absent=is_absent,
                        actor=actor,
                        max_score=max_score,
                    )
                except ExamServiceError as exc:
                    raise ExamServiceError(str(exc))

        return warnings

    # ── Varaqa topshirish ──────────────────────────────────────────

    @staticmethod
    def submit_sheet(sheet: ExamSheet, actor=None) -> None:
        """
        OPEN → SUBMITTED  (oddiy nazorat)
        OPEN → LOCKED     (final nazorat — to'g'ridan-to'g'ri bloklash)
        """
        from lms.models import ControlType

        if sheet.status != ExamSheetStatus.OPEN:
            raise ExamServiceError(
                "Faqat ochiq varaqani topshirish mumkin."
            )

        old = sheet.status
        control_type = sheet.assessment_schedule.control_type

        if control_type == ControlType.FINAL:
            sheet.status = ExamSheetStatus.LOCKED
            sheet.locked_at = timezone.now()
            sheet.submitted_at = timezone.now()
        else:
            sheet.status = ExamSheetStatus.SUBMITTED
            sheet.submitted_at = timezone.now()

        sheet.save(update_fields=["status", "locked_at", "submitted_at"])

        WorkflowEvent.objects.create(
            entity_type="ExamSheet",
            object_id=sheet.id,
            action="sheet_submitted",
            from_status=old,
            to_status=sheet.status,
            actor=actor,
            comment="Qaydnoma yakunlandi.",
        )

    # ── Varaqa bloklash ────────────────────────────────────────────

    @staticmethod
    def lock_sheet(sheet: ExamSheet, actor=None) -> None:
        """SUBMITTED → LOCKED."""
        with transaction.atomic():
            sheet = ExamSheet.objects.select_for_update().get(pk=sheet.pk)
            if sheet.status != ExamSheetStatus.SUBMITTED:
                raise ExamServiceError(
                    "Faqat topshirilgan varaqani bloklash mumkin."
                )

            old = sheet.status
            sheet.status = ExamSheetStatus.LOCKED
            sheet.locked_at = timezone.now()
            sheet.save(update_fields=["status", "locked_at"])

            WorkflowEvent.objects.create(
                entity_type="ExamSheet",
                object_id=sheet.id,
                action="sheet_locked",
                from_status=old,
                to_status=ExamSheetStatus.LOCKED,
                actor=actor,
            )

    # ── Varaqani ochish (unlock) ───────────────────────────────────

    @staticmethod
    def unlock_sheet(sheet: ExamSheet, actor=None) -> None:
        """
        LOCKED → OPEN
        Faqat SUPER_ADMIN yoki RET_DB_MANAGER chaqira oladi
        (rol tekshiruvi view qatlamida amalga oshiriladi).
        """
        if sheet.status != ExamSheetStatus.LOCKED:
            raise ExamServiceError(
                "Faqat bloklangan varaqani ochish mumkin."
            )

        old = sheet.status
        sheet.status = ExamSheetStatus.OPEN
        sheet.locked_at = None
        sheet.save(update_fields=["status", "locked_at"])

        WorkflowEvent.objects.create(
            entity_type="ExamSheet",
            object_id=sheet.id,
            action="sheet_unlocked",
            from_status=old,
            to_status=ExamSheetStatus.OPEN,
            actor=actor,
            comment="Qaydnoma admin tomonidan ochildi.",
        )

    # ── Item yakunlash ─────────────────────────────────────────────

    @staticmethod
    def complete_item_after_exam(entry: ExamSheetEntry) -> None:
        """
        ExamSheet LOCKED bo'lganda mos RetakeApplicationItem ni COMPLETED ga o'tkazadi.
        """
        try:
            item = entry.group_membership.application_item
            if item.status not in (
                RetakeItemStatus.GRADE_ENTRY_OPEN,
                RetakeItemStatus.SCHEDULED,
                RetakeItemStatus.GROUPED,
            ):
                return
            item.status = RetakeItemStatus.COMPLETED
            item.save(update_fields=["status", "updated_at"])
        except Exception:
            pass
