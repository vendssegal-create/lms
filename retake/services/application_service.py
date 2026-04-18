"""
ApplicationService — Retake ariza workflow biznes logikasi.

Holat o'tishlari:
  DRAFT → IN_REVIEW                    (talaba/registrator yuboradi)
  IN_REVIEW → PARTIALLY_APPROVED       (buxgalter tasdiqlaydi)
  IN_REVIEW → RETURNED                 (buxgalter rad etadi)
  PARTIALLY_APPROVED → APPROVED        (supervisor tasdiqlaydi)
  PARTIALLY_APPROVED → RETURNED        (supervisor qaytaradi)
  * → CANCELLED                        (admin bekor qiladi)
"""

from decimal import Decimal

from django.utils import timezone

from retake.models import (
    PaymentReview,
    PaymentReviewStatus,
    RetakeApplication,
    RetakeApplicationStatus,
    RetakeApplicationItem,
    RetakeItemStatus,
    WorkflowEvent,
)


class ApplicationServiceError(Exception):
    """Ariza workflow xatosi."""


class ApplicationService:

    # ── Workflow event ─────────────────────────────────────────────

    @staticmethod
    def log_event(application: RetakeApplication, action: str,
                  from_status: str, to_status: str, actor, comment: str = "") -> None:
        WorkflowEvent.objects.create(
            entity_type="retake_application",
            object_id=application.id,
            action=action,
            from_status=from_status,
            to_status=to_status,
            actor=actor,
            comment=comment,
        )

    # ── Kredit limiti tekshiruvi ───────────────────────────────────

    @staticmethod
    def validate_credit_limit(application: RetakeApplication) -> None:
        """
        Talabaning bir akademik yildagi barcha sikllardagi tasdiqlangan
        itemlar kreditlari max_allowed_credits dan oshmasligi tekshiriladi.
        """
        cycle = application.cycle
        student_snapshot = application.student_snapshot
        max_credits = cycle.max_allowed_credits

        current_credits = Decimal("0.00")
        for item in application.items.select_related("subject_snapshot").all():
            credit = getattr(item.subject_snapshot, "credit", None)
            if credit is not None:
                current_credits += Decimal(str(credit))

        approved_statuses = [
            RetakeItemStatus.PAYMENT_APPROVED,
            RetakeItemStatus.AWAITING_SUPERVISOR,
            RetakeItemStatus.APPROVED_FOR_GROUPING,
            RetakeItemStatus.GROUPED,
            RetakeItemStatus.SCHEDULED,
            RetakeItemStatus.GRADE_ENTRY_OPEN,
            RetakeItemStatus.COMPLETED,
        ]

        other_items = RetakeApplicationItem.objects.filter(
            application__student_snapshot=student_snapshot,
            application__cycle__academic_year=cycle.academic_year,
            application__status__in=[
                RetakeApplicationStatus.PARTIALLY_APPROVED,
                RetakeApplicationStatus.APPROVED,
                RetakeApplicationStatus.COMPLETED,
            ],
            status__in=approved_statuses,
        ).exclude(application=application).select_related("subject_snapshot")

        other_credits = Decimal("0.00")
        for item in other_items:
            credit = getattr(item.subject_snapshot, "credit", None)
            if credit is not None:
                other_credits += Decimal(str(credit))

        total = current_credits + other_credits
        if total > max_credits:
            raise ApplicationServiceError(
                f"Kredit limiti ({max_credits}) oshib ketdi. "
                f"Joriy ariza: {current_credits}, boshqa sikllarda tasdiqlangan: {other_credits}, "
                f"jami: {total}."
            )

    # ── Talaba: ariza yuborish ─────────────────────────────────────

    @staticmethod
    def submit(application: RetakeApplication, actor) -> None:
        """
        DRAFT → IN_REVIEW
        Shartlar:
          - holat DRAFT yoki RETURNED bo'lishi kerak
          - kamida bitta item bo'lishi kerak
        """
        if application.status not in (
            RetakeApplicationStatus.DRAFT,
            RetakeApplicationStatus.RETURNED,
        ):
            raise ApplicationServiceError(
                "Faqat qoralama yoki qaytarilgan arizani yuborish mumkin."
            )

        if not application.items.exists():
            raise ApplicationServiceError(
                "Ariza bo'sh — kamida bitta fan tanlanishi kerak."
            )

        ApplicationService.validate_credit_limit(application)

        old = application.status
        application.status = RetakeApplicationStatus.IN_REVIEW
        application.submitted_at = timezone.now()
        application.save(update_fields=["status", "submitted_at", "updated_at"])

        ApplicationService.log_event(
            application, "submitted", old, application.status, actor
        )

    # ── Buxgalter: to'lov tekshiruvi ──────────────────────────────

    @staticmethod
    def accounting_approve(
        application: RetakeApplication,
        accountant_amount: Decimal,
        actor,
        comment: str = "",
    ) -> None:
        """
        IN_REVIEW → PARTIALLY_APPROVED
        Barcha itemlar AWAITING_SUPERVISOR ga o'tadi.
        """
        if application.status != RetakeApplicationStatus.IN_REVIEW:
            raise ApplicationServiceError(
                "Bu ariza buxgalteriya bosqichida emas."
            )

        if accountant_amount <= 0:
            raise ApplicationServiceError(
                "Buxgalteriya summasi musbat bo'lishi kerak."
            )

        old = application.status
        application.accountant_amount = accountant_amount
        application.accountant_comment = comment
        application.status = RetakeApplicationStatus.PARTIALLY_APPROVED

        items = list(application.items.all())
        for item in items:
            item.status = RetakeItemStatus.AWAITING_SUPERVISOR
            item.payment_date = timezone.now().date()

        RetakeApplicationItem.objects.bulk_update(
            items, ["status", "payment_date"]
        )

        PaymentReview.objects.bulk_create([
            PaymentReview(
                application_item=item,
                status=PaymentReviewStatus.APPROVED,
                checked_by=actor,
                comment=comment,
            )
            for item in items
        ])

        application.save(update_fields=[
            "accountant_amount", "accountant_comment", "status", "updated_at"
        ])

        ApplicationService.log_event(
            application, "payment_verified", old, application.status, actor, comment
        )

    @staticmethod
    def accounting_reject(
        application: RetakeApplication,
        actor,
        comment: str = "",
    ) -> None:
        """
        IN_REVIEW → RETURNED
        Barcha itemlar PAYMENT_REJECTED ga o'tadi.
        """
        if application.status != RetakeApplicationStatus.IN_REVIEW:
            raise ApplicationServiceError(
                "Bu ariza buxgalteriya bosqichida emas."
            )

        old = application.status
        application.accountant_comment = comment
        application.status = RetakeApplicationStatus.RETURNED
        application.items.all().update(status=RetakeItemStatus.PAYMENT_REJECTED)
        application.save(update_fields=["accountant_comment", "status", "updated_at"])

        ApplicationService.log_event(
            application, "payment_rejected", old, application.status, actor, comment
        )

    # ── Supervisor: yakuniy tasdiqlash ─────────────────────────────

    @staticmethod
    def supervisor_approve(
        application: RetakeApplication,
        actor,
        comment: str = "",
    ) -> None:
        """
        PARTIALLY_APPROVED → APPROVED
        Barcha itemlar APPROVED_FOR_GROUPING ga o'tadi.
        """
        if application.status != RetakeApplicationStatus.PARTIALLY_APPROVED:
            raise ApplicationServiceError(
                "Bu ariza supervisor tasdig'i bosqichida emas."
            )

        old = application.status
        application.status = RetakeApplicationStatus.APPROVED
        application.items.all().update(status=RetakeItemStatus.APPROVED_FOR_GROUPING)
        application.save(update_fields=["status", "updated_at"])

        ApplicationService.log_event(
            application, "supervisor_approved", old, application.status, actor, comment
        )

    @staticmethod
    def supervisor_reject(
        application: RetakeApplication,
        actor,
        comment: str = "",
    ) -> None:
        """
        PARTIALLY_APPROVED → RETURNED
        Barcha itemlar SUPERVISOR_RETURNED ga o'tadi.
        """
        if application.status != RetakeApplicationStatus.PARTIALLY_APPROVED:
            raise ApplicationServiceError(
                "Bu ariza supervisor tasdig'i bosqichida emas."
            )

        old = application.status
        application.status = RetakeApplicationStatus.RETURNED
        application.items.all().update(status=RetakeItemStatus.SUPERVISOR_RETURNED)
        application.save(update_fields=["status", "updated_at"])

        ApplicationService.log_event(
            application, "supervisor_rejected", old, application.status, actor, comment
        )

    # ── Admin: bekor qilish ────────────────────────────────────────

    @staticmethod
    def cancel(
        application: RetakeApplication,
        actor,
        comment: str = "",
    ) -> None:
        """Istalgan holatdan CANCELLED ga."""
        if application.status == RetakeApplicationStatus.COMPLETED:
            raise ApplicationServiceError(
                "Yakunlangan arizani bekor qilib bo'lmaydi."
            )

        old = application.status
        application.status = RetakeApplicationStatus.CANCELLED
        application.items.all().update(status=RetakeItemStatus.CANCELLED)
        application.save(update_fields=["status", "updated_at"])

        ApplicationService.log_event(
            application, "cancelled", old, application.status, actor, comment
        )

    # ── Yakunlash ─────────────────────────────────────────────────

    @staticmethod
    def complete(
        application: RetakeApplication,
        actor,
        comment: str = "",
    ) -> None:
        """Barcha itemlar COMPLETED bo'lganda ariza COMPLETED ga o'tadi."""
        items = application.items.all()
        non_completed = items.exclude(
            status__in=[RetakeItemStatus.COMPLETED, RetakeItemStatus.CANCELLED]
        )
        if non_completed.exists():
            raise ApplicationServiceError(
                "Barcha fan elementlari yakunlanmagan."
            )

        old = application.status
        application.status = RetakeApplicationStatus.COMPLETED
        application.save(update_fields=["status", "updated_at"])

        ApplicationService.log_event(
            application, "completed", old, application.status, actor, comment
        )
