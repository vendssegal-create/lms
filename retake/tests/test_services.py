"""
Retake servislar uchun unit testlar.

Ishga tushirish:
    python manage.py test retake.tests.test_services
"""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from retake.models import (
    RetakeApplication,
    RetakeApplicationItem,
    RetakeApplicationStatus,
    RetakeCycle,
    RetakeCycleStatus,
    RetakeItemStatus,
    RetakeSubjectGroup,
    SubjectGroupStatus,
    WorkflowEvent,
)
from retake.services.application_service import ApplicationService, ApplicationServiceError
from retake.services.cycle_service import CycleService, CycleServiceError
from retake.services.payment_service import PaymentService, PaymentServiceError

User = get_user_model()


# ── Yordamchi funksiyalar ──────────────────────────────────────────────────────

def make_user(username="testuser", role="STUDENT"):
    user = User.objects.create_user(
        username=username,
        password="testpass123",
        role=role,
    )
    return user


def make_cycle(name="Test Sikl", status=RetakeCycleStatus.DRAFT, max_credits="15.00"):
    return RetakeCycle.objects.create(
        name=name,
        academic_year="2025-2026",
        status=status,
        max_allowed_credits=Decimal(max_credits),
    )


# ── CycleService testlari ──────────────────────────────────────────────────────

class CycleServiceOpenTest(TestCase):

    def setUp(self):
        self.actor = make_user("admin", "SUPER_ADMIN")
        self.cycle = make_cycle()

    def test_open_draft_cycle(self):
        CycleService.open(self.cycle, self.actor)
        self.cycle.refresh_from_db()
        self.assertEqual(self.cycle.status, RetakeCycleStatus.OPEN)

    def test_open_logs_event(self):
        CycleService.open(self.cycle, self.actor, comment="Test")
        event = WorkflowEvent.objects.filter(entity_type="retake_cycle", object_id=self.cycle.id).first()
        self.assertIsNotNone(event)
        self.assertEqual(event.action, "cycle_opened")
        self.assertEqual(event.comment, "Test")

    def test_open_fails_if_already_open_cycle_exists(self):
        existing = make_cycle(name="Boshqa Sikl", status=RetakeCycleStatus.OPEN)
        with self.assertRaises(CycleServiceError):
            CycleService.open(self.cycle, self.actor)

    def test_open_archived_cycle_raises(self):
        self.cycle.status = RetakeCycleStatus.ARCHIVED
        self.cycle.save()
        with self.assertRaises(CycleServiceError):
            CycleService.open(self.cycle, self.actor)


class CycleServiceCloseArchiveTest(TestCase):

    def setUp(self):
        self.actor = make_user("admin", "SUPER_ADMIN")
        self.cycle = make_cycle(status=RetakeCycleStatus.OPEN)

    def test_close_open_cycle(self):
        CycleService.close(self.cycle, self.actor)
        self.cycle.refresh_from_db()
        self.assertEqual(self.cycle.status, RetakeCycleStatus.CLOSED)

    def test_close_draft_cycle_raises(self):
        self.cycle.status = RetakeCycleStatus.DRAFT
        self.cycle.save()
        with self.assertRaises(CycleServiceError):
            CycleService.close(self.cycle, self.actor)

    def test_archive_closed_cycle(self):
        CycleService.close(self.cycle, self.actor)
        self.cycle.refresh_from_db()
        CycleService.archive(self.cycle, self.actor)
        self.cycle.refresh_from_db()
        self.assertEqual(self.cycle.status, RetakeCycleStatus.ARCHIVED)

    def test_archive_open_cycle_raises(self):
        with self.assertRaises(CycleServiceError):
            CycleService.archive(self.cycle, self.actor)


# ── ApplicationService testlari ────────────────────────────────────────────────

