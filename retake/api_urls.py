from django.urls import path

from . import api_views


urlpatterns = [
    path("dashboard-stats/", api_views.dashboard_stats, name="api_dashboard_stats"),
    path("teacher-groups/", api_views.teacher_groups_list, name="api_teacher_groups_list"),
    path("exam-sheets/<int:sheet_id>/", api_views.exam_sheet_detail, name="api_exam_sheet_detail"),
    path("exam-sheets/<int:sheet_id>/save/", api_views.exam_sheet_save, name="api_exam_sheet_save"),
    path("cycles/", api_views.cycles_list, name="api_cycles_list"),
    path("cycles/create/", api_views.cycles_create, name="api_cycles_create"),
    path("cycles/<int:cycle_id>/update/", api_views.cycles_update, name="api_cycles_update"),
    path("groups/", api_views.groups_list, name="api_groups_list"),
    path("groups/create/", api_views.groups_create, name="api_groups_create"),
    path("groups/<int:group_id>/update/", api_views.groups_update, name="api_groups_update"),
    path("groups/<int:group_id>/delete/", api_views.groups_delete, name="api_groups_delete"),
    path("schedules/", api_views.schedules_list, name="api_schedules_list"),
    path("groups/<int:group_id>/class-schedules/create/", api_views.schedules_create_class, name="api_schedules_create_class"),
    path("class-schedules/<int:schedule_id>/delete/", api_views.schedules_delete_class, name="api_schedules_delete_class"),
    path("groups/<int:group_id>/assessments/create/", api_views.schedules_create_assessment, name="api_schedules_create_assessment"),
    path("assessments/<int:assessment_id>/delete/", api_views.schedules_delete_assessment, name="api_schedules_delete_assessment"),
    path("exam-calendar/", api_views.exam_calendar_view, name="api_exam_calendar_view"),
    path("exam-calendar/save/", api_views.exam_calendar_save, name="api_exam_calendar_save"),
    path("applications/", api_views.applications_list, name="api_applications_list"),
    path("applications/<int:app_id>/", api_views.application_detail, name="api_application_detail"),
    path("applications/<int:app_id>/update/", api_views.application_update, name="api_application_update"),
    path("applications/<int:app_id>/accounting-action/", api_views.application_accounting_action, name="api_application_accounting_action"),
    path("applications/<int:app_id>/supervisor-action/", api_views.application_supervisor_action, name="api_application_supervisor_action"),
    path("search-student/", api_views.search_students, name="api_search_students"),
    path("students/<int:student_id>/debts/", api_views.student_debts, name="api_student_debts"),
    path("students/<int:student_id>/create-application/", api_views.create_application, name="api_create_application"),
    path("sync/", api_views.sync_panel, name="api_sync_panel"),
    path("sync/test/", api_views.sync_test_connection, name="api_sync_test"),
    path("sync/run/", api_views.sync_run, name="api_sync_run"),

    # Fan Guruhi Detail API
    path("subject-groups/<int:group_id>/", api_views.subject_group_detail, name="api_subject_group_detail"),
    path("subject-groups/<int:group_id>/student-groups/", api_views.group_student_groups, name="api_group_student_groups"),
    path("subject-groups/<int:group_id>/assessments/", api_views.create_assessment, name="api_create_assessment"),
    path("subject-groups/<int:group_id>/assessments/batch/", api_views.batch_create_assessments, name="api_batch_create_assessments"),

    # Teacher enrollment API
    path("groups/<int:group_id>/enrollment/", api_views.teacher_course_enrollment, name="api_teacher_course_enrollment"),
]
