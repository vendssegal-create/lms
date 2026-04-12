"""Tests for the document editor API endpoints."""
import io
from pathlib import Path
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile

User = get_user_model()


class DocumentAPIBaseTest(TestCase):
    """Base class for document API tests."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_superuser(
            username='admin_test', password='admin123', email='admin@test.com'
        )
        cls.teacher = User.objects.create_user(
            username='teacher_test', password='teacher123', email='teacher@test.com'
        )
        cls.student = User.objects.create_user(
            username='student_test', password='student123', email='student@test.com'
        )

    def setUp(self):
        self.client = Client()


class TemplateDocxLoadTest(DocumentAPIBaseTest):
    """Test template docx load endpoint."""

    def test_unauthenticated_returns_403(self):
        response = self.client.get('/api/lms/teacher/certificate-template/999/docx/load/')
        self.assertIn(response.status_code, [401, 403])

    def test_nonexistent_template_returns_404(self):
        self.client.login(username='admin_test', password='admin123')
        response = self.client.get('/api/lms/teacher/certificate-template/99999/docx/load/')
        self.assertEqual(response.status_code, 404)


class TemplateDocxSaveTest(DocumentAPIBaseTest):
    """Test template docx save endpoint."""

    def test_unauthenticated_returns_403(self):
        response = self.client.post('/api/lms/teacher/certificate-template/999/docx/save/')
        self.assertIn(response.status_code, [401, 403])

    def test_save_without_file_returns_400(self):
        self.client.login(username='admin_test', password='admin123')
        from lms.models import CertificateTemplate, Course
        course = Course.objects.create(title='Test Course', teacher=self.teacher)
        template = CertificateTemplate.objects.create(
            course=course,
            name='Test Template',
        )
        response = self.client.post(
            f'/api/lms/teacher/certificate-template/{template.id}/docx/save/'
        )
        self.assertEqual(response.status_code, 400)


class ResourceFileLoadTest(DocumentAPIBaseTest):
    """Test resource file load endpoint."""

    def test_unauthenticated_returns_401(self):
        response = self.client.get('/api/lms/resources/999/file/load/')
        self.assertEqual(response.status_code, 401)

    def test_nonexistent_resource_returns_404(self):
        self.client.login(username='student_test', password='student123')
        response = self.client.get('/api/lms/resources/99999/file/load/')
        self.assertEqual(response.status_code, 404)