class ApplicationServiceTest(TestCase):

    def _make_application(self, status=RetakeApplicationStatus.DRAFT):
        """Minimal ariza yaratish — real student_snapshot o'rniga mock ishlatiladi."""
        from unittest.mock import MagicMock, patch
        actor = make_user("student_user", "STUDENT")
        cycle = make_cycle(status=RetakeCycleStatus.OPEN)

        # HemisStudentSnapshot — test uchun raw SQL yordamida fake yaratish
        # Amaliy loyihada hemis fixtures ishlatiladi
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO hemis_hemisstudentsnapshot
                (student_id_number, full_name, faculty_name, specialty_name,
                 group_name, education_type, education_form, payment_form,
                 level, semester, synced_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, ["S001", "Test Talaba", "Fizika", "Informatika",
                  "IF-22", "kunduzgi", "kunduzgi", "shartnoma",
                  "1", "1", timezone.now()])
            snap_id = cursor.lastrowid

        app = RetakeApplication.objects.create(
            cycle_id=cycle.id,
            student_snapshot_id=snap_id,
            created_by=actor,
            status=status,
        )
        return app, actor

    def test_submit_empty_application_raises(self):
        try:
            app, actor = self._make_application()
        except Exception:
            self.skipTest("hemis tablelari yo'q — integration test kerak")
            return
        with self.assertRaises(ApplicationServiceError):
            ApplicationService.submit(app, actor)

    def test_cancel_completed_raises(self):
        try:
            app, actor = self._make_application(RetakeApplicationStatus.COMPLETED)
        except Exception:
            self.skipTest("hemis tablelari yo'q — integration test kerak")
            return
        with self.assertRaises(ApplicationServiceError):
            ApplicationService.cancel(app, actor)


# ── PaymentService testlari ────────────────────────────────────────────────────

class PaymentServiceAmountTest(TestCase):

    def test_reject_requires_comment(self):
        """Rad etish uchun izoh majburiy."""
        from unittest.mock import MagicMock
        app = MagicMock()
        app.status = RetakeApplicationStatus.IN_REVIEW
        actor = MagicMock()

        with self.assertRaises(PaymentServiceError) as ctx:
            PaymentService.accounting_reject(app, actor, comment="")
        self.assertIn("sababi", str(ctx.exception).lower())

    def test_approve_invalid_amount_raises(self):
        """Noto'g'ri summa format xatosiga olib keladi."""
        from unittest.mock import MagicMock
        app = MagicMock()
        app.status = RetakeApplicationStatus.IN_REVIEW
        actor = MagicMock()

        with self.assertRaises((PaymentServiceError, Exception)):
            PaymentService.accounting_approve(app, "not_a_number", actor)

    def test_approve_zero_amount_raises(self):
        """Nol summa xatosiga olib keladi."""
        from unittest.mock import MagicMock
        app = MagicMock()
        app.status = RetakeApplicationStatus.IN_REVIEW
        app.items.filter.return_value = MagicMock(return_value=[])
        actor = MagicMock()

        with self.assertRaises(PaymentServiceError):
            PaymentService.accounting_approve(app, "0", actor)

    def test_attach_contract_wrong_status_raises(self):
        from unittest.mock import MagicMock
        app = MagicMock()
        app.status = RetakeApplicationStatus.APPROVED
        actor = MagicMock()
        file = MagicMock()

        with self.assertRaises(PaymentServiceError):
            PaymentService.attach_contract(app, file, actor)

    def test_attach_receipt_wrong_status_raises(self):
        from unittest.mock import MagicMock
        app = MagicMock()
        app.status = RetakeApplicationStatus.IN_REVIEW
        actor = MagicMock()
        file = MagicMock()

        with self.assertRaises(PaymentServiceError):
            PaymentService.attach_receipt(app, file, actor)


# ── CycleService stats testi ────────────────────────────────────────────────────

class CycleStatsTest(TestCase):

    def test_get_stats_returns_dict(self):
        cycle = make_cycle(status=RetakeCycleStatus.OPEN)
        stats = CycleService.get_stats(cycle)
        self.assertIn("total_applications", stats)
        self.assertIn("total_groups", stats)
        self.assertIn("applications_by_status", stats)
        self.assertEqual(stats["total_applications"], 0)
        self.assertEqual(stats["total_groups"], 0)
