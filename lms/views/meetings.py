from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from lms.models import Course, Section, CourseMeeting, Notification, Enrollment
from django.urls import reverse
from users.utils.roles import Role, get_user_role

@login_required
def manage_meetings(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    # Only teacher or admin
    role = get_user_role(request.user, request.session)
    if role not in [Role.SUPER_ADMIN, Role.REGISTRATOR] and course.teacher != request.user:
        return redirect('lms:portal')
        
    if request.method == "POST":
        title = request.POST.get("title").strip()
        meeting_url = request.POST.get("meeting_url").strip()
        meeting_type = request.POST.get("meeting_type", "zoom")
        start_time_str = request.POST.get("start_time")
        duration = int(request.POST.get("duration_minutes", 60))
        raw_sec = (request.POST.get("section_id") or "").strip()
        section_pk = None
        if raw_sec.isdigit():
            sid = int(raw_sec)
            if Section.objects.filter(pk=sid, course=course).exists():
                section_pk = sid

        try:
            start_time = timezone.make_aware(timezone.datetime.fromisoformat(start_time_str))
            meeting = CourseMeeting.objects.create(
                course=course,
                section_id=section_pk,
                title=title,
                meeting_url=meeting_url,
                meeting_type=meeting_type,
                start_time=start_time,
                duration_minutes=duration
            )
            
            # Notify all enrolled students
            enrollments = Enrollment.objects.filter(course=course)
            notifications = []
            for enrollment in enrollments:
                notifications.append(Notification(
                    user=enrollment.student,
                    title="Yangi onlayn dars!",
                    message=f"{course.title} kursida yangi uchrashuv rejalashtirildi: {meeting.title}",
                    link=reverse('lms:student_dashboard') # Or student_course_detail
                ))
            Notification.objects.bulk_create(notifications)
            
            messages.success(request, f"Online dars rejalashtirildi va {len(notifications)} ta talabaga xabar yuborildi.")
        except Exception as e:
            messages.error(request, f"Xatolik: {str(e)}")
            
        return redirect('lms:course_detail', course_id=course.id)
    
    return redirect('lms:course_detail', course_id=course.id)

@login_required
def delete_meeting(request, meeting_id):
    meeting = get_object_or_404(CourseMeeting, id=meeting_id)
    course_id = meeting.course_id
    # Check permissions
    if meeting.course.teacher == request.user or request.user.is_superuser:
        meeting.delete()
        messages.success(request, "Dars o'chirildi.")
    return redirect('lms:course_detail', course_id=course_id)
