from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from decimal import Decimal

class RetakeCycleStatus(models.TextChoices):
    DRAFT = "draft", _("Qoralama")
    OPEN = "open", _("Ochiq")
    CLOSED = "closed", _("Yopiq")
    ARCHIVED = "archived", _("Arxivlangan")

class RetakeApplicationStatus(models.TextChoices):
    DRAFT = "draft", _("Qoralama")
    IN_REVIEW = "in_review", _("Ko'rib chiqilmoqda")
    PARTIALLY_APPROVED = "partially_approved", _("Qisman tasdiqlangan")
    APPROVED = "approved", _("Tasdiqlangan")
    RETURNED = "returned", _("Qaytarilgan")
    COMPLETED = "completed", _("Yakunlangan")
    CANCELLED = "cancelled", _("Bekor qilingan")

class RetakeItemStatus(models.TextChoices):
    DRAFT = "draft", _("Qoralama")
    SUBMITTED_TO_ACCOUNTING = "submitted_to_accounting", _("Buxgalteriyaga yuborilgan")
    PAYMENT_REJECTED = "payment_rejected", _("To'lov rad etilgan")
    PAYMENT_APPROVED = "payment_approved", _("To'lov tasdiqlangan")
    AWAITING_SUPERVISOR = "awaiting_supervisor", _("Rahbar tasdig'ini kutmoqda")
    SUPERVISOR_RETURNED = "supervisor_returned", _("Rahbar qaytargan")
    APPROVED_FOR_GROUPING = "approved_for_grouping", _("Guruhlashga tayyor")
    GROUPED = "grouped", _("Guruhlangan")
    SCHEDULED = "scheduled", _("Jadvalga kiritilgan")
    GRADE_ENTRY_OPEN = "grade_entry_open", _("Baholash ochiq")
    COMPLETED = "completed", _("Yakunlangan")
    CANCELLED = "cancelled", _("Bekor qilingan")

class AssessmentScheduleStatus(models.TextChoices):
    DRAFT = "draft", _("Qoralama")
    OPEN = "open", _("Ochiq")
    CLOSED = "closed", _("Yopiq")

class ExamSheetStatus(models.TextChoices):
    DRAFT = "draft", _("Qoralama")
    OPEN = "open", _("Ochiq")
    SUBMITTED = "submitted", _("Topshirilgan")
    LOCKED = "locked", _("Bloklangan")

class SubjectGroupStatus(models.TextChoices):
    DRAFT = "draft", _("Qoralama")
    ACTIVE = "active", _("Faol")
    COMPLETED = "completed", _("Yakunlangan")

class PaymentReviewStatus(models.TextChoices):
    PENDING = "pending", _("Kutilmoqda")
    APPROVED = "approved", _("Tasdiqlangan")
    REJECTED = "rejected", _("Rad etilgan")

