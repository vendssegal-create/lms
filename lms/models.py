from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from django.utils import timezone

class ControlType(models.TextChoices):
    CURRENT = "current", _("Joriy nazorat")
    MIDTERM = "midterm", _("Oraliq nazorat")
    FINAL = "final", _("Yakuniy nazorat")
    OTHER = "other", _("Boshqa")

class SectionResourceType(models.TextChoices):
    FILE = "file", _("Fayl")
    LINK = "link", _("Havola")
    VIDEO = "video", _("Video")
    TEXT = "text", _("Matn sahifasi")
    AUDIO = "audio", _("Audio")
    EMBED = "embed", _("Embed / iframe")
    H5P = "h5p", _("H5P interaktiv")
    SCORM = "scorm", _("SCORM paketi")
    FOLDER = "folder", _("Papka")
    BOOK = "book", _("Kitob")
    GLOSSARY = "glossary", _("Glossariy")
    CERTIFICATE = "certificate", _("Sertifikat")

class Course(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField()
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='courses_taught'
    )
    image = models.ImageField(upload_to='courses/', null=True, blank=True)
    image_url = models.URLField(max_length=1000, null=True, blank=True)
    deadline = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class Enrollment(models.Model):
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='enrollments'
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='enrollments')
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('student', 'course')

    def __str__(self):
        return f"{self.student.username} -> {self.course.title}"

class Section(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='sections')
    name = models.CharField(max_length=200)
    order = models.IntegerField(default=0)
    description = models.TextField(blank=True, default="")
    file = models.FileField(upload_to='sections/', null=True, blank=True)
    is_published = models.BooleanField(default=True)
    unlock_mode = models.CharField(max_length=16, default="open")
    prerequisite_section = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='unlocks'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.course.title} - {self.name}"

class SectionResource(models.Model):
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='resources')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    resource_type = models.CharField(
        max_length=16, 
        choices=SectionResourceType.choices, 
        default=SectionResourceType.FILE
    )
    order = models.IntegerField(default=0)
    is_visible = models.BooleanField(default=True)
    file = models.FileField(upload_to='resources/', null=True, blank=True)
    original_filename = models.CharField(max_length=255, default="", blank=True)
    file_size = models.PositiveBigIntegerField(null=True, blank=True)
    mime_type = models.CharField(max_length=128, blank=True, default="")
    url = models.URLField(max_length=2000, null=True, blank=True)
    open_in_new_tab = models.BooleanField(default=True)
    content = models.TextField(null=True, blank=True)
    video_source = models.CharField(
        max_length=16,
        default="url",
        choices=(
            ("url", "URL"),
            ("youtube", "YouTube"),
            ("vimeo", "Vimeo"),
            ("file", "Fayl"),
        ),
    )
    video_poster_url = models.URLField(max_length=2000, null=True, blank=True)
    audio_transcript = models.TextField(blank=True, default="")
    h5p_embed_code = models.TextField(blank=True, default="")
    scorm_version = models.CharField(max_length=16, blank=True, default="")
    scorm_entry_url = models.CharField(max_length=500, blank=True, default="")
    embed_width = models.CharField(max_length=16, default="100%")
    embed_height = models.CharField(max_length=16, default="500px")
    require_completion = models.BooleanField(default=False)
    estimated_time_minutes = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order']


class ResourceView(models.Model):
    resource = models.ForeignKey(SectionResource, on_delete=models.CASCADE, related_name='views')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    first_viewed_at = models.DateTimeField(auto_now_add=True)
    last_viewed_at = models.DateTimeField(auto_now=True)
    view_count = models.IntegerField(default=1)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    time_spent_seconds = models.IntegerField(default=0)

    class Meta:
        unique_together = ('resource', 'student')


class BookChapter(models.Model):
    resource = models.ForeignKey(SectionResource, on_delete=models.CASCADE, related_name='chapters')
    title = models.CharField(max_length=255)
    content = models.TextField()
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']


class GlossaryEntry(models.Model):
    resource = models.ForeignKey(SectionResource, on_delete=models.CASCADE, related_name='glossary_entries')
    term = models.CharField(max_length=255)
    definition = models.TextField()
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['term']


class FolderFile(models.Model):
    resource = models.ForeignKey(SectionResource, on_delete=models.CASCADE, related_name='folder_files')
    file = models.FileField(upload_to='folder_files/')
    original_filename = models.CharField(max_length=255)
    file_size = models.PositiveBigIntegerField(null=True, blank=True)
    mime_type = models.CharField(max_length=128, blank=True, default="")
    order = models.IntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']

class SectionCompletion(models.Model):
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='completions')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('section', 'student')

