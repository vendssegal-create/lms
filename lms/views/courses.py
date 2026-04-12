from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Prefetch
from django.utils import timezone
from datetime import datetime, date
from lms.models import (
    Course,
    Enrollment,
    Section,
    SectionResource,
    Test,
    Assignment,
    CourseMeeting,
    ControlType,
    SectionResourceType,
)
from users.utils.roles import (
    Role,
    get_user_role,
    can_manage_course_content,
    can_manage_enrollments,
    can_view_students_list,
    get_dashboard_url
)

def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None

@login_required
def create_course(request):
    if not can_manage_course_content(request.user, request.session):
        return redirect('lms:portal')

    if request.method == "POST":
        Course.objects.create(
            title=request.POST.get("title", "").strip(),
            description=request.POST.get("description", "").strip(),
            deadline=_parse_date(request.POST.get("deadline")),
            is_active=bool(request.POST.get("is_active")),
            teacher=request.user
        )
        messages.success(request, "Kurs muvaffaqiyatli yaratildi.")
        return redirect('lms:manage_courses')

    return render(request, "lms/course_form.html", {"course": None, "action": "create"})

@login_required
def edit_course(request, course_id):
    course = get_object_or_404(Course, id=course_id, teacher=request.user)

    if request.method == "POST":
        course.title = request.POST.get("title", course.title).strip()
        course.description = request.POST.get("description", course.description).strip()
        course.deadline = _parse_date(request.POST.get("deadline")) or course.deadline
        course.is_active = bool(request.POST.get("is_active"))
        course.save()
        messages.success(request, "Kurs muvaffaqiyatli yangilandi.")
        return redirect('lms:course_detail', course_id=course.id)

    return render(request, "lms/course_form.html", {"course": course, "action": "edit"})

@login_required
def manage_courses(request):
    role = get_user_role(request.user, request.session)
    courses_qs = Course.objects.all()
    if role == Role.TEACHER:
        courses_qs = courses_qs.filter(teacher=request.user)

    query = request.GET.get('q', '').strip()
    if query:
        courses_qs = courses_qs.filter(title__icontains=query)

    courses_qs = courses_qs.order_by('-created_at')

    page = request.GET.get('page', 1)
    paginator = Paginator(courses_qs, 15)
    page_obj = paginator.get_page(page)

    context = {
        "courses": page_obj,
        "paginator": paginator,
        "page_obj": page_obj,
        "can_create_course": can_manage_course_content(request.user, request.session),
        "can_edit_courses": can_manage_course_content(request.user, request.session),
        "can_manage_enrollments": can_manage_enrollments(request.user, request.session),
        "can_view_students": can_view_students_list(request.user, request.session),
        "dashboard_home_url_name": get_dashboard_url(request.user, request.session),
    }
    return render(request, "lms/manage_courses.html", context)

@login_required
def delete_course(request, course_id):
    course = get_object_or_404(Course, id=course_id, teacher=request.user)
    course.delete()
    messages.success(request, "Kurs muvaffaqiyatli o'chirildi.")
    return redirect('lms:manage_courses')

@login_required
def course_detail(request, course_id):
    course = get_object_or_404(Course, id=course_id, teacher=request.user)

    if request.method == "POST":
        action = request.POST.get("action")

        if action == "add_section":
            Section.objects.create(
                course=course,
                name=request.POST.get("section_name", "Yangi bo'lim").strip(),
                description=request.POST.get("section_desc", "").strip(),
                is_published=request.POST.get("is_published") == "1",
                order=Section.objects.filter(course=course).count() + 1
            )
            messages.success(request, "Yangi bo'lim qo'shildi.")

        elif action == "edit_section":
            section_id = request.POST.get("section_id")
            section = get_object_or_404(Section, id=section_id, course=course)
            section.name = request.POST.get("section_name", section.name).strip() or section.name
            section.description = request.POST.get("section_desc", "").strip()
            section.is_published = request.POST.get("is_published") == "1"
            section.unlock_mode = request.POST.get("unlock_mode", "open")
            prereq_id = request.POST.get("prerequisite_section_id", "").strip()
            section.prerequisite_section_id = int(prereq_id) if prereq_id.isdigit() else None
            section.save()
            messages.success(request, f"'{section.name}' bo'limi yangilandi.")

        elif action == "delete_section":
            section_id = request.POST.get("section_id")
            Section.objects.filter(id=section_id, course=course).delete()
            messages.success(request, "Bo'lim o'chirildi.")

        return redirect('lms:course_detail', course_id=course.id)

    # Prefetch all related data in one query
    sections = course.sections.prefetch_related(
        Prefetch('resources', queryset=SectionResource.objects.order_by('order')),
        Prefetch('tests', queryset=Test.objects.order_by('start_datetime')),
        Prefetch('assignments', queryset=Assignment.objects.order_by('deadline')),
        Prefetch('meetings', queryset=CourseMeeting.objects.order_by('start_time')),
    ).order_by('order')

    resource_count = SectionResource.objects.filter(section__course=course).count()
    orphan_assignments = Assignment.objects.filter(course=course, section__isnull=True).order_by(
        "-created_at"
    )

    stats = [
        ("fa-users",       "Talabalar",    Enrollment.objects.filter(course=course).count(),    "#4361ee"),
        ("fa-th-list",     "Bo'limlar",    course.sections.count(),                             "#22c55e"),
        ("fa-file-text-o", "Testlar",      Test.objects.filter(course=course).count(),          "#f59e0b"),
        ("fa-tasks",       "Topshiriqlar", Assignment.objects.filter(course=course).count(),    "#ef4444"),
        ("fa-paperclip",   "Materiallar",  resource_count,                                      "#8b5cf6"),
    ]

    context = {
        "course": course,
        "sections": sections,
        "stats": stats,
        "today": date.today(),
        "ControlType": ControlType,
        "SectionResourceType": SectionResourceType,
        "orphan_assignments": orphan_assignments,
    }
    return render(request, "lms/course_detail.html", context)
