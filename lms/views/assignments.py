from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from django.core.files.storage import FileSystemStorage
from lms.models import Course, Section, Assignment, Submission, SectionSubmission, Notification, Enrollment
from django.urls import reverse
from users.utils.roles import Role, get_user_role, role_required
import os
import uuid


def _section_pk_for_course(course, raw):
    """Bo'lim ID shu kursga tegishli bo'lsa qaytaradi, aks holda None."""
    if raw is None or str(raw).strip() == "":
        return None
    try:
        pk = int(raw)
    except (TypeError, ValueError):
        return None
    if not course.sections.filter(pk=pk).exists():
        return None
    return pk


@login_required
@role_required(Role.TEACHER, Role.SUPER_ADMIN)
def create_assignment(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    sections = course.sections.order_by("order")
    if request.method == "POST":
        section_id = _section_pk_for_course(course, request.POST.get("section_id"))
        title = request.POST.get("title").strip()
        description = request.POST.get("description").strip()
        max_score = int(request.POST.get("max_score", 100))
        deadline_str = request.POST.get("deadline")

        deadline = None
        if deadline_str:
            try:
                deadline = timezone.datetime.fromisoformat(deadline_str)
            except ValueError:
                pass

        assignment = Assignment.objects.create(
            course=course,
            section_id=section_id,
            title=title,
            description=description,
            max_score=max_score,
            deadline=deadline,
            is_active=request.POST.get("is_active") == "on",
            allow_late=request.POST.get("allow_late") == "on",
        )
        
        # Notify all enrolled students
        enrollments = Enrollment.objects.filter(course=course)
        notifications = []
        for enrollment in enrollments:
            notifications.append(Notification(
                user=enrollment.student,
                title="Yangi topshiriq!",
                message=f"{course.title} kursida yangi topshiriq: {assignment.title}",
                link=reverse('lms:student_dashboard')
            ))
        Notification.objects.bulk_create(notifications)
        
        messages.success(request, f"Topshiriq yaratildi va {len(notifications)} ta talabaga xabar yuborildi.")
        return redirect('lms:course_detail', course_id=course.id)

    selected_section_id = _section_pk_for_course(course, request.GET.get("section_id"))
    return render(
        request,
        "lms/assignment_form.html",
        {
            "course": course,
            "action": "create",
            "sections": sections,
            "selected_section_id": selected_section_id,
        },
    )

@login_required
@role_required(Role.TEACHER, Role.SUPER_ADMIN)
def edit_assignment(request, assignment_id):
    assignment = get_object_or_404(Assignment, id=assignment_id)
    course = assignment.course
    sections = course.sections.order_by("order")
    if request.method == "POST":
        assignment.title = request.POST.get("title").strip()
        assignment.description = request.POST.get("description").strip()
        assignment.max_score = int(request.POST.get("max_score", 100))
        assignment.section_id = _section_pk_for_course(course, request.POST.get("section_id"))
        assignment.is_active = request.POST.get("is_active") == "on"
        assignment.allow_late = request.POST.get("allow_late") == "on"
        deadline_str = request.POST.get("deadline")
        if deadline_str:
            try:
                assignment.deadline = timezone.datetime.fromisoformat(deadline_str)
            except ValueError:
                pass
        assignment.save()
        messages.success(request, "Topshiriq muvaffaqiyatli yangilandi.")
        return redirect('lms:assignment_detail', assignment_id=assignment.id)

    return render(
        request,
        "lms/assignment_form.html",
        {
            "course": course,
            "assignment": assignment,
            "action": "edit",
            "sections": sections,
            "selected_section_id": assignment.section_id,
        },
    )

@login_required
@role_required(Role.TEACHER, Role.SUPER_ADMIN)
def delete_assignment(request, assignment_id):
    assignment = get_object_or_404(Assignment, id=assignment_id)
    course_id = assignment.course.id
    if request.method == "POST":
        assignment.delete()
        messages.success(request, "Topshiriq muvaffaqiyatli o'chirildi.")
    return redirect('lms:course_detail', course_id=course_id)

@login_required
@role_required(Role.STUDENT, Role.SUPER_ADMIN)
def submit_assignment(request, assignment_id):
    assignment = get_object_or_404(Assignment, id=assignment_id)
    if request.method == "POST":
        uploaded_file = request.FILES.get("submission_file")
        if not uploaded_file:
            messages.error(request, "Fayl tanlanmagan.")
            return redirect('lms:submit_assignment', assignment_id=assignment.id)
            
        submission = Submission.objects.create(
            assignment=assignment,
            student=request.user,
            file=uploaded_file
        )
        messages.success(request, "Topshiriq muvaffaqiyatli yuborildi.")
        return redirect('lms:student_course_detail', course_id=assignment.course.id)

    submissions = Submission.objects.filter(assignment=assignment, student=request.user).order_by('-submitted_at')
    return render(request, "lms/submit_assignment.html", {
        "assignment": assignment,
        "submissions": submissions
    })

@login_required
def submit_section_file(request, section_id):
    section = get_object_or_404(Section, id=section_id)
    course = section.course
    # Check enrollment
    if not course.enrollments.filter(student=request.user).exists():
        messages.error(request, "Siz ushbu kursga biriktirilmagansiz.")
        return redirect('lms:student_dashboard')

    submission = SectionSubmission.objects.filter(section=section, student=request.user).first()
    
    if request.method == "POST":
        file = request.FILES.get("file")
        if not file:
            messages.error(request, "Fayl tanlanmagan.")
            return redirect('lms:submit_section_file', section_id=section_id)
            
        if not submission:
            submission = SectionSubmission.objects.create(
                section=section,
                student=request.user,
                file=file
            )
        else:
            submission.file = file
            submission.submitted_at = timezone.now()
            submission.save()
            
        messages.success(request, "Fayl muvaffaqiyatli yuklandi.")
        return redirect('lms:student_course_detail', course_id=course.id)

    return render(request, "lms/submit_section_file.html", {
        "section": section,
        "submission": submission
    })

@login_required
def view_all_section_submissions(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    if course.teacher != request.user:
        return redirect('lms:portal')
        
    submissions = SectionSubmission.objects.filter(section__course=course).select_related('student', 'section').order_by('-submitted_at')
    
    return render(request, "lms/course_submissions.html", {
        "course": course,
        "submissions": submissions
    })

@login_required
@role_required(Role.TEACHER, Role.SUPER_ADMIN)
def assignment_detail(request, assignment_id):
    assignment = get_object_or_404(Assignment, id=assignment_id)
    submissions = assignment.submissions.all().select_related('student').order_by('-submitted_at')
    return render(request, "lms/assignment_detail.html", {
        "assignment": assignment,
        "submissions": submissions
    })

@login_required
@role_required(Role.TEACHER, Role.SUPER_ADMIN)
def grade_submission(request, submission_id):
    submission = get_object_or_404(Submission, id=submission_id)
    if request.method == "POST":
        score = request.POST.get("score")
        feedback = request.POST.get("feedback", "")
        # Assuming grade/feedback fields exist on Submission model in Django
        # If not, we might need a separate Grade model or add them to Submission
        # Based on routes.py, it seems they were on Submission.
        # Let's check Submission model in lms/models.py
        try:
            submission.score = float(score) if score else None
            submission.feedback = feedback
            submission.graded_at = timezone.now()
            submission.save()
            messages.success(request, "Baho qo'yildi.")
        except Exception as e:
            messages.error(request, f"Xatolik: {str(e)}")
            
        return redirect('lms:assignment_detail', assignment_id=submission.assignment.id)
    return redirect('lms:assignment_detail', assignment_id=submission.assignment.id)
