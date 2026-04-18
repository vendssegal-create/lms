"""
PaymentService — Retake to'lov boshqaruvi biznes logikasi.

Mas'uliyat:
  - Shartnoma va kvitansiya fayl yuklash
  - Itemni buxgalteriyaga yuborish
  - Buxgalter: tasdiqlash / rad etish
  - Holat o'tishlari audit logi
"""

import os

from django.core.files.base import ContentFile
from django.utils import timezone

from retake.models import (
    PaymentReview,
    PaymentReviewStatus,
    RetakeApplication,
    RetakeApplicationItem,
    RetakeApplicationStatus,
    RetakeItemStatus,
    WorkflowEvent,
)


class PaymentServiceError(Exception):
    """To'lov workflow xatosi."""


class PaymentService:

    # ── Workflow event ─────────────────────────────────────────────

    @staticmethod
    def log_event(
        application: RetakeApplication,
        action: str,
        from_status: str,
        to_status: str,
        actor,
        comment: str = "",
    ) -> None:
        WorkflowEvent.objects.create(
            entity_type="retake_payment",
            object_id=application.id,
            action=action,
            from_status=from_status,
            to_status=to_status,
            actor=actor,
            comment=comment,
        )

    # ── Fayl yuklash ──────────────────────────────────────────────

    @staticmethod
    def attach_contract(
        application: RetakeApplication,
        file,
        actor,
    ) -> None:
        """
        Shartnoma faylini arizaga biriktiradi.
        Ariza DRAFT yoki RETURNED holatida bo'lishi kerak.
        """
        if application.status not in (
            RetakeApplicationStatus.DRAFT,
            RetakeApplicationStatus.RETURNED,
        ):
            raise PaymentServiceError(
                "Shartnomani faqat qoralama yoki qaytarilgan arizaga biriktirish mumkin."
            )

        application.contract_file = file
        application.save(update_fields=["contract_file", "updated_at"])

        PaymentService.log_event(
            application,
            "contract_attached",
            application.status,
            application.status,
            actor,
            f"Shartnoma yuklandi: {getattr(file, 'name', '')}",
        )

    @staticmethod
    def attach_receipt(
        application: RetakeApplication,
        file,
        actor,
    ) -> None:
        """
        Kvitansiya faylini arizaga biriktiradi.
        """
        if application.status not in (
            RetakeApplicationStatus.DRAFT,
            RetakeApplicationStatus.RETURNED,
        ):
            raise PaymentServiceError(
                "Kvitansiyani faqat qoralama yoki qaytarilgan arizaga biriktirish mumkin."
            )

        application.receipt_file = file
        application.save(update_fields=["receipt_file", "updated_at"])

        PaymentService.log_event(
            application,
            "receipt_attached",
            application.status,
            application.status,
            actor,
            f"Kvitansiya yuklandi: {getattr(file, 'name', '')}",
        )

    # ── Buxgalteriyaga yuborish ────────────────────────────────────

    @staticmethod
    def submit_to_accounting(
        application: RetakeApplication,
        declared_amount,
        actor,
    ) -> None:
        """
        Ariza va uning itemlarini buxgalteriyaga yuboradi.
        Holat: DRAFT | RETURNED → IN_REVIEW (ariza)
               DRAFT | PAYMENT_REJECTED → SUBMITTED_TO_ACCOUNTING (itemlar)

        Shartlar:
          - shartnoma va kvitansiya fayl yuklangan bo'lishi kerak
          - kamida bitta item bo'lishi kerak
        """
        if application.status not in (
            RetakeApplicationStatus.DRAFT,
            RetakeApplicationStatus.RETURNED,
        ):
            raise PaymentServiceError(
                "Faqat qoralama yoki qaytarilgan arizani yuborish mumkin."
            )

        if not application.contract_file:
            raise PaymentServiceError("Shartnoma fayli yuklanmagan.")

        if not application.receipt_file:
            raise PaymentServiceError("Kvitansiya fayli yuklanmagan.")

        items = list(
            application.items.filter(
                status__in=[RetakeItemStatus.DRAFT, RetakeItemStatus.PAYMENT_REJECTED]
            )
        )
        if not items:
            raise PaymentServiceError("Buxgalteriyaga yuboriladigan fan elementi yo'q.")

        old = application.status

        for item in items:
            item.status = RetakeItemStatus.SUBMITTED_TO_ACCOUNTING
        RetakeApplicationItem.objects.bulk_update(items, ["status"])

        application.declared_amount = declared_amount
        application.status = RetakeApplicationStatus.IN_REVIEW
        application.submitted_at = timezone.now()
        application.save(update_fields=[
            "declared_amount", "status", "submitted_at", "updated_at"
        ])

        PaymentService.log_event(
            application,
            "submitted_to_accounting",
            old,
            application.status,
            actor,
        )

    # ── Buxgalter: tasdiqlash ──────────────────────────────────────

    @staticmethod
    def accounting_approve(
        application: RetakeApplication,
        accountant_amount,
        actor,
        comment: str = "",
    ) -> None:
        """
        Buxgalter to'lovni tasdiqlaydi.
        IN_REVIEW → PARTIALLY_APPROVED (ariza)
        SUBMITTED_TO_ACCOUNTING → AWAITING_SUPERVISOR (itemlar)
        """
        from decimal import Decimal

        if application.status != RetakeApplicationStatus.IN_REVIEW:
            raise PaymentServiceError("Bu ariza buxgalteriya bosqichida emas.")

        try:
            amount = Decimal(str(accountant_amount))
        except Exception:
            raise PaymentServiceError("Noto'g'ri summa formati.")

        if amount <= 0:
            raise PaymentServiceError("Buxgalteriya summasi musbat bo'lishi kerak.")

        old = application.status
        items = list(
            application.items.filter(
                status=RetakeItemStatus.SUBMITTED_TO_ACCOUNTING
            )
        )

        for item in items:
            item.status = RetakeItemStatus.AWAITING_SUPERVISOR
            item.payment_date = timezone.now().date()
        RetakeApplicationItem.objects.bulk_update(items, ["status", "payment_date"])

        PaymentReview.objects.bulk_create([
            PaymentReview(
                application_item=item,
                status=PaymentReviewStatus.APPROVED,
                checked_by=actor,
                comment=comment,
            )
            for item in items
        ])

        application.accountant_amount = amount
        application.accountant_comment = comment
        application.status = RetakeApplicationStatus.PARTIALLY_APPROVED
        application.save(update_fields=[
            "accountant_amount", "accountant_comment", "status", "updated_at"
        ])

        PaymentService.log_event(
            application,
            "payment_approved",
            old,
            application.status,
            actor,
            comment,
        )

    # ── Buxgalter: rad etish ───────────────────────────────────────

    @staticmethod
    def accounting_reject(
        application: RetakeApplication,
        actor,
        comment: str = "",
    ) -> None:
        """
        Buxgalter to'lovni rad etadi.
        IN_REVIEW → RETURNED (ariza)
        SUBMITTED_TO_ACCOUNTING → PAYMENT_REJECTED (itemlar)
        """
        if application.status != RetakeApplicationStatus.IN_REVIEW:
            raise PaymentServiceError("Bu ariza buxgalteriya bosqichida emas.")

        if not comment.strip():
            raise PaymentServiceError("Rad etish sababi ko'rsatilishi kerak.")

        old = application.status

        items = list(
            application.items.filter(
                status=RetakeItemStatus.SUBMITTED_TO_ACCOUNTING
            )
        )
        for item in items:
            item.status = RetakeItemStatus.PAYMENT_REJECTED
        RetakeApplicationItem.objects.bulk_update(items, ["status"])

        PaymentReview.objects.bulk_create([
            PaymentReview(
                application_item=item,
                status=PaymentReviewStatus.REJECTED,
                checked_by=actor,
                comment=comment,
            )
            for item in items
        ])

        application.accountant_comment = comment
        application.status = RetakeApplicationStatus.RETURNED
        application.save(update_fields=["accountant_comment", "status", "updated_at"])

        PaymentService.log_event(
            application,
            "payment_rejected",
            old,
            application.status,
            actor,
            comment,
        )

    # ── To'lov holati tekshiruvi ───────────────────────────────────

    @staticmethod
    def get_payment_summary(application: RetakeApplication) -> dict:
        """Ariza to'lov holatini xulosa qiladi."""
        items = application.items.all()
        reviews = PaymentReview.objects.filter(
            application_item__in=items
        ).select_related("checked_by")

        return {
            "declared_amount": str(application.declared_amount or 0),
            "accountant_amount": str(application.accountant_amount or 0),
            "contract_attached": bool(application.contract_file),
            "receipt_attached": bool(application.receipt_file),
            "reviews": [
                {
                    "item_id": r.application_item_id,
                    "status": r.status,
                    "checked_by": str(r.checked_by) if r.checked_by else None,
                    "comment": r.comment,
                    "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
                }
                for r in reviews
            ],
        }
