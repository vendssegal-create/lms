"""
Retake modellari uchun unit testlar.

Ishga tushirish:
    python manage.py test retake.tests.test_models
"""

from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from retake.models import (
    RetakeCycle,
    RetakeCycleStatus,
    RetakeApplicationStatus,
    RetakeItemStatus,
    ExamSheetStatus,
    SubjectGroupStatus,
    PaymentReviewStatus,
    AssessmentScheduleStatus,
)


class RetakeCycleModelTest(TestCase):

    def test_create_cycle_defaults(self):
        cycle = RetakeCycle.objects.create(
            name="2025 Yoz Sessiya",
            academic_year="2025-2026",
        )
        self.assertEqual(cycle.status, RetakeCycleStatus.DRAFT)
        self.assertEqual(cycle.max_allowed_credits, Decimal("15.00"))
        self.assertIsNone(cycle.starts_at)
        self.assertIsNone(cycle.ends_at)

    def test_cycle_str(self):
        cycle = RetakeCycle(name="Test Sikl", academic_year="2025-2026")
        self.assertEqual(str(cycle), "Test Sikl")

    def test_cycle_unique_together(self):
        RetakeCycle.objects.create(
            name="Sikl 1",
            academic_year="2025-2026",
        )
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            RetakeCycle.objects.create(
                name="Sikl 1",
                academic_year="2025-2026",
            )

    def test_cycle_status_choices(self):
        valid = {c[0] for c in RetakeCycleStatus.choices}
        self.assertIn("draft", valid)
        self.assertIn("open", valid)
        self.assertIn("closed", valid)
        self.assertIn("archived", valid)

    def test_cycle_updated_at_auto(self):
        cycle = RetakeCycle.objects.create(
            name="Auto Update Test",
            academic_year="2025-2026",
        )
        created = cycle.updated_at
        cycle.name = "Updated Name"
        cycle.save()
        cycle.refresh_from_db()
        self.assertGreaterEqual(cycle.updated_at, created)


class RetakeApplicationStatusTest(TestCase):

    def test_application_status_choices(self):
        valid = {c[0] for c in RetakeApplicationStatus.choices}
        expected = {
            "draft", "in_review", "partially_approved",
            "approved", "returned", "completed", "cancelled",
        }
        self.assertEqual(valid, expected)

    def test_item_status_choices(self):
        valid = {c[0] for c in RetakeItemStatus.choices}
        expected = {
            "draft", "submitted_to_accounting", "payment_rejected",
            "payment_approved", "awaiting_supervisor", "supervisor_returned",
            "approved_for_grouping", "grouped", "scheduled",
            "grade_entry_open", "completed", "cancelled",
        }
        self.assertEqual(valid, expected)


class ExamSheetStatusChoicesTest(TestCase):

    def test_exam_sheet_statuses(self):
        valid = {c[0] for c in ExamSheetStatus.choices}
        self.assertIn("draft", valid)
        self.assertIn("open", valid)
        self.assertIn("submitted", valid)
        self.assertIn("locked", valid)


class SubjectGroupStatusTest(TestCase):

    def test_group_status_choices(self):
        valid = {c[0] for c in SubjectGroupStatus.choices}
        self.assertIn("draft", valid)
        self.assertIn("active", valid)
        self.assertIn("completed", valid)


class PaymentReviewStatusTest(TestCase):

    def test_payment_review_choices(self):
        valid = {c[0] for c in PaymentReviewStatus.choices}
        self.assertIn("pending", valid)
        self.assertIn("approved", valid)
        self.assertIn("rejected", valid)


class AssessmentScheduleStatusTest(TestCase):

    def test_assessment_schedule_choices(self):
        valid = {c[0] for c in AssessmentScheduleStatus.choices}
        self.assertIn("draft", valid)
        self.assertIn("open", valid)
        self.assertIn("closed", valid)