class RetakeCycle(models.Model):
    name = models.CharField(max_length=255)
    academic_year = models.CharField(max_length=32)
    status = models.CharField(max_length=32, choices=RetakeCycleStatus.choices, default=RetakeCycleStatus.DRAFT)
    starts_at = models.DateField(null=True, blank=True)
    ends_at = models.DateField(null=True, blank=True)
    max_allowed_credits = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("15.00"))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class RetakeApplication(models.Model):
    cycle = models.ForeignKey(RetakeCycle, on_delete=models.CASCADE, related_name='applications')
    student_snapshot = models.ForeignKey('hemis.HemisStudentSnapshot', on_delete=models.CASCADE)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=32, choices=RetakeApplicationStatus.choices, default=RetakeApplicationStatus.DRAFT)
    notes = models.TextField(blank=True, default="")
    declared_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    accountant_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    accountant_comment = models.TextField(blank=True, default="")
    contract_file = models.FileField(upload_to='retake/contracts/', null=True, blank=True)
    contract_original_name = models.CharField(max_length=255, default="", blank=True)
    receipt_file = models.FileField(upload_to='retake/receipts/', null=True, blank=True)
    receipt_original_name = models.CharField(max_length=255, default="", blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Ariza #{self.id} ({self.student_snapshot.full_name})"

    @property
    def total_credit(self):
        total = Decimal("0.00")
        for item in self.items.all():
            credit = getattr(item.subject_snapshot, "credit", None)
            if credit is not None:
                total += Decimal(str(credit))
        return total

    @property
    def contract_attached(self):
        return bool(self.contract_file)

    @property
    def receipt_attached(self):
        return bool(self.receipt_file)

    @property
    def has_required_documents(self):
        return self.contract_attached and self.receipt_attached

    @property
    def amounts_match(self):
        declared = Decimal(str(self.declared_amount or 0))
        accountant = Decimal(str(self.accountant_amount or 0))
        return declared > 0 and accountant > 0 and declared == accountant

    @property
    def can_move_to_supervisor(self):
        return self.has_required_documents and self.amounts_match

class RetakeApplicationItem(models.Model):
    application = models.ForeignKey(RetakeApplication, on_delete=models.CASCADE, related_name='items')
    subject_snapshot = models.ForeignKey('hemis.HemisSubjectSnapshot', on_delete=models.CASCADE)
    debt_snapshot = models.ForeignKey('hemis.HemisStudentDebt', on_delete=models.SET_NULL, null=True, blank=True)
    required_control_type = models.CharField(max_length=16, default="other")
    status = models.CharField(max_length=32, choices=RetakeItemStatus.choices, default=RetakeItemStatus.DRAFT)
    payment_date = models.DateField(null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class RetakeDocument(models.Model):
    application_item = models.ForeignKey(RetakeApplicationItem, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=32)
    file = models.FileField(upload_to='retake/items/')
    original_name = models.CharField(max_length=255, default="", blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class PaymentReview(models.Model):
    application_item = models.ForeignKey(RetakeApplicationItem, on_delete=models.CASCADE, related_name='payment_reviews')
    status = models.CharField(max_length=16, choices=PaymentReviewStatus.choices, default=PaymentReviewStatus.PENDING)
    checked_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    checked_at = models.DateTimeField(auto_now_add=True)
    comment = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

class WorkflowEvent(models.Model):
    entity_type = models.CharField(max_length=64)
    object_id = models.BigIntegerField()
    action = models.CharField(max_length=64)
    from_status = models.CharField(max_length=64, default="")
    to_status = models.CharField(max_length=64, default="")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    comment = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

class RetakeSubjectGroup(models.Model):
    cycle = models.ForeignKey(RetakeCycle, on_delete=models.CASCADE, related_name='groups')
    subject_snapshot = models.ForeignKey('hemis.HemisSubjectSnapshot', on_delete=models.CASCADE)
    code = models.CharField(max_length=64)
    teacher_profile = models.ForeignKey('users.TeacherProfile', on_delete=models.SET_NULL, null=True, blank=True)
    lms_course = models.ForeignKey('lms.Course', on_delete=models.SET_NULL, null=True, blank=True, related_name='retake_groups')
    capacity = models.IntegerField(default=0)
    status = models.CharField(max_length=16, choices=SubjectGroupStatus.choices, default=SubjectGroupStatus.DRAFT)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.code} ({self.subject_snapshot.subject_name})"

class RetakeGroupMembership(models.Model):
    group = models.ForeignKey(RetakeSubjectGroup, on_delete=models.CASCADE, related_name='memberships')
    application_item = models.OneToOneField(RetakeApplicationItem, on_delete=models.CASCADE, related_name='group_membership')
    student_snapshot = models.ForeignKey('hemis.HemisStudentSnapshot', on_delete=models.CASCADE)
    required_control_type = models.CharField(max_length=16, default="other")
    joined_at = models.DateTimeField(auto_now_add=True)

class ClassSchedule(models.Model):
    group = models.ForeignKey(RetakeSubjectGroup, on_delete=models.CASCADE, related_name='class_schedules')
    day_of_week = models.IntegerField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    room = models.CharField(max_length=128)
    start_date = models.DateField()
    end_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

class AssessmentSchedule(models.Model):
    group = models.ForeignKey(RetakeSubjectGroup, on_delete=models.CASCADE, related_name='assessment_schedules')
    student_group_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="HEMIS talabalar guruhi nomi (masalan: MT-21-1). Bo'sh bo'lsa — barcha."
    )
    control_type = models.CharField(max_length=16, default="other")
    scheduled_at = models.DateTimeField()
    pair_number = models.IntegerField(null=True, blank=True, help_text="Juftlik (para) raqami")
    room = models.CharField(max_length=128, blank=True, default="")
    teacher_profile = models.ForeignKey('users.TeacherProfile', on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=16, choices=AssessmentScheduleStatus.choices, default=AssessmentScheduleStatus.DRAFT)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('group', 'student_group_name', 'control_type')]

    CONTROL_TYPE_LABELS = {
        'final': 'Yakuniy nazorat',
        '1-jn': '1-joriy nazorat',
        '2-jn': '2-joriy nazorat',
        '1-on': '1-oraliq nazorat',
        '2-on': '2-oraliq nazorat',
        'current': 'Joriy nazorat',
        'midterm': 'Oraliq nazorat',
    }

    @property
    def control_type_label(self):
        return self.CONTROL_TYPE_LABELS.get(self.control_type, self.control_type)

    @property
    def pair_label(self):
        if self.pair_number:
            return f"{self.pair_number}-juftlik"
        return ""

