from django.db import models
from django.conf import settings
from decimal import Decimal

class HemisSyncStatus(models.TextChoices):
    RUNNING = "running", "Jarayonda"
    SUCCESS = "success", "Muvaffaqiyatli"
    PARTIAL = "partial", "Qisman"
    FAILED = "failed", "Muvaffaqiyatsiz"

class HemisStudentSnapshot(models.Model):
    hemis_student_id = models.BigIntegerField(unique=True)
    student_id_number = models.CharField(max_length=64, default="", blank=True)
    pinfl = models.CharField(max_length=32, default="", blank=True)
    full_name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=255, default="", blank=True)
    faculty_name = models.CharField(max_length=255, default="", blank=True)
    specialty_name = models.CharField(max_length=255, default="", blank=True)
    group_name = models.CharField(max_length=255, default="", blank=True)
    semester_code = models.CharField(max_length=64, default="", blank=True)
    semester_name = models.CharField(max_length=255, default="", blank=True)
    curriculum_id = models.BigIntegerField(null=True, blank=True)
    email = models.EmailField(max_length=254, default="", blank=True)
    phone = models.CharField(max_length=32, default="", blank=True)
    raw_payload = models.JSONField(default=dict, blank=True)
    synced_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.full_name

class HemisSubjectSnapshot(models.Model):
    hemis_subject_id = models.BigIntegerField(unique=True)
    curriculum_subject_id = models.BigIntegerField(null=True, blank=True)
    subject_code = models.CharField(max_length=64, default="", blank=True)
    subject_name = models.CharField(max_length=255)
    credit = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))
    semester_code = models.CharField(max_length=64, default="", blank=True)
    semester_name = models.CharField(max_length=255, default="", blank=True)
    primary_exam_type = models.CharField(max_length=64, default="", blank=True)
    exam_types = models.JSONField(default=list, blank=True)
    raw_payload = models.JSONField(default=dict, blank=True)
    synced_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.subject_name

class HemisCurriculumSnapshot(models.Model):
    hemis_curriculum_id = models.BigIntegerField(unique=True)
    name = models.CharField(max_length=255)
    specialty_code = models.CharField(max_length=64, default="", blank=True)
    specialty_name = models.CharField(max_length=255, default="", blank=True)
    department_code = models.CharField(max_length=64, default="", blank=True)
    department_name = models.CharField(max_length=255, default="", blank=True)
    education_type_code = models.CharField(max_length=64, default="", blank=True)
    education_type_name = models.CharField(max_length=255, default="", blank=True)
    education_form_code = models.CharField(max_length=64, default="", blank=True)
    education_form_name = models.CharField(max_length=255, default="", blank=True)
    education_year_code = models.CharField(max_length=64, default="", blank=True)
    education_year_name = models.CharField(max_length=255, default="", blank=True)
    semester_count = models.IntegerField(default=0)
    active = models.BooleanField(default=True)
    raw_payload = models.JSONField(default=dict, blank=True)
    synced_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class HemisRoomSnapshot(models.Model):
    hemis_id = models.BigIntegerField(unique=True)
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=64, default="", blank=True)
    building_name = models.CharField(max_length=255, default="", blank=True)
    capacity = models.IntegerField(default=0)
    room_type = models.CharField(max_length=128, default="", blank=True)
    raw_payload = models.JSONField(default=dict, blank=True)
    synced_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class HemisSyncLog(models.Model):
    scope = models.CharField(max_length=32)
    status = models.CharField(max_length=16, choices=HemisSyncStatus.choices, default=HemisSyncStatus.RUNNING)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    initiated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    processed_count = models.IntegerField(default=0)
    message = models.TextField(default="", blank=True)
    summary = models.JSONField(default=dict, blank=True)

class HemisStudentDebt(models.Model):
    student_snapshot = models.ForeignKey(HemisStudentSnapshot, on_delete=models.CASCADE, related_name='debts')
    subject_snapshot = models.ForeignKey(HemisSubjectSnapshot, on_delete=models.CASCADE, related_name='debts')
    education_year = models.CharField(max_length=64, default="", blank=True)
    semester_label = models.CharField(max_length=64, default="", blank=True)
    exam_type_label = models.CharField(max_length=128, default="", blank=True)
    control_type = models.CharField(max_length=32, default="other")
    debt_status = models.CharField(max_length=64, default="", blank=True)
    total_point = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    grade = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    required_point = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("55.00"))
    is_active = models.BooleanField(default=True)
    raw_payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
