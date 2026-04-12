from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Count
from django.contrib.auth import get_user_model
from users.utils.roles import Role, get_user_role
from users.models import TeacherProfile, StudentProfile
from lms.models import Course, Enrollment
from retake.models import RetakeApplication, RetakeApplicationItem, RetakeItemStatus

User = get_user_model()

@login_required
def admin_dashboard(request):
    role = get_user_role(request.user, request.session)
    if role != Role.SUPER_ADMIN:
        messages.error(request, "Sizda ushbu sahifaga kirish huquqi yo'q.")
        return redirect('lms:portal')

    recent_users = User.objects.order_by('-date_joined')[:10]
    recent_courses = Course.objects.order_by('-created_at')[:10]
    
    retake_stats = {
        "total_apps": RetakeApplication.objects.count(),
        "pending_finance": RetakeApplicationItem.objects.filter(status=RetakeItemStatus.SUBMITTED_TO_ACCOUNTING).count(),
        "approved_retakes": RetakeApplicationItem.objects.filter(status=RetakeItemStatus.APPROVED_FOR_GROUPING).count(),
        "completed_retakes": RetakeApplicationItem.objects.filter(status=RetakeItemStatus.COMPLETED).count(),
    }
    
    context = {
        "recent_users": recent_users,
        "courses": recent_courses,
        "total_users": User.objects.count(),
        "total_courses": Course.objects.count(),
        "teachers_count": User.objects.filter(role=Role.TEACHER).count(),
        "students_count": User.objects.filter(role=Role.STUDENT).count(),
        "retake_stats": retake_stats,
    }
    return render(request, "lms/admin_profile.html", context)

@login_required
def create_teacher(request):
    if not request.user.is_superuser:
        messages.error(request, "Faqat super adminlar o'qituvchi yarata oladi.")
        return redirect('lms:admin_dashboard')

    if request.method == "POST":
        username = request.POST.get("username", "").strip()
        password = request.POST.get("password", "").strip()
        full_name = request.POST.get("full_name", "").strip()
        email = request.POST.get("email", "").strip()
        phone = request.POST.get("phone", "").strip()
        department = request.POST.get("department", "").strip()

        if User.objects.filter(username=username).exists():
            messages.error(request, "Ushbu login band.")
        else:
            user = User.objects.create_user(
                username=username, 
                password=password,
                role=Role.TEACHER,
                first_name=full_name.split(' ')[0] if ' ' in full_name else full_name,
                last_name=' '.join(full_name.split(' ')[1:]) if ' ' in full_name else "",
                email=email
            )
            TeacherProfile.objects.create(
                user=user,
                full_name=full_name,
                department=department,
                phone=phone
            )
            messages.success(request, "O'qituvchi muvaffaqiyatli yaratildi.")
            return redirect('lms:admin_dashboard')

    return render(request, "lms/admin_user_form.html", {"user_type": "teacher"})

@login_required
def create_student(request):
    if not request.user.is_superuser:
        messages.error(request, "Faqat super adminlar talaba yarata oladi.")
        return redirect('lms:admin_dashboard')

    if request.method == "POST":
        username = request.POST.get("username", "").strip()
        password = request.POST.get("password", "").strip()
        full_name = request.POST.get("full_name", "").strip()
        student_id = request.POST.get("student_id_number", "").strip()
        university = request.POST.get("university", "").strip()
        faculty = request.POST.get("faculty_name", "").strip()
        group = request.POST.get("group_name", "").strip()

        if User.objects.filter(username=username).exists():
            messages.error(request, "Ushbu login band.")
        else:
            user = User.objects.create_user(
                username=username, 
                password=password,
                role=Role.STUDENT,
                first_name=full_name.split(' ')[0] if ' ' in full_name else full_name,
            )
            StudentProfile.objects.create(
                user=user,
                full_name=full_name,
                student_id_number=student_id,
                university=university,
                faculty_name=faculty,
                group_name=group
            )
            messages.success(request, "Talaba muvaffaqiyatli yaratildi.")
            return redirect('lms:admin_dashboard')

    return render(request, "lms/admin_user_form.html", {"user_type": "student"})
