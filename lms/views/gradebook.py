from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from decimal import Decimal
from django.db.models import Max
from lms.models import Course, Enrollment, CourseGradebook, GradebookEntry, Test, ControlType, TestAttempt
from users.utils.roles import Role, get_user_role, role_required

@login_required
@role_required(Role.TEACHER, Role.SUPER_ADMIN)
def course_gradebook(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    gradebook, created = CourseGradebook.objects.get_or_create(course=course)
    
    enrollments = Enrollment.objects.filter(course=course).select_related('student', 'student__student_profile')
    entries = {e.student_id: e for e in GradebookEntry.objects.filter(gradebook=gradebook)}
    
    students_data = []
    for enrollment in enrollments:
        student = enrollment.student
        entry = entries.get(student.id)
        students_data.append({
            "student": student,
            "profile": getattr(student, 'student_profile', None),
            "entry": entry,
            "current": entry.current_score if entry else None,
            "midterm": entry.midterm_score if entry else None,
            "final": entry.final_score if entry else None,
            "total": entry.total_score if entry else None,
        })
        
    tests = Test.objects.filter(course=course)
    
    return render(request, "lms/gradebook.html", {
        "course": course,
        "gradebook": gradebook,
        "students_data": students_data,
        "tests": tests
    })

@login_required
@role_required(Role.TEACHER, Role.SUPER_ADMIN)
def gradebook_setup(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    gradebook, created = CourseGradebook.objects.get_or_create(course=course)
    
    if request.method == "POST":
        gradebook.current_max = int(request.POST.get("current_max", 30))
        gradebook.midterm_max = int(request.POST.get("midterm_max", 30))
        gradebook.final_max = int(request.POST.get("final_max", 40))
        gradebook.save()
        messages.success(request, "Qaydnoma sozlamalari saqlandi.")
        return redirect('lms:course_gradebook', course_id=course.id)
        
    return render(request, "lms/gradebook_setup.html", {"course": course, "gradebook": gradebook})

@login_required
@role_required(Role.TEACHER, Role.SUPER_ADMIN)
def save_gradebook(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    gradebook = get_object_or_404(CourseGradebook, course=course)
    
    if gradebook.is_locked:
        messages.error(request, "Qaydnoma yopilgan, o'zgartirish kiritib bo'lmaydi.")
        return redirect('lms:course_gradebook', course_id=course.id)
        
    if request.method == "POST":
        enrollments = Enrollment.objects.filter(course=course)
        for enrollment in enrollments:
            sid = enrollment.student_id
            entry, created = GradebookEntry.objects.get_or_create(gradebook=gradebook, student_id=sid)
            
            raw_current = request.POST.get(f"current_{sid}")
            raw_midterm = request.POST.get(f"midterm_{sid}")
            raw_final = request.POST.get(f"final_{sid}")
            
            entry.current_score = Decimal(raw_current) if raw_current else None
            entry.midterm_score = Decimal(raw_midterm) if raw_midterm else None
            entry.final_score = Decimal(raw_final) if raw_final else None
            
            parts = [float(entry.current_score or 0), float(entry.midterm_score or 0), float(entry.final_score or 0)]
            entry.total_score = Decimal(str(round(sum(parts), 2)))
            entry.entered_by = request.user
            entry.save()
            
        messages.success(request, "Gradebook saqlandi.")
    return redirect('lms:course_gradebook', course_id=course.id)

@login_required
@role_required(Role.TEACHER, Role.SUPER_ADMIN)
def gradebook_import_test(request, course_id, test_id):
    course = get_object_or_404(Course, id=course_id)
    test = get_object_or_404(Test, id=test_id, course=course)
    gradebook, created = CourseGradebook.objects.get_or_create(course=course)
    
    score_field = {
        ControlType.CURRENT: "current_score",
        ControlType.MIDTERM: "midterm_score",
        ControlType.FINAL: "final_score"
    }.get(test.control_type)
    
    if not score_field:
        messages.error(request, "Test turi aniqlanmadi.")
        return redirect('lms:course_gradebook', course_id=course.id)
        
    max_score_val = {
        ControlType.CURRENT: gradebook.current_max,
        ControlType.MIDTERM: gradebook.midterm_max,
        ControlType.FINAL: gradebook.final_max
    }.get(test.control_type, 30)
    
    # Get best scores for each student
    attempts = TestAttempt.objects.filter(test=test, is_completed=True).values('student_id').annotate(best_score=Max('score'))
    
    count = 0
    for attr in attempts:
        student_id = attr['student_id']
        raw_score = attr['best_score']
        
        # In our Django model, student in TestAttempt is StudentProfile (has .user_id)
        # But in GradebookEntry, it is User model ID
        from users.models import StudentProfile
        student_profile = StudentProfile.objects.filter(id=student_id).first()
        if not student_profile or not student_profile.user_id:
            continue
            
        user_id = student_profile.user_id
        entry, created = GradebookEntry.objects.get_or_create(gradebook=gradebook, student_id=user_id)
        
        scaled = round((float(raw_score) / test.max_score) * float(max_score_val), 2) if test.max_score > 0 else 0
        setattr(entry, score_field, Decimal(str(scaled)))
        entry.linked_test = test
        entry.entered_by = request.user
        
        parts = [float(entry.current_score or 0), float(entry.midterm_score or 0), float(entry.final_score or 0)]
        entry.total_score = Decimal(str(round(sum(parts), 2)))
        entry.save()
        count += 1
        
    messages.success(request, f"{count} ta talaba natijasi import qilindi.")
    return redirect('lms:course_gradebook', course_id=course.id)

@login_required
def student_grades(request):
    # LMS kurslari bo'yicha baholar
    enrollments = Enrollment.objects.filter(student=request.user).select_related('course')
    lms_data = []
    for enrollment in enrollments:
        gradebook = CourseGradebook.objects.filter(course=enrollment.course).first()
        entry = None
        if gradebook:
            entry = GradebookEntry.objects.filter(gradebook=gradebook, student=request.user).first()
        lms_data.append({
            "enrollment": enrollment,
            "gradebook": gradebook,
            "entry": entry
        })
    
    # Retake natijalari — HemisStudentSnapshot orqali topamiz (StudentProfile.student_id_number bo'yicha)
    from retake.models import ExamSheetEntry, ExamSheetStatus
    from hemis.models import HemisStudentSnapshot
    student_profile = getattr(request.user, 'student_profile', None)
    snapshot_ids = []
    if student_profile and student_profile.student_id_number:
        snapshot_ids = list(HemisStudentSnapshot.objects.filter(
            student_id_number=student_profile.student_id_number
        ).values_list('id', flat=True))
    retake_entries = ExamSheetEntry.objects.filter(
        student_snapshot_id__in=snapshot_ids
    ).select_related('sheet', 'sheet__assessment_schedule', 'sheet__assessment_schedule__group__subject_snapshot') if snapshot_ids else ExamSheetEntry.objects.none()
    
    retake_data = []
    for re in retake_entries:
        # Faqat ochiq bo'lmagan (topshirilgan yoki bloklangan) qaydnomalarni ko'rsatamiz
        if re.sheet.status in [ExamSheetStatus.SUBMITTED, ExamSheetStatus.LOCKED]:
            retake_data.append({
                "subject_name": re.sheet.assessment_schedule.group.subject_snapshot.subject_name,
                "control_type": re.sheet.assessment_schedule.control_type_label,
                "score": re.score,
                "is_absent": re.is_absent,
                "status": re.sheet.status,
                "date": re.sheet.assessment_schedule.scheduled_at
            })
            
    return render(request, "lms/student_grades.html", {
        "lms_data": lms_data,
        "retake_data": retake_data
    })