class Assignment(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='assignments')
    section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True, blank=True, related_name='assignments')
    title = models.CharField(max_length=200)
    description = models.TextField()
    max_score = models.IntegerField(default=100)
    deadline = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    allow_late = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

class Submission(models.Model):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='submissions')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    file = models.FileField(upload_to='submissions/', null=True, blank=True)
    comment = models.TextField(blank=True, default="")
    score = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    feedback = models.TextField(blank=True, default="")
    status = models.CharField(max_length=16, default="submitted")
    submitted_at = models.DateTimeField(auto_now_add=True)
    graded_at = models.DateTimeField(null=True, blank=True)

class SectionSubmission(models.Model):
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='submissions')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    file = models.FileField(upload_to='submissions/')
    comment = models.TextField(blank=True, default="")
    score = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    feedback = models.TextField(blank=True, default="")
    status = models.CharField(max_length=16, default="submitted")
    submitted_at = models.DateTimeField(auto_now_add=True)
    graded_at = models.DateTimeField(null=True, blank=True)

class Test(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='tests')
    section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True, blank=True, related_name='tests')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    duration_minutes = models.IntegerField()
    max_score = models.IntegerField()
    control_type = models.CharField(
        max_length=16, 
        choices=ControlType.choices, 
        default=ControlType.OTHER
    )
    attempts_allowed = models.IntegerField(default=1)
    question_count = models.IntegerField()
    is_random_order = models.BooleanField(default=False)
    proctoring_enabled = models.BooleanField(default=False)
    face_id_required = models.BooleanField(default=False)
    max_tab_switches = models.IntegerField(default=3)
    created_at = models.DateTimeField(auto_now_add=True)

class Question(models.Model):
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='questions')
    text = models.TextField()
    option1 = models.TextField()
    option2 = models.TextField()
    option3 = models.TextField(blank=True, default="")
    option4 = models.TextField(blank=True, default="")
    correct_answer = models.CharField(max_length=10)
    score = models.IntegerField(default=1)

class TestAttempt(models.Model):
    student = models.ForeignKey('users.StudentProfile', on_delete=models.CASCADE, related_name='test_attempts')
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='attempts')
    score = models.FloatField(default=0)
    correct_count = models.IntegerField(default=0)
    answers = models.JSONField(null=True, blank=True)
    question_order = models.JSONField(default=list, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    is_completed = models.BooleanField(default=False)

class ProctorLog(models.Model):
    attempt = models.ForeignKey(TestAttempt, on_delete=models.CASCADE, related_name='proctor_logs')
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='proctor_logs')
    event_type = models.CharField(max_length=32)
    timestamp = models.DateTimeField(auto_now_add=True)
    details = models.JSONField(default=dict, blank=True)

class CourseGradebook(models.Model):
    course = models.OneToOneField(Course, on_delete=models.CASCADE, related_name='gradebook')
    current_max = models.IntegerField(default=30)
    midterm_max = models.IntegerField(default=30)
    final_max = models.IntegerField(default=40)
    is_locked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

class GradebookEntry(models.Model):
    gradebook = models.ForeignKey(CourseGradebook, on_delete=models.CASCADE, related_name='entries')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='gradebook_entries')
    current_score = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    midterm_score = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    final_score = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    total_score = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    linked_test = models.ForeignKey(Test, on_delete=models.SET_NULL, null=True, blank=True)
    entered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='entered_grades'
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('gradebook', 'student')

class CourseMeeting(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='meetings')
    section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True, blank=True, related_name='meetings')
    title = models.CharField(max_length=255)
    meeting_url = models.URLField(max_length=1000)
    meeting_type = models.CharField(max_length=32, default="zoom")
    start_time = models.DateTimeField()
    duration_minutes = models.IntegerField(default=60)
    created_at = models.DateTimeField(auto_now_add=True)

class CourseFeedback(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='feedbacks')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='course_feedbacks')
    rating = models.IntegerField(default=5)
    comment = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class ForumTopic(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='forum_topics')
    section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True, blank=True, related_name='forum_topics')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='forum_topics')
    title = models.CharField(max_length=255)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

class ForumPost(models.Model):
    topic = models.ForeignKey(ForumTopic, on_delete=models.CASCADE, related_name='posts')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='forum_posts')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)


class NotificationType(models.TextChoices):
    COURSE_ENROLLED = "course_enrolled", "Kursga qo'shildi"
    DEADLINE_WARNING = "deadline_warning", "Muddat yaqinlashmoqda"
    DEADLINE_OVERDUE = "deadline_overdue", "Muddat o'tib ketdi"
    DEADLINE_EXTENDED = "deadline_extended", "Muddat uzaytirildi"
    EXTENSION_APPROVED = "extension_approved", "So'rov tasdiqlandi"
    EXTENSION_REJECTED = "extension_rejected", "So'rov rad etildi"
    SYSTEM = "system", "Tizim xabari"


