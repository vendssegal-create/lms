from django.urls import path
from .views import dashboard, courses, enrollments, tests, assignments, forums, gradebook, resources, notifications, meetings, api, admin

app_name = 'lms'

urlpatterns = [
    # Dashboard routes
    path('portal/', dashboard.portal_view, name='portal'),
    path('teacher/', dashboard.teacher_dashboard, name='teacher_dashboard'),
    path('academic-board/', dashboard.academic_board_dashboard, name='academic_board_dashboard'),
    path('direction/', dashboard.direction_dashboard, name='direction_dashboard'),
    path('registrator/', dashboard.registrator_dashboard, name='registrator_dashboard'),
    path('student/', dashboard.student_dashboard, name='student_dashboard'),
    
    # Administrative control
    path('admin-dashboard/', admin.admin_dashboard, name='admin_dashboard'),
    path('admin/teachers/create/', admin.create_teacher, name='create_teacher'),
    path('admin/students/create/', admin.create_student, name='create_student'),
    
    # Course management
    path('teacher/create_course/', courses.create_course, name='create_course'),
    path('teacher/edit_course/<int:course_id>/', courses.edit_course, name='edit_course'),
    path('teacher/manage_courses/', courses.manage_courses, name='manage_courses'),
    path('teacher/delete_course/<int:course_id>/', courses.delete_course, name='delete_course'),
    path('teacher/course/<int:course_id>/', courses.course_detail, name='course_detail'),
    
    # Enrollments
    path('teacher/assign_student/<int:course_id>/', enrollments.assign_student, name='assign_student'),
    path('teacher/course/<int:course_id>/students/', enrollments.view_students, name='view_students'),
    path('teacher/enrollment/<int:enrollment_id>/delete/', enrollments.delete_enrollment, name='delete_enrollment'),
    
    # Tests
    path('teacher/tests/', tests.teacher_tests, name='teacher_tests'),
    path('teacher/create_test/', tests.create_test, name='create_test'),
    path('teacher/edit_test/<int:test_id>/', tests.edit_test, name='edit_test'),
    path('teacher/add_questions/<int:test_id>/', tests.add_questions, name='add_questions'),
    path('student/tests/', tests.student_tests, name='student_tests'),
    path('student/take_test/<int:test_id>/', tests.take_test, name='take_test'),
    path('student/view_test_result/<int:test_id>/', tests.view_test_result, name='view_test_result'),
    path('api/verify-face/<int:test_id>/', api.verify_face_success, name='verify_face_success'),
    path('api/proctor-log/', api.proctor_log, name='api_proctor_log'),

    # Assignments
    path('teacher/create_assignment/<int:course_id>/', assignments.create_assignment, name='create_assignment'),
    path('teacher/edit_assignment/<int:assignment_id>/', assignments.edit_assignment, name='edit_assignment'),
    path('teacher/delete_assignment/<int:assignment_id>/', assignments.delete_assignment, name='delete_assignment'),
    path('teacher/assignment/<int:assignment_id>/', assignments.assignment_detail, name='assignment_detail'),
    path('teacher/submission/<int:submission_id>/grade/', assignments.grade_submission, name='grade_submission'),
    path('student/submit_assignment/<int:assignment_id>/', assignments.submit_assignment, name='submit_assignment'),
    path('student/section/<int:section_id>/submit_file/', assignments.submit_section_file, name='submit_section_file'),
    path('teacher/course/<int:course_id>/section_submissions/', assignments.view_all_section_submissions, name='view_all_section_submissions'),

    # Forums
    path('course/<int:course_id>/forum/', forums.course_forum, name='course_forum'),
    path('course/<int:course_id>/forum/new/', forums.create_forum_topic, name='create_forum_topic'),
    path('forum/topic/<int:topic_id>/', forums.forum_topic_detail, name='forum_topic_detail'),
    path('forum/topic/<int:topic_id>/reply/', forums.post_forum_reply, name='post_forum_reply'),

    # Gradebook
    path('teacher/course/<int:course_id>/gradebook/', gradebook.course_gradebook, name='course_gradebook'),
    path('teacher/course/<int:course_id>/gradebook/setup/', gradebook.gradebook_setup, name='gradebook_setup'),
    path('teacher/course/<int:course_id>/gradebook/save/', gradebook.save_gradebook, name='save_gradebook'),
    path('teacher/course/<int:course_id>/gradebook/import-test/<int:test_id>/', gradebook.gradebook_import_test, name='gradebook_import_test'),
    path('student/grades/', gradebook.student_grades, name='student_grades'),

    # Resources
    path('teacher/section/<int:section_id>/add_resource/', resources.add_section_resource, name='add_section_resource'),
    path('teacher/resource/<int:resource_id>/delete/', resources.delete_resource, name='delete_resource'),
    path('teacher/resource/<int:resource_id>/rename/', resources.rename_resource, name='rename_resource'),
    path('teacher/section/<int:section_id>/rename/', resources.rename_section, name='rename_section'),
    path('teacher/section/<int:section_id>/delete/', resources.delete_section, name='delete_section'),
    path('teacher/section/<int:section_id>/reorder_resources/', resources.reorder_resources, name='reorder_resources'),
    path('teacher/course/<int:course_id>/reorder_sections/', resources.reorder_sections, name='reorder_sections'),
    path('student/section/<int:section_id>/mark_complete/', resources.mark_section_complete_api, name='mark_section_complete'),

    # Notifications & Feedback
    path('notifications/', notifications.notifications_view, name='notifications'),
    path('api/notifications/', notifications.api_notifications, name='api_notifications'),
    path('api/notifications/<int:notif_id>/read/', notifications.api_notif_read, name='api_notif_read'),
    path('student/course/<int:course_id>/feedback/', notifications.submit_feedback, name='submit_course_feedback'),
    path('teacher/course/<int:course_id>/feedback/', notifications.view_course_feedback, name='view_course_feedback'),

    # Meetings
    path('teacher/course/<int:course_id>/manage_meetings/', meetings.manage_meetings, name='manage_meetings'),
    path('teacher/meeting/<int:meeting_id>/delete/', meetings.delete_meeting, name='delete_meeting'),

    # API Proxy
    path('api/proxy-image/', api.proxy_image, name='proxy_image'),
]
