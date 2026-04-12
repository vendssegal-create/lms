from django.contrib import admin

from retake.models import DBManagerFacultyAssignment, ServiceRegistratorFacultyAssignment


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