class Notification(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=255)
    message = models.TextField()
    link = models.CharField(max_length=500, null=True, blank=True)
    notif_type = models.CharField(
        max_length=32,
        choices=NotificationType.choices,
        default=NotificationType.SYSTEM,
        db_index=True,
    )
    priority = models.CharField(
        max_length=8,
        choices=[("low", "Low"), ("medium", "Medium"), ("high", "High"), ("urgent", "Urgent")],
        default="medium",
    )
    meta = models.JSONField(default=dict, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_dismissed = models.BooleanField(default=False)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['user', 'is_read', 'created_at'])]


class DeadlineExtensionRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Kutilmoqda"
        APPROVED = "approved", "Tasdiqlandi"
        REJECTED = "rejected", "Rad etildi"

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="extension_requests",
    )
    assignment = models.ForeignKey(
        "Assignment",
        on_delete=models.CASCADE,
        related_name="extension_requests",
    )
    reason = models.TextField(help_text="Talaba sababi")
    requested_deadline = models.DateTimeField(help_text="Talaba so'ragan yangi muddat")
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    admin_note = models.TextField(blank=True, default="")
    approved_deadline = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Admin tasdiqlagan yangi muddat",
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_extensions",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("student", "assignment")
        ordering = ["-created_at"]


class AssignmentStudentDeadline(models.Model):
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="custom_deadlines",
    )
    assignment = models.ForeignKey(
        "Assignment",
        on_delete=models.CASCADE,
        related_name="custom_deadlines",
    )
    deadline = models.DateTimeField()
    set_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="set_deadlines",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("student", "assignment")


class CertificateTemplate(models.Model):
    name = models.CharField(max_length=200)
    docx_file = models.FileField(
        upload_to='certificate_templates/docx/',
        null=True,
        blank=True,
        help_text="DOCX shablon (LibreOffice orqali PDF). Placeholderlar: {{student_name}}, {{course_name}}, "
        "{{certificate_date}}, {{serial_number}}, {{hours}}, {{score}}, {{max_score}}, {{issued_by}}, "
        "{{position}}, {{verify_url}}, {{qr_placeholder}}, {{institution_name}}",
    )
    institution_name = models.CharField(max_length=255, blank=True, default="")
    issued_by = models.CharField(max_length=200, blank=True, default="")
    position = models.CharField(max_length=200, blank=True, default="")
    hours_per_course = models.IntegerField(null=True, blank=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, null=True, blank=True, related_name='certificate_templates')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class CertificateTrigger(models.Model):
    class TriggerType(models.TextChoices):
        COURSE_COMPLETE = "course_complete", _("Kurs tugallanganda")
        SECTION_COMPLETE = "section_complete", _("Mavzu tugallanganda")
        TEST_SCORE = "test_score", _("Test natijasiga ko'ra")

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='certificate_triggers')
    template = models.ForeignKey(CertificateTemplate, on_delete=models.CASCADE)
    trigger_type = models.CharField(max_length=32, choices=TriggerType.choices)
    target_section = models.ForeignKey(Section, on_delete=models.CASCADE, null=True, blank=True)
    target_test = models.ForeignKey(Test, on_delete=models.CASCADE, null=True, blank=True)
    min_score_percentage = models.IntegerField(null=True, blank=True, help_text="Minimum score percentage for test trigger")
    message_if_locked = models.TextField(blank=True, default="Sertifikat olish uchun barcha shartlarni bajaring.")

    def __str__(self):
        return f"{self.course.title} - {self.trigger_type}"

class UserCertificate(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='certificates')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='user_certificates')
    template = models.ForeignKey(CertificateTemplate, on_delete=models.SET_NULL, null=True)
    serial_number = models.CharField(max_length=50, unique=True)
    pdf_file = models.FileField(upload_to='certificates/', null=True, blank=True)
    pdf_generated_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="PDF oxirgi marta generatsiya qilingan vaqt; shablon updated_at dan eski bo‘lsa qayta ishlab chiqariladi.",
    )
    qr_data = models.CharField(max_length=255, blank=True)
    issued_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'course')

    def __str__(self):
        return f"{self.user.username} - {self.course.title} ({self.serial_number})"


class CertificateTemplateVersion(models.Model):
    template = models.ForeignKey(
        CertificateTemplate, on_delete=models.CASCADE, related_name='versions'
    )
    docx_file = models.FileField(upload_to='certificate_templates/versions/')
    version_number = models.PositiveIntegerField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    note = models.CharField(max_length=500, blank=True, default='')

    class Meta:
        ordering = ['-version_number']
        unique_together = ('template', 'version_number')

    def __str__(self):
        return f"v{self.version_number} — {self.template.name}"
