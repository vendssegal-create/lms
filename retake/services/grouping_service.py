"""
GroupingService — Retake fan guruhlari biznes logikasi.

Mas'uliyat:
  - Guruh yaratish va boshqarish
  - A'zolarni qo'shish / chiqarish
  - LMS kursiga ulash va talabalarni enroll qilish
"""

from django.db import transaction

from retake.models import (
    RetakeApplicationItem,
    RetakeCycle,
    RetakeGroupMembership,
    RetakeItemStatus,
    RetakeSubjectGroup,
    SubjectGroupStatus,
    WorkflowEvent,
)


class GroupingServiceError(Exception):
    """Guruhlash xatosi."""


class GroupingService:

    # ── Guruh yaratish ─────────────────────────────────────────────

    @staticmethod
    def create_group(
        cycle: RetakeCycle,
        subject_snapshot,
        code: str,
        teacher_profile=None,
        capacity: int = 0,
        actor=None,
    ) -> RetakeSubjectGroup:
        """
        Yangi fan guruhini yaratish.
        code unikal bo'lishi kerak (cycle doirasida).
        """
        if RetakeSubjectGroup.objects.filter(cycle=cycle, code=code).exists():
            raise GroupingServiceError(
                f"'{code}' kodli guruh bu siklda allaqachon mavjud."
            )

        group = RetakeSubjectGroup.objects.create(
            cycle=cycle,
            subject_snapshot=subject_snapshot,
            code=code,
            teacher_profile=teacher_profile,
            capacity=capacity,
            status=SubjectGroupStatus.DRAFT,
            created_by=actor,
        )
        return group

    # ── A'zo qo'shish ──────────────────────────────────────────────

    @staticmethod
    def add_member(
        group: RetakeSubjectGroup,
        application_item: RetakeApplicationItem,
        actor=None,
    ) -> RetakeGroupMembership:
        """
        Guruhga talaba qo'shish.
        Shartlar:
          - item APPROVED_FOR_GROUPING holatida bo'lishi kerak
          - item hali boshqa guruhga kiritilmagan bo'lishi kerak
          - guruh kapasitasi yetarli bo'lishi kerak (capacity > 0 bo'lsa)
        """
        if application_item.status != RetakeItemStatus.APPROVED_FOR_GROUPING:
            raise GroupingServiceError(
                "Element guruhlashga tayyor emas (APPROVED_FOR_GROUPING holatida emas)."
            )

        if hasattr(application_item, "group_membership"):
            raise GroupingServiceError(
                "Bu talaba allaqachon boshqa guruhga biriktirilgan."
            )

        current_count = group.memberships.count()
        if group.capacity > 0 and current_count >= group.capacity:
            raise GroupingServiceError(
                f"Guruh to'lgan ({group.capacity} ta o'rin)."
            )

        with transaction.atomic():
            membership = RetakeGroupMembership.objects.create(
                group=group,
                application_item=application_item,
                student_snapshot=application_item.application.student_snapshot,
                required_control_type=application_item.required_control_type,
            )
            application_item.status = RetakeItemStatus.GROUPED
            application_item.save(update_fields=["status", "updated_at"])

            WorkflowEvent.objects.create(
                entity_type="retake_application_item",
                object_id=application_item.id,
                action="grouped",
                from_status=RetakeItemStatus.APPROVED_FOR_GROUPING,
                to_status=RetakeItemStatus.GROUPED,
                actor=actor,
                comment=f"Guruhga biriktirildi: {group.code}",
            )

        return membership

    # ── A'zo chiqarish ─────────────────────────────────────────────

    @staticmethod
    def remove_member(
        membership: RetakeGroupMembership,
        actor=None,
    ) -> None:
        """
        Guruhdan chiqarish.
        Item APPROVED_FOR_GROUPING ga qaytadi.
        Faqat GROUPED holatidagi itemlar uchun.
        """
        item = membership.application_item
        if item.status != RetakeItemStatus.GROUPED:
            raise GroupingServiceError(
                "Faqat guruhlangan elementni chiqarish mumkin."
            )

        with transaction.atomic():
            old_group_code = membership.group.code
            membership.delete()

            item.status = RetakeItemStatus.APPROVED_FOR_GROUPING
            item.save(update_fields=["status", "updated_at"])

            WorkflowEvent.objects.create(
                entity_type="retake_application_item",
                object_id=item.id,
                action="ungrouped",
                from_status=RetakeItemStatus.GROUPED,
                to_status=RetakeItemStatus.APPROVED_FOR_GROUPING,
                actor=actor,
                comment=f"Guruhdan chiqarildi: {old_group_code}",
            )

    # ── LMS kursiga ulash ─────────────────────────────────────────

    @staticmethod
    def sync_to_lms(
        group: RetakeSubjectGroup,
        student_group_names=None,
        actor=None,
    ) -> dict:
        """
        Guruhni LMS kursiga ulash va talabalarni enroll qilish.
        Ichki lms_integration_utils.sync_retake_group_to_lms ishlatiladi.
        Qaytaradi: {'course': ..., 'enrolled': int, 'already_enrolled': int, 'skipped': int}
        """
        from retake.utils.lms_integration_utils import sync_retake_group_to_lms

        if not group.teacher_profile:
            raise GroupingServiceError(
                "Guruhga o'qituvchi biriktirilmagan — LMS kursi yaratib bo'lmaydi."
            )

        result = sync_retake_group_to_lms(
            group=group,
            student_group_names=student_group_names,
            enrolled_by=actor,
        )
        return result or {}

    # ── Guruh holatini o'zgartirish ────────────────────────────────

    @staticmethod
    def activate(group: RetakeSubjectGroup) -> None:
        if group.status != SubjectGroupStatus.DRAFT:
            raise GroupingServiceError("Faqat qoralama guruhni faollashtirish mumkin.")
        group.status = SubjectGroupStatus.ACTIVE
        group.save(update_fields=["status", "updated_at"])

    @staticmethod
    def complete_group(group: RetakeSubjectGroup) -> None:
        group.status = SubjectGroupStatus.COMPLETED
        group.save(update_fields=["status", "updated_at"])
