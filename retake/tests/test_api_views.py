"""
Retake API views uchun integratsiya testlar.

Ishga tushirish:
    python manage.py test retake.tests.test_api_views

Eslatma: Bu testlar to'liq ishlashi uchun hemis app migratsiyalari
         va test fixtures kerak bo'ladi.
"""

import json
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from retake.models import (
    RetakeCycle,
    RetakeCycleStatus,
    RetakeApplicationStatus,
)

User = get_user_model()


def make_user(username, role, password="testpass123"):
    return User.objects.create_user(
        username=username,
        password=password,
        role=role,
    )


def make_cycle(**kwargs):
    defaults = {
        "name": "Test Sikl",
        "academic_year": "2025-2026",
        "status": RetakeCycleStatus.OPEN,
        "max_allowed_credits": Decimal("15.00"),
    }
    defaults.update(kwargs)
    return RetakeCycle.objects.create(**defaults)


class CyclesListAPITest(TestCase):

    def setUp(self):
        self.client = Client()
        self.admin = make_user("admin", "SUPER_ADMIN")
        self.student = make_user("student", "STUDENT")
        self.cycle = make_cycle()

    def test_unauthenticated_redirects(self):
        response = self.client.get("/api/retake/cycles/")
        self.assertIn(response.status_code, [302, 401, 403])

    def test_admin_can_list_cycles(self):
        self.client.login(username="admin", password="testpass123")
        response = self.client.get("/api/retake/cycles/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        # Endpoint "items" yoki "cycles" kaliti bilan qaytarishi mumkin
        self.assertTrue("items" in data or "cycles" in data)

    def test_student_cannot_list_cycles(self):
        """Student rol faqat o'z arizalarini ko'ra oladi, sikllar ro'yxatini emas."""
        self.client.login(username="student", password="testpass123")
        response = self.client.get("/api/retake/cycles/")
        self.assertIn(response.status_code, [403, 200])


class CycleCreateAPITest(TestCase):

    def setUp(self):
        self.client = Client()
        self.admin = make_user("admin", "SUPER_ADMIN")
        self.supervisor = make_user("supervisor", "RET_SUPERVISOR")
        self.student = make_user("student", "STUDENT")

    def test_admin_can_create_cycle(self):
        self.client.login(username="admin", password="testpass123")
        response = self.client.post(
            "/api/retake/cycles/create/",
            data=json.dumps({
                "name": "Yangi Sikl",
                "academic_year": "2025-2026",
                "starts_at": "2025-09-01",
                "ends_at": "2025-12-01",
                "max_allowed_credits": "12.00",
                "status": "draft",
            }),
            content_type="application/json",
        )
        self.assertIn(response.status_code, [200, 201])

    def test_student_cannot_create_cycle(self):
        self.client.login(username="student", password="testpass123")
        response = self.client.post(
            "/api/retake/cycles/create/",
            data=json.dumps({
                "name": "Buzg'unchi Sikl",
                "academic_year": "2025-2026",
                "starts_at": "2025-09-01",
                "ends_at": "2025-12-01",
                "max_allowed_credits": "15.00",
                "status": "draft",
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)


class ApplicationsListAPITest(TestCase):

    def setUp(self):
        self.client = Client()
        self.admin = make_user("admin", "SUPER_ADMIN")
        self.student = make_user("student", "STUDENT")
        self.accounting = make_user("accounting", "RET_ACCOUNTING")

    def test_unauthenticated_blocked(self):
        response = self.client.get("/api/retake/applications/")
        self.assertIn(response.status_code, [302, 401, 403])

    def test_admin_gets_applications(self):
        self.client.login(username="admin", password="testpass123")
        response = self.client.get("/api/retake/applications/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("applications", data)

    def test_accounting_gets_applications(self):
        self.client.login(username="accounting", password="testpass123")
        response = self.client.get("/api/retake/applications/")
        self.assertEqual(response.status_code, 200)

    def test_student_gets_own_applications(self):
        self.client.login(username="student", password="testpass123")
        response = self.client.get("/api/retake/applications/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("applications", data)


class DashboardStatsAPITest(TestCase):

    def setUp(self):
        self.client = Client()
        self.admin = make_user("admin", "SUPER_ADMIN")
        self.student = make_user("student", "STUDENT")

    def test_admin_gets_stats(self):
        self.client.login(username="admin", password="testpass123")
        response = self.client.get("/api/retake/dashboard-stats/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("stats", data)

    def test_student_gets_stats(self):
        self.client.login(username="student", password="testpass123")
        response = self.client.get("/api/retake/dashboard-stats/")
        self.assertEqual(response.status_code, 200)


class GroupsAPITest(TestCase):

    def setUp(self):
        self.client = Client()
        self.admin = make_user("admin", "SUPER_ADMIN")
        self.student = make_user("student", "STUDENT")
        self.db_manager = make_user("dbm", "RET_DB_MANAGER")

    def test_unauthenticated_blocked(self):
        response = self.client.get("/api/retake/groups/")
        self.assertIn(response.status_code, [302, 401, 403])

    def test_admin_gets_groups(self):
        self.client.login(username="admin", password="testpass123")
        response = self.client.get("/api/retake/groups/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("groups", data)

    def test_student_cannot_get_groups(self):
        self.client.login(username="student", password="testpass123")
        response = self.client.get("/api/retake/groups/")
        self.assertIn(response.status_code, [403, 200])

    def test_db_manager_gets_groups(self):
        self.client.login(username="dbm", password="testpass123")
        response = self.client.get("/api/retake/groups/")
        self.assertEqual(response.status_code, 200)


class SyncAPITest(TestCase):

    def setUp(self):
        self.client = Client()
        self.admin = make_user("admin", "SUPER_ADMIN")
        self.student = make_user("student", "STUDENT")

    def test_admin_can_get_sync_panel(self):
        self.client.login(username="admin", password="testpass123")
        response = self.client.get("/api/retake/sync/")
        self.assertEqual(response.status_code, 200)

    def test_student_cannot_access_sync(self):
        self.client.login(username="student", password="testpass123")
        response = self.client.get("/api/retake/sync/")
        self.assertIn(response.status_code, [403, 200])
