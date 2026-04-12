from datetime import date, datetime, timedelta
from django.db.models import Count, Q
from django.utils import timezone
from users.utils.roles import (
    Role, 
    get_user_role, 
    get_dashboard_url, 
    can_manage_course_content, 
    can_manage_enrollments, 
    can_view_students_list
)
from lms.models import Course, Enrollment, Test, Assignment, Section, TestAttempt
from users.models import TeacherProfile, User

def build_staff_dashboard_context(user, session, role):
    profile, _ = TeacherProfile.objects.get_or_create(user=user)
    if not profile.full_name:
        profile.full_name = user.get_full_name() or user.username
        profile.save()

    now = timezone.now()
    today = date.today()
    
    courses_qs = Course.objects.all()
    if role == Role.TEACHER:
        courses_qs = courses_qs.filter(teacher=user)
    
    courses = list(courses_qs.order_by('-created_at'))
    course_ids = [c.id for c in courses]

    # Bulk counts to avoid N+1
    enroll_counts = {
        row['course_id']: row['count']
        for row in Enrollment.objects.filter(course_id__in=course_ids).values('course_id').annotate(count=Count('id'))
    } if course_ids else {}
    
    test_counts = {
        row['course_id']: row['count']
        for row in Test.objects.filter(course_id__in=course_ids).values('course_id').annotate(count=Count('id'))
    } if course_ids else {}
    
    assign_counts = {
        row['course_id']: row['count']
        for row in Assignment.objects.filter(course_id__in=course_ids).values('course_id').annotate(count=Count('id'))
    } if course_ids else {}
    
    section_counts = {
        row['course_id']: row['count']
        for row in Section.objects.filter(course_id__in=course_ids).values('course_id').annotate(count=Count('id'))
    } if course_ids else {}

    course_cards = []
    for course in courses:
        deadline_label, deadline_class = "Muddatsiz", "label-default"
        if course.deadline:
            if course.deadline < today:
                deadline_label, deadline_class = "Muddat o'tgan", "label-danger"
            elif course.deadline == today:
                deadline_label, deadline_class = "Bugun yakun", "label-warning"
            elif course.deadline <= today + timedelta(days=7):
                deadline_label, deadline_class = "Yaqin muddat", "label-warning"
            else:
                deadline_label, deadline_class = "Rejada", "label-success"

        course_cards.append({
            "course": course,
            "deadline_label": deadline_label,
            "deadline_class": deadline_class,
            "student_count": enroll_counts.get(course.id, 0),
            "test_count": test_counts.get(course.id, 0),
            "assignment_count": assign_counts.get(course.id, 0),
            "section_count": section_counts.get(course.id, 0),
        })

    role_configs = {
        Role.TEACHER: {
            "dashboard_title": "O'qituvchi paneli",
            "dashboard_kicker": "O'qituvchi ish maydoni",
            "hero_subtitle": "Kurslar, testlar va o'quv jarayonini bitta paneldan boshqaring.",
        },
        Role.ACADEMIC_BOARD: {
            "dashboard_title": "O'quv bo'limi paneli",
            "dashboard_kicker": "Akademik nazorat",
            "hero_subtitle": "Barcha kurslar kesimida talabalar oqimi, deadline va test holatini kuzating.",
        },
        Role.DIRECTION: {
            "dashboard_title": "Rahbariyat paneli",
            "dashboard_kicker": "Rahbariyat sharhi",
            "hero_subtitle": "O'quv jarayonining yuklamasi, kurslar holati va yakuniy test natijalarini kuzating.",
        },
        Role.REGISTRATOR: {
            "dashboard_title": "Registrator ofisi paneli",
            "dashboard_kicker": "Biriktirish amaliyotlari",
            "hero_subtitle": "Talabalarni kurslarga biriktirish va mavjud yuklamani operativ boshqaring.",
        },
    }
    
    config = role_configs.get(role, role_configs[Role.TEACHER])

    # Upcoming tests
    tests_qs = Test.objects.all()
    if role == Role.TEACHER:
        tests_qs = tests_qs.filter(course__teacher=user)
    upcoming_tests = tests_qs.filter(end_datetime__gte=now).order_by('start_datetime')[:5]

    # Newly Prepared Retake Groups (Automatic)
    pending_retake_groups = []
    if role == Role.TEACHER:
        from retake.models import RetakeSubjectGroup, RetakeCycleStatus
        # Show groups that HAVE an lms_course, assigned to this teacher, and cycle is open.
        pending_retake_groups = RetakeSubjectGroup.objects.filter(
            teacher_profile__user=user,
            lms_course__isnull=False,
            cycle__status=RetakeCycleStatus.OPEN
        ).select_related('subject_snapshot', 'cycle', 'lms_course')

    # Recent attempts
    attempts_qs = TestAttempt.objects.filter(is_completed=True)
    if role == Role.TEACHER:
        attempts_qs = attempts_qs.filter(test__course__teacher=user)
    recent_attempts = attempts_qs.order_by('-finished_at')[:5]

    total_teachers = User.objects.filter(role=User.Role.TEACHER).count()
    recent_students = User.objects.filter(role=User.Role.STUDENT).order_by('-date_joined')[:10]

    return {
        "role": role,
        "profile": profile,
        "course_cards": course_cards,
        "pending_retake_groups": pending_retake_groups,
        "total_courses": len(courses),
        "total_teachers": total_teachers,
        "recent_students": recent_students,
        "active_courses": len([c for c in courses if c.is_active]),
        "total_students": (Enrollment.objects.filter(course_id__in=course_ids).values('student').distinct().count() if course_ids else 0) if role == Role.TEACHER else User.objects.filter(role=User.Role.STUDENT).count(),
        "active_tests": len([t for t in tests_qs if t.is_active]),
        "total_assignments": sum(assign_counts.values()),
        "total_sections": sum(section_counts.values()),
        "upcoming_tests": upcoming_tests,
        "recent_attempts": recent_attempts,
        "can_manage_course_content": can_manage_course_content(user, session),
        "can_manage_enrollments": can_manage_enrollments(user, session),
        "can_view_students": can_view_students_list(user, session),
        **config,
    }