class ExamSheet(models.Model):
    assessment_schedule = models.OneToOneField(AssessmentSchedule, on_delete=models.CASCADE, related_name='exam_sheet')
    sheet_no = models.CharField(max_length=64, unique=True)
    status = models.CharField(max_length=16, choices=ExamSheetStatus.choices, default=ExamSheetStatus.DRAFT)
    opened_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    locked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class ExamSheetEntry(models.Model):
    sheet = models.ForeignKey(ExamSheet, on_delete=models.CASCADE, related_name='entries')
    group_membership = models.ForeignKey(RetakeGroupMembership, on_delete=models.CASCADE, related_name='exam_entries')
    student_snapshot = models.ForeignKey('hemis.HemisStudentSnapshot', on_delete=models.CASCADE)
    score = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    is_absent = models.BooleanField(default=False)
    comment = models.TextField(blank=True, default="")
    entered_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    entered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class RetakeAssessmentConfig(models.Model):
    control_type = models.CharField(max_length=32, unique=True)
    max_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("30.00"))
    is_active = models.BooleanField(default=True)
    description = models.CharField(max_length=255, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.control_type.upper()} Config (Max: {self.max_score})"

class ExamSheetTemplate(models.Model):
    name = models.CharField(max_length=255)
    html_content = models.TextField(help_text="Qaydnoma HTML kodi")
    css_content = models.TextField(help_text="Qaydnoma CSS kodi", blank=True, default="")
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Shablon: {self.name} ({'Faol' if self.is_active else 'Nofaol'})"


class DBManagerFacultyAssignment(models.Model):
    """DB Manager foydalanuvchiga fakultet tayinlash."""
    db_manager_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='db_manager_faculty_assignments',
    )
    faculty_name = models.CharField(
        max_length=255,
        help_text="HemisStudentSnapshot.faculty_name bilan mos kelishi kerak"
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_db_manager_faculties'
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['db_manager_user', 'faculty_name']
        verbose_name = "MB Menejeri Fakultet Biriktiruvi"
        verbose_name_plural = "MB Menejerlari Fakultet Biriktiruvi"

    def __str__(self):
        return f"{self.db_manager_user.get_full_name()} → {self.faculty_name}"


class ServiceRegistratorFacultyAssignment(models.Model):
    """Xizmat ko'rsatish registratori foydalanuvchisiga fakultet tayinlash."""

    service_registrator_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="service_registrator_faculty_assignments",
    )
    faculty_name = models.CharField(
        max_length=255,
        help_text="HemisStudentSnapshot.faculty_name bilan mos kelishi kerak",
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_service_registrator_faculties",
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["service_registrator_user", "faculty_name"]
        verbose_name = "Xizmat registratori fakultet biriktiruvi"
        verbose_name_plural = "Xizmat registratorlari fakultet biriktiruvlari"

    def __str__(self):
        return f"{self.service_registrator_user.get_full_name()} → {self.faculty_name}"


class RetakeCourseEnrollmentLog(models.Model):
    """Qayta o'qish LMS kursiga talaba qo'shilganda log."""
    group = models.ForeignKey(
        RetakeSubjectGroup,
        on_delete=models.CASCADE,
        related_name='enrollment_logs'
    )
    lms_course = models.ForeignKey(
        'lms.Course',
        on_delete=models.CASCADE,
        related_name='retake_enrollment_logs'
    )
    student_snapshot = models.ForeignKey(
        'hemis.HemisStudentSnapshot',
        on_delete=models.CASCADE
    )
    hemis_student_group = models.CharField(
        max_length=255,
        default="",
        help_text="Student snapshot ning group_name qiymati"
    )
    enrolled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True
    )
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['group', 'lms_course', 'student_snapshot']
        verbose_name = "Retake LMS Enrollment Log"
