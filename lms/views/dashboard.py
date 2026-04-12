from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from users.utils.roles import (
    get_dashboard_url, 
    get_user_role, 
    Role
)
from lms.utils.context_builders import build_staff_dashboard_context
from lms.models import Enrollment, Course, Section, SectionCompletion, Test, Assignment, UserCertificate, CertificateTrigger
from lms.services.certificate_service import check_certificate_eligibility

@login_required
def portal_view(request):
    """
    Portal router: foyer of the LMS.
    """
    return redirect(get_dashboard_url(request.user, request.session))

@login_required
def teacher_dashboard(request):
    role = get_user_role(request.user, request.session)
    if role != Role.TEACHER:
        return redirect('lms:portal')
    return render(request, "lms/staff_dashboard.html", build_staff_dashboard_context(request.user, request.session, role))

@login_required
def academic_board_dashboard(request):
    role = get_user_role(request.user, request.session)
    if role != Role.ACADEMIC_BOARD:
        return redirect('lms:portal')
    return render(request, "lms/staff_dashboard.html", build_staff_dashboard_context(request.user, request.session, role))

@login_required
def direction_dashboard(request):
    role = get_user_role(request.user, request.session)
    if role != Role.DIRECTION:
        return redirect('lms:portal')
    return render(request, "lms/staff_dashboard.html", build_staff_dashboard_context(request.user, request.session, role))

@login_required
def registrator_dashboard(request):
    role = get_user_role(request.user, request.session)
    if role != Role.REGISTRATOR:
        return redirect('lms:portal')
    return render(request, "lms/staff_dashboard.html", build_staff_dashboard_context(request.user, request.session, role))

@login_required
def student_dashboard(request):
    role = get_user_role(request.user, request.session)
    if role != Role.STUDENT:
        return redirect('lms:portal')
    
    enrollments = Enrollment.objects.filter(student=request.user).select_related('course')
    context = {
        "enrollments": enrollments,
        "role": Role.STUDENT,
    }
    return render(request, "lms/student_dashboard.html", context)

@login_required
def student_course_detail(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    enrollment = Enrollment.objects.filter(student=request.user, course=course).first()
    if not enrollment:
        messages.error(request, "Siz ushbu kursga biriktirilmagansiz.")
        return redirect('lms:student_dashboard')

    now = timezone.now()
    sections = course.sections.all().order_by('order')
    sections_with_status = []
    
    completed_ids = SectionCompletion.objects.filter(
        student=request.user, 
        section__course=course
    ).values_list('section_id', flat=True)

    previous_completed = True
    for section in sections:
        is_completed = section.id in completed_ids
        is_locked = False
        
        if section.unlock_mode == 'sequential' and not previous_completed:
            is_locked = True
            
        sections_with_status.append({
            "section": section,
            "is_locked": is_locked,
            "is_completed": is_completed
        })
        previous_completed = is_completed

    completed_count = len([s for s in sections_with_status if s['is_completed']])
    total_count = len(sections_with_status)
    percentage = int((completed_count / total_count * 100)) if total_count > 0 else 0

    stats = [
        ('fa-users', "Talabalar", Enrollment.objects.filter(course=course).count(), '#3498db'),
        ('fa-list-ol', "Mavzular", total_count, '#2ecc71'),
        ('fa-file-text-o', "Testlar", Test.objects.filter(course=course, is_active=True).count(), '#e67e22'),
        ('fa-tasks', "Topshiriqlar", Assignment.objects.filter(course=course, is_active=True).count(), '#ef4444'),
    ]

    orphan_assignments = Assignment.objects.filter(
        course=course, section__isnull=True, is_active=True
    ).order_by("-created_at")

    # Certificate Data
    from lms.api_views import _get_course_certificate_info
    course_cert_data = _get_course_certificate_info(course, request.user)

    context = {
        "course": course,
        "sections_with_status": sections_with_status,
        "percentage": percentage,
        "completed_count": completed_count,
        "total_count": total_count,
        "stats": stats,
        "orphan_assignments": orphan_assignments,
        "course_cert_data": course_cert_data,
    }
    return render(request, "lms/student_course_detail.html", context)

@login_required
def notifications_view(request):
    notifications = Notification.objects.filter(user=request.user).order_by('-created_at')
    # Mark all as read
    Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
    return render(request, "lms/notifications.html", {"notifications": notifications})
