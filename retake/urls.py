from django.urls import path
from .views import dashboard, applications, review, groups, exams, cycles, sync, admin_control, lms_integration

app_name = 'retake'

urlpatterns = [
    # Dashboard
    path('dashboard/', dashboard.retake_dashboard, name='retake_dashboard'),
    
    # Sync
    path('sync/', sync.sync_panel, name='retake_sync_panel'),
    path('sync/test-connection/', sync.test_connection, name='retake_sync_test_connection'),
    path('sync/run/', sync.run_sync, name='retake_run_sync'),
    
    # Applications
    path('search-student/', applications.search_student, name='search_student'),
    path('student-debts/<int:student_id>/', applications.student_debts, name='student_debts'),
    path('create-application/<int:student_id>/', applications.create_application, name='create_application'),
    path('applications/', applications.application_list, name='application_list'),
    path('application/<int:app_id>/', applications.application_detail, name='application_detail'),
    
    # Review (Accounting & Supervisor)
    path('accounting/list/', review.accounting_list, name='retake_accounting_list'),
    path('accounting/verify/<int:app_id>/', review.verify_payment, name='retake_verify_payment'),
    path('supervisor/list/', review.supervisor_list, name='retake_supervisor_list'),
    path('supervisor/approve/<int:app_id>/', review.supervisor_approve, name='retake_supervisor_approve'),
    
    # Groups
    path('db-manager/groups/', groups.manage_groups, name='retake_manage_groups'),
    path('db-manager/groups/create/', groups.create_group, name='retake_create_group'),
    path('db-manager/groups/auto/', groups.auto_group_subjects, name='retake_auto_group_subjects'),
    path('db-manager/groups/auto/apply/', groups.apply_group_suggestions, name='retake_apply_group_suggestions'),
    path('db-manager/students/assign/', groups.assign_students_view, name='retake_assign_students'),
    path('db-manager/schedules/', groups.manage_schedules_view, name='retake_manage_schedules'),
    path('db-manager/group/<int:group_id>/', groups.group_detail, name='retake_group_detail'),
    path('db-manager/group/<int:group_id>/assign-teacher/', groups.assign_group_teacher, name='retake_assign_group_teacher'),
    path('db-manager/group/<int:group_id>/assign/', groups.assign_to_group, name='retake_assign_to_group'),
    path('db-manager/group/<int:group_id>/assessment/create/', groups.create_assessment, name='retake_create_assessment'),
    path('db-manager/group/<int:group_id>/schedule/add/', groups.add_class_schedule, name='retake_add_class_schedule'),
    path('db-manager/schedule/<int:schedule_id>/delete/', groups.delete_class_schedule, name='retake_delete_class_schedule'),
    path('db-manager/exam-calendar/', groups.exam_calendar_view, name='retake_exam_calendar'),
    path('db-manager/exam-calendar/save/', groups.save_exam_schedule, name='retake_save_exam_schedule'),
    path('db-manager/delete-group/<int:group_id>/', groups.delete_group, name='retake_delete_group'),
    
    # Exams & Grading
    path('teacher/groups/', exams.teacher_groups, name='retake_teacher_groups'),
    path('teacher/exam-sheet/<int:sheet_id>/', exams.exam_sheet, name='retake_exam_sheet'),
    path('teacher/group/<int:group_id>/create-lms-course/', lms_integration.create_lms_course, name='retake_create_lms_course'),
    path('db-manager/group/<int:group_id>/open-sheet/<str:control_type>/', exams.open_assessment_sheet, name='retake_open_assessment_sheet'),
    
    # Cycle Management
    path('cycles/', cycles.cycle_list, name='retake_cycle_list'),
    path('cycles/create/', cycles.cycle_create, name='retake_cycle_create'),
    path('cycles/<int:cycle_id>/edit/', cycles.cycle_edit, name='retake_cycle_edit'),

    # Admin Control & Template Support
    path('admin/assessment-control/', admin_control.assessment_control, name='retake_admin_assessment_control'),
    path('admin/template-editor/', admin_control.template_editor, name='retake_admin_template_editor'),
]
