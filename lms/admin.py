from django.contrib import admin
from django.utils.html import format_html
from .models import (
    Course,
    Enrollment,
    Section,
    SectionResource,
    SectionCompletion,
    Assignment,
    Submission,
    SectionSubmission,
    CourseMeeting,
    Test,
    Question,
    TestAttempt,
    ProctorLog,
    CourseGradebook,
    GradebookEntry,
    ForumTopic,
    ForumPost,
    Notification,
    UserCertificate,
    CertificateTemplate,
    CertificateTrigger,
    CertificateTemplateVersion,
)

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('title', 'teacher', 'deadline', 'is_active', 'created_at')
    search_fields = ('title', 'teacher__username')
    list_filter = ('is_active', 'teacher')

@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ('student', 'course', 'enrolled_at')
    search_fields = ('student__username', 'course__title')

@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ('name', 'course', 'order', 'is_published', 'unlock_mode')
    list_filter = ('course', 'is_published')
    search_fields = ('name', 'course__title')

@admin.register(SectionResource)
class SectionResourceAdmin(admin.ModelAdmin):
    list_display = ('title', 'section', 'resource_type', 'order')
    list_filter = ('resource_type', 'section__course')
    search_fields = ('title', 'section__name')

@admin.register(SectionCompletion)
class SectionCompletionAdmin(admin.ModelAdmin):
    list_display = ('student', 'section', 'completed_at')
    search_fields = ('student__username', 'section__name')

@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'section')
    search_fields = ('title', 'course__title')

@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ('student', 'assignment', 'score', 'status', 'submitted_at')
    list_filter = ('status',)
    search_fields = ('student__username', 'assignment__title')

@admin.register(SectionSubmission)
class SectionSubmissionAdmin(admin.ModelAdmin):
    list_display = ('student', 'section', 'score', 'status', 'submitted_at')
    list_filter = ('status',)

@admin.register(CourseMeeting)
class CourseMeetingAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'start_time', 'meeting_type')
    list_filter = ('meeting_type', 'course')

@admin.register(Test)
class TestAdmin(admin.ModelAdmin):
    list_display = ('name', 'course', 'start_datetime', 'duration_minutes')
    search_fields = ('name', 'course__title')

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('text', 'test', 'score')
    list_filter = ('test',)

@admin.register(TestAttempt)
class TestAttemptAdmin(admin.ModelAdmin):
    list_display = ('student', 'test', 'score', 'is_completed', 'started_at')
    list_filter = ('is_completed', 'test')

@admin.register(ProctorLog)
class ProctorLogAdmin(admin.ModelAdmin):
    list_display = ('attempt', 'event_type', 'timestamp')
    list_filter = ('event_type',)

@admin.register(CourseGradebook)
class CourseGradebookAdmin(admin.ModelAdmin):
    list_display = ('course', 'current_max', 'midterm_max', 'final_max')

@admin.register(GradebookEntry)
class GradebookEntryAdmin(admin.ModelAdmin):
    list_display = ('student', 'gradebook', 'total_score')
    search_fields = ('student__username',)

@admin.register(ForumTopic)
class ForumTopicAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'author', 'created_at')

@admin.register(ForumPost)
class ForumPostAdmin(admin.ModelAdmin):
    list_display = ('topic', 'author', 'created_at')

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'is_read', 'created_at')
    list_filter = ('is_read',)

# Smart Certification Admin registrations
@admin.register(CertificateTemplate)
class CertificateTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "course", "is_active", "docx_preview", "created_at")
    list_filter = ("is_active", "course")
    search_fields = ("name", "institution_name", "course__title")
    fieldsets = (
        ("Asosiy", {"fields": ("name", "course", "is_active")}),
        (
            "DOCX shablon",
            {
                "fields": ("docx_file", "institution_name", "issued_by", "position", "hours_per_course"),
                "description": "Placeholderlar: {{student_name}}, {{course_name}}, {{certificate_date}}, "
                "{{serial_number}}, {{hours}}, {{score}}, {{max_score}}, {{issued_by}}, {{position}}, "
                "{{verify_url}}, {{qr_placeholder}}, {{institution_name}}. "
                "Bo'sh bo'lsa — lms/certificate_assets/certificate_template.docx ishlatiladi.",
            },
        ),
    )

    @admin.display(description="DOCX")
    def docx_preview(self, obj):
        if obj.docx_file and obj.docx_file.name:
            return format_html(
                '<a href="{}" target="_blank" rel="noopener">DOCX</a>',
                obj.docx_file.url,
            )
        return "—"


@admin.register(CertificateTrigger)
class CertificateTriggerAdmin(admin.ModelAdmin):
    list_display = ('course', 'trigger_type', 'template')
    list_filter = ('trigger_type',)

@admin.register(UserCertificate)
class UserCertificateAdmin(admin.ModelAdmin):
    list_display = ("serial_number", "user", "course", "issued_at", "pdf_link")
    list_filter = ("course", "issued_at")
    search_fields = ("serial_number", "user__username", "user__first_name", "user__last_name", "course__title")
    readonly_fields = ("serial_number", "issued_at", "qr_data")
    actions = ("regenerate_pdf",)

    @admin.display(description="PDF")
    def pdf_link(self, obj):
        if obj.pdf_file and obj.pdf_file.name:
            return format_html('<a href="{}" target="_blank" rel="noopener">PDF</a>', obj.pdf_file.url)
        return "—"

    @admin.action(description="Tanlangan sertifikatlarni PDF qayta generatsiya qilish (DOCX rejim)")
    def regenerate_pdf(self, request, queryset):
        from lms.services.certificate_service import certificate_docx_source_ready, warm_certificate_pdf

        count = 0
        errors = []
        for cert in queryset.select_related("user", "course", "template"):
            tpl = cert.template
            if not tpl or not certificate_docx_source_ready(tpl):
                errors.append(f"{cert.serial_number}: DOCX shablon yo'q")
                continue
            ok, err = warm_certificate_pdf(cert.user, cert.course, force=True)
            if ok:
                count += 1
            else:
                errors.append(f"{cert.serial_number}: {err or 'noma’lum'}")

        msg = f"{count} ta sertifikat qayta generatsiya qilindi."
        if errors:
            msg += " Xatolar: " + "; ".join(errors[:5])
        self.message_user(request, msg)


@admin.register(CertificateTemplateVersion)
class CertificateTemplateVersionAdmin(admin.ModelAdmin):
    list_display = ('template', 'version_number', 'created_by', 'created_at')
    list_filter = ('template',)
    readonly_fields = ('template', 'version_number', 'docx_file', 'created_by', 'created_at')
    ordering = ('-created_at',)
