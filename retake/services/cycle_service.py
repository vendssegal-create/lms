"""
CycleService — Retake sikl boshqaruvi biznes logikasi.

Holat o'tishlari:
  DRAFT    → OPEN      (ochish)
  OPEN     → CLOSED    (yopish)
  CLOSED   → ARCHIVED  (arxivlash)
  CLOSED   → OPEN      (qayta ochish — super_admin)
"""

from django.utils import timezone

from retake.models import (
    RetakeCycle,
    RetakeCycleStatus,
    WorkflowEvent,
)


class CycleServiceError(Exception):
    """Sikl workflow xatosi."""


class CycleService:

    # ── Workflow event ─────────────────────────────────────────────

    @staticmethod
    def log_event(
        cycle: RetakeCycle,
        action: str,
        from_status: str,
        to_status: str,
        actor,
        comment: str = "",
    ) -> None:
        WorkflowEvent.objects.create(
            entity_type="retake_cycle",
            object_id=cycle.id,
            action=action,
            from_status=from_status,
            to_status=to_status,
            actor=actor,
            comment=comment,
        )

    # ── Ochish ────────────────────────────────────────────────────

    @staticmethod
    def open(cycle: RetakeCycle, actor, comment: str = "") -> None:
        """
        DRAFT | CLOSED → OPEN

        Faqat bitta sikl bir vaqtda OPEN bo'lishi mumkin.
        """
        if cycle.status not in (RetakeCycleStatus.DRAFT, RetakeCycleStatus.CLOSED):
            raise CycleServiceError(
                "Faqat qoralama yoki yopiq siklni ochish mumkin."
            )

        open_cycles = RetakeCycle.objects.filter(
            status=RetakeCycleStatus.OPEN
        ).exclude(pk=cycle.pk)
        if open_cycles.exists():
            raise CycleServiceError(
                "Boshqa ochiq sikl mavjud. Avval uni yoping."
            )

        old = cycle.status
        cycle.status = RetakeCycleStatus.OPEN
        cycle.save(update_fields=["status", "updated_at"])

        CycleService.log_event(cycle, "cycle_opened", old, cycle.status, actor, comment)

    # ── Yopish ────────────────────────────────────────────────────

    @staticmethod
    def close(cycle: RetakeCycle, actor, comment: str = "") -> None:
        """OPEN → CLOSED"""
        if cycle.status != RetakeCycleStatus.OPEN:
            raise CycleServiceError("Faqat ochiq siklni yopish mumkin.")

        old = cycle.status
        cycle.status = RetakeCycleStatus.CLOSED
        cycle.save(update_fields=["status", "updated_at"])

        CycleService.log_event(cycle, "cycle_closed", old, cycle.status, actor, comment)

    # ── Arxivlash ─────────────────────────────────────────────────

    @staticmethod
    def archive(cycle: RetakeCycle, actor, comment: str = "") -> None:
        """CLOSED → ARCHIVED"""
        if cycle.status != RetakeCycleStatus.CLOSED:
            raise CycleServiceError("Faqat yopiq siklni arxivlash mumkin.")

        old = cycle.status
        cycle.status = RetakeCycleStatus.ARCHIVED
        cycle.save(update_fields=["status", "updated_at"])

        CycleService.log_event(cycle, "cycle_archived", old, cycle.status, actor, comment)

    # ── Statistika ────────────────────────────────────────────────

    @staticmethod
    def get_stats(cycle: RetakeCycle) -> dict:
        """Sikl bo'yicha asosiy statistikani qaytaradi."""
        from retake.models import (
            RetakeApplication,
            RetakeApplicationStatus,
            RetakeApplicationItem,
            RetakeItemStatus,
            RetakeSubjectGroup,
        )

        apps = cycle.applications.all()
        total = apps.count()

        status_counts = {}
        for status in RetakeApplicationStatus.values:
            status_counts[status] = apps.filter(status=status).count()

        items = RetakeApplicationItem.objects.filter(application__cycle=cycle)
        items_by_status = {}
        for status in RetakeItemStatus.values:
            items_by_status[status] = items.filter(status=status).count()

        groups = RetakeSubjectGroup.objects.filter(cycle=cycle)
        groups_count = groups.count()
        groups_with_members = groups.filter(memberships__isnull=False).distinct().count()

        return {
            "total_applications": total,
            "applications_by_status": status_counts,
            "total_items": items.count(),
            "items_by_status": items_by_status,
            "total_groups": groups_count,
            "groups_with_members": groups_with_members,
            "groups_without_members": groups_count - groups_with_members,
        }
