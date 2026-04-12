from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.db import transaction
from ..models import RetakeSubjectGroup
from lms.models import Course, Enrollment

@login_required
def create_lms_course(request, group_id):
    """
    Automated view to create an LMS Course from a Retake Group
    and enroll all its members.
    """
    group = get_object_or_404(RetakeSubjectGroup, id=group_id, teacher_profile__user=request.user)
    
    if group.lms_course:
        messages.warning(request, f"'{group.code}' guruhi uchun kurs allaqachon mavjud.")
        return redirect('lms:manage_courses')
        
    try:
        with transaction.atomic():
            # 1. Create the Course
            course = Course.objects.create(
                title=f"{group.subject_snapshot.subject_name} (Qayta o'qish: {group.code})",
                description=f"{group.cycle.name} davri uchun qayta o'qish kursi. Guruh kodi: {group.code}",
                teacher=request.user,
                is_active=True
            )
            
            # 2. Link to Retake Group
            group.lms_course = course
            group.save()
            
            # 3. Enroll students
            enrollments_to_create = []
            for membership in group.memberships.all():
                # We need the User object for the student. 
                # StudentSnapshot usually links to a User or has a way to find one.
                # Assuming student_snapshot has a field 'user' or is linked via student_profile.
                student_user = membership.student_snapshot.student_profile.user
                
                # Prevent duplicate enrollments if student is already in the course (unlikely here)
                if not Enrollment.objects.filter(student=student_user, course=course).exists():
                    enrollments_to_create.append(Enrollment(student=student_user, course=course))
            
            Enrollment.objects.bulk_create(enrollments_to_create)
            
            messages.success(request, f"'{course.title}' kursi yaratildi va {len(enrollments_to_create)} ta talaba unga biriktirildi.")
            
    except Exception as e:
        messages.error(request, f"Kurs yaratishda xatolik yuz berdi: {str(e)}")
        
    return redirect('lms:manage_courses')
