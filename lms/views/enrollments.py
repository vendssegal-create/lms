from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.db.models import Q
from lms.models import Course, Enrollment
from users.models import User, StudentProfile
from users.utils.roles import can_manage_enrollments

@login_required
def assign_student(request, course_id):
    if not can_manage_enrollments(request.user, request.session):
        return redirect('lms:portal')
        
    course = get_object_or_404(Course, id=course_id)
    # If teacher, must own the course
    if request.user.role == 'Teacher' and course.teacher != request.user:
        return redirect('lms:portal')
        
    selected_group = request.GET.get("group", "").strip()
    search_query = request.GET.get("search", "").strip()

    # Base query for students NOT enrolled in this course
    enrolled_student_ids = Enrollment.objects.filter(course=course).values_list('student_id', flat=True)
    query = User.objects.filter(role='Student').exclude(id__in=enrolled_student_ids)

    if selected_group:
        query = query.filter(student_profile__group_name=selected_group)

    if search_query:
        query = query.filter(
            Q(student_profile__full_name__icontains=search_query) |
            Q(username__icontains=search_query) |
            Q(student_profile__student_id_number__icontains=search_query) |
            Q(student_profile__group_name__icontains=search_query)
        )

    # AJAX for Select2 or similar
    if request.headers.get("X-Requested-With") == "XMLHttpRequest":
        students = []
        for user in query.select_related('student_profile').order_by('student_profile__full_name')[:20]:
            profile = user.student_profile
            students.append({
                "id": user.username,
                "text": f"{profile.full_name or user.username} | {profile.group_name or 'Guruhsiz'} | @{user.username}",
                "full_name": profile.full_name,
                "username": user.username,
                "group_name": profile.group_name,
            })
        return JsonResponse(students, safe=False)

    if request.method == "POST":
        usernames = request.POST.getlist("selected_usernames")
        created_count = 0
        for username in usernames:
            user = User.objects.filter(username=username).first()
            if user and not Enrollment.objects.filter(student=user, course=course).exists():
                Enrollment.objects.create(student=user, course=course)
                created_count += 1
        
        messages.success(request, f"{created_count} ta talaba biriktirildi.")
        return redirect('lms:assign_student', course_id=course.id)

    group_names = StudentProfile.objects.exclude(group_name="").values_list('group_name', flat=True).distinct().order_by('group_name')
    
    context = {
        "course": course,
        "group_names": list(group_names),
        "selected_group": selected_group,
        "enrolled_count": Enrollment.objects.filter(course=course).count(),
        "students_in_group": query.select_related('student_profile').order_by('student_profile__full_name') if selected_group or search_query else None,
    }
    return render(request, "lms/assign_student.html", context)

@login_required
def view_students(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    if not can_manage_enrollments(request.user, request.session):
        return redirect('lms:portal')
        
    enrollments_qs = Enrollment.objects.filter(course=course).select_related('student', 'student__student_profile').order_by('student__student_profile__full_name')
    
    # Pagination
    page = request.GET.get('page', 1)
    paginator = Paginator(enrollments_qs, 20)
    page_obj = paginator.get_page(page)
    
    context = {
        "course": course,
        "enrollments": page_obj,
        "paginator": paginator,
        "page_obj": page_obj,
    }
    return render(request, "lms/view_students.html", context)

@login_required
def delete_enrollment(request, enrollment_id):
    enrollment = get_object_or_404(Enrollment, id=enrollment_id)
    course_id = enrollment.course_id
    if not can_manage_enrollments(request.user, request.session):
        return redirect('lms:portal')
        
    if request.method == "POST":
        enrollment.delete()
        messages.success(request, "Talaba kursdan chiqarildi.")
    return redirect('lms:view_students', course_id=course_id)
