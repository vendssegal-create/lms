from django.contrib import admin

from retake.models import (
    RetakeCycle,
    RetakeApplication,
    RetakeApplicationItem,
    RetakeSubjectGroup,
    ExamSheet,
    WorkflowEvent,
    AssessmentSchedule,
    RetakeDocument,
    PaymentReview,
    RetakeGroupMembership,
    ClassSchedule,
    ExamSheetEntry,
    RetakeAssessmentConfig,
    ExamSheetTemplate,
    RetakeCourseEnrollmentLog,
    DBManagerFacultyAssignment,
    ServiceRegistratorFacultyAssignment,
)


@admin.register(RetakeCycle)
class RetakeCycleAdmin(admin.ModelAdmin):
    list_display = ("name", "academic_year", "status", "starts_at", "ends_at", "max_allowed_credits")
    list_filter = ("status", "academic_year")
    search_fields = ("name",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(RetakeApplication)
class RetakeApplicationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "get_student_name",
        "cycle",
        "status",
        "declared_amount",
        "accountant_amount",
        "created_at",
    )
    list_filter = ("status", "cycle")
    search_fields = (
        "student_snapshot__full_name",
        "student_snapshot__student_id_number",
    )
    readonly_fields = ("created_at", "updated_at", "submitted_at")
    raw_id_fields = ("student_snapshot", "cycle", "created_by")

    @admin.display(description="Talaba")
    def get_student_name(self, obj):
        if obj.student_snapshot:
            return obj.student_snapshot.full_name
        return "-"


@admin.register(RetakeApplicationItem)
class RetakeApplicationItemAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "application",
        "get_subject_name",
        "status",
        "amount",
        "payment_date",
    )
    list_filter = ("status",)
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("application", "subject_snapshot", "debt_snapshot")

    @admin.display(description="Fan")
    def get_subject_name(self, obj):
        if obj.subject_snapshot:
            return obj.subject_snapshot.subject_name
        return "-"


@admin.register(RetakeSubjectGroup)
class RetakeSubjectGroupAdmin(admin.ModelAdmin):
    list_display = ("code", "cycle", "status", "capacity", "get_subject_name", "teacher_profile")
    list_filter = ("status", "cycle")
    search_fields = ("code",)
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("cycle", "subject_snapshot", "teacher_profile", "lms_course", "created_by")

    @admin.display(description="Fan")
    def get_subject_name(self, obj):
        if obj.subject_snapshot:
            return obj.subject_snapshot.subject_name
        return "-"


@admin.register(AssessmentSchedule)
class AssessmentScheduleAdmin(admin.ModelAdmin):
    list_display = ("group", "control_type", "scheduled_at", "status", "student_group_name", "room")
    list_filter = ("status", "control_type")
    readonly_fields = ("created_at",)
    raw_id_fields = ("group", "teacher_profile", "created_by")


@admin.register(ExamSheet)
class ExamSheetAdmin(admin.ModelAdmin):
    list_display = ("sheet_no", "assessment_schedule", "status", "opened_at", "submitted_at", "locked_at")
    list_filter = ("status",)
    search_fields = ("sheet_no",)
    readonly_fields = ("created_at",)
    raw_id_fields = ("assessment_schedule",)


@admin.register(WorkflowEvent)
class WorkflowEventAdmin(admin.ModelAdmin):
    list_display = ("entity_type", "object_id", "action", "from_status", "to_status", "actor", "created_at")
    list_filter = ("entity_type", "action")
    readonly_fields = ("created_at",)
    raw_id_fields = ("actor",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(RetakeDocument)
class RetakeDocumentAdmin(admin.ModelAdmin):
    list_display = ("id", "application_item", "document_type", "original_name", "uploaded_by", "created_at")
    list_filter = ("document_type",)
    readonly_fields = ("created_at",)
    raw_id_fields = ("application_item", "uploaded_by")


@admin.register(PaymentReview)
class PaymentReviewAdmin(admin.ModelAdmin):
    list_display = ("id", "application_item", "status", "checked_by", "checked_at")
    list_filter = ("status",)
    raw_id_fields = ("application_item", "checked_by")


@admin.register(RetakeGroupMembership)
class RetakeGroupMembershipAdmin(admin.ModelAdmin):
    list_display = ("id", "group", "get_student_name", "required_control_type", "joined_at")
    raw_id_fields = ("group", "application_item", "student_snapshot")

    @admin.display(description="Talaba")
    def get_student_name(self, obj):
        if obj.student_snapshot:
            return obj.student_snapshot.full_name
        return "-"


@admin.register(ClassSchedule)
class ClassScheduleAdmin(admin.ModelAdmin):
    list_display = ("group", "day_of_week", "start_time", "end_time", "room", "start_date", "end_date")
    list_filter = ("day_of_week",)
    raw_id_fields = ("group",)


@admin.register(ExamSheetEntry)
class ExamSheetEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "sheet", "get_student_name", "score", "is_absent", "entered_by", "entered_at")
    list_filter = ("is_absent",)
    readonly_fields = ("created_at",)
    raw_id_fields = ("sheet", "group_membership", "student_snapshot", "entered_by")

    @admin.display(description="Talaba")
    def get_student_name(self, obj):
        if obj.student_snapshot:
            return obj.student_snapshot.full_name
        return "-"


@admin.register(RetakeAssessmentConfig)
class RetakeAssessmentConfigAdmin(admin.ModelAdmin):
    list_display = ("control_type", "max_score", "is_active", "description", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("control_type",)


@admin.register(ExamSheetTemplate)
class ExamSheetTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "created_at", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(RetakeCourseEnrollmentLog)
class RetakeCourseEnrollmentLogAdmin(admin.ModelAdmin):
    list_display = ("id", "group", "lms_course", "get_student_name", "hemis_student_group", "enrolled_by", "enrolled_at")
    raw_id_fields = ("group", "lms_course", "student_snapshot", "enrolled_by")

    @admin.display(description="Talaba")
    def get_student_name(self, obj):
        if obj.student_snapshot:
            return obj.student_snapshot.full_name
        return "-"


@admin.register(DBManagerFacultyAssignment)
class DBManagerFacultyAssignmentAdmin(admin.ModelAdmin):
    list_display = ("db_manager_user", "faculty_name", "assigned_by", "assigned_at")
    list_filter = ("faculty_name",)
    search_fields = ("db_manager_user__username", "faculty_name")
    raw_id_fields = ("db_manager_user", "assigned_by")


@admin.register(ServiceRegistratorFacultyAssignment)
class ServiceRegistratorFacultyAssignmentAdmin(admin.ModelAdmin):
    list_display = ("service_registrator_user", "faculty_name", "assigned_by", "assigned_at")
    list_filter = ("faculty_name",)
    search_fields = ("service_registrator_user__username", "faculty_name")
    raw_id_fields = ("service_registrator_user", "assigned_by")
