from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from datetime import datetime, timedelta
from lms.models import Test, Course, Question, TestAttempt, Enrollment, ControlType, Section
from users.utils.roles import (
    Role, 
    get_user_role, 
    can_manage_tests, 
    can_view_test_reporting,
    get_dashboard_url
)
from lms.utils.tests import (
    build_test_question_order, 
    get_questions_from_order, 
    calculate_test_score, 
    get_attempt_end_time
)

def _has_global_admin_access(user):
    return bool(user.is_superuser or getattr(user, "role", None) == Role.SUPER_ADMIN)

def _parse_datetime(value: str | None):
    if not value:
        return None
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None

@login_required
def teacher_tests(request):
    if not can_view_test_reporting(request.user, request.session):
        return redirect('lms:portal')
    
    role = get_user_role(request.user, request.session)
    tests_qs = Test.objects.all()
    if role == Role.TEACHER and not _has_global_admin_access(request.user):
        tests_qs = tests_qs.filter(course__teacher=request.user)
    
    tests = tests_qs.order_by('-created_at')
    active_tests_count = tests_qs.filter(is_active=True).count() if hasattr(Test, 'is_active') else 0

    context = {
        "tests": tests,
        "active_tests_count": active_tests_count,
        "can_manage_tests": can_manage_tests(request.user, request.session),
        "dashboard_home_url_name": get_dashboard_url(request.user, request.session),
        "show_results_only": role in [Role.DIRECTION, Role.REGISTRATOR, Role.ACADEMIC_BOARD],
    }
    return render(request, "lms/teacher_tests.html", context)

@login_required
def create_test(request):
    if not can_manage_tests(request.user, request.session):
        return redirect('lms:portal')

    role = get_user_role(request.user, request.session)
    if role == Role.TEACHER and not _has_global_admin_access(request.user):
        courses = Course.objects.filter(teacher=request.user)
    else:
        courses = Course.objects.all()
    course_id = request.GET.get("course_id")
    section_id_get = request.GET.get("section_id")
    sections = []
    selected_section_id = None
    if course_id:
        sections = Section.objects.filter(course_id=course_id).order_by("order")
        if section_id_get and str(section_id_get).isdigit():
            sid = int(section_id_get)
            if sections.filter(pk=sid).exists():
                selected_section_id = sid

    if request.method == "POST":
        post_course_id = int(request.POST.get("course_id") or 0)
        selected_course = get_object_or_404(Course, id=post_course_id)
        if role == Role.TEACHER and not _has_global_admin_access(request.user) and selected_course.teacher_id != request.user.id:
            messages.error(request, "Bu kurs sizga tegishli emas.")
            return redirect('lms:teacher_tests')
        post_section_raw = (request.POST.get("section_id") or "").strip()
        section_pk = None
        if post_section_raw.isdigit():
            cand = int(post_section_raw)
            if Section.objects.filter(pk=cand, course_id=post_course_id).exists():
                section_pk = cand

        test = Test.objects.create(
            name=request.POST.get("name", "").strip(),
            is_active=bool(request.POST.get("is_active")),
            description=request.POST.get("description", "").strip(),
            start_datetime=_parse_datetime(request.POST.get("start_datetime")) or timezone.now(),
            end_datetime=_parse_datetime(request.POST.get("end_datetime")) or (timezone.now() + timedelta(hours=1)),
            duration_minutes=int(request.POST.get("duration_minutes") or 30),
            max_score=int(request.POST.get("max_score") or 100),
            course_id=post_course_id,
            section_id=section_pk,
            control_type=request.POST.get("control_type", ControlType.OTHER),
            attempts_allowed=int(request.POST.get("attempts") or 1),
            question_count=int(request.POST.get("question_count") or 10),
            is_random_order=bool(request.POST.get("is_random_order")),
            proctoring_enabled=bool(request.POST.get("proctoring_enabled")),
            face_id_required=bool(request.POST.get("face_id_required")),
            max_tab_switches=int(request.POST.get("max_tab_switches") or 3),
        )
        messages.success(request, "Test yaratildi. Endi savollarni qo'shishingiz mumkin.")
        return redirect('lms:add_questions', test_id=test.id)

    context = {
        "action": "create",
        "courses": courses,
        "sections": sections,
        "selected_course_id": int(course_id) if course_id and str(course_id).isdigit() else None,
        "selected_section_id": selected_section_id,
    }
    return render(request, "lms/test_form.html", context)

@login_required
def edit_test(request, test_id):
    role = get_user_role(request.user, request.session)
    if role == Role.TEACHER and not _has_global_admin_access(request.user):
        test = get_object_or_404(Test, id=test_id, course__teacher=request.user)
        courses = Course.objects.filter(teacher=request.user)
    else:
        test = get_object_or_404(Test, id=test_id)
        courses = Course.objects.all()
    sections = Section.objects.filter(course=test.course).order_by('order')
    
    if request.method == "POST":
        test.name = request.POST.get("name", test.name).strip()
        test.is_active = bool(request.POST.get("is_active"))
        test.description = request.POST.get("description", test.description).strip()
        test.start_datetime = _parse_datetime(request.POST.get("start_datetime")) or test.start_datetime
        test.end_datetime = _parse_datetime(request.POST.get("end_datetime")) or test.end_datetime
        test.duration_minutes = int(request.POST.get("duration_minutes") or test.duration_minutes)
        test.max_score = int(request.POST.get("max_score") or test.max_score)
        test.course_id = int(request.POST.get("course_id") or test.course_id)
        test.section_id = request.POST.get("section_id") or None
        test.control_type = request.POST.get("control_type", test.control_type)
        test.attempts_allowed = int(request.POST.get("attempts") or test.attempts_allowed)
        test.question_count = int(request.POST.get("question_count") or test.question_count)
        test.is_random_order = bool(request.POST.get("is_random_order"))
        test.proctoring_enabled = bool(request.POST.get("proctoring_enabled"))
        test.face_id_required = bool(request.POST.get("face_id_required"))
        test.max_tab_switches = int(request.POST.get("max_tab_switches") or test.max_tab_switches)
        test.save()
        messages.success(request, "Test muvaffaqiyatli yangilandi!")
        return redirect('lms:teacher_tests')
        
    question_total = test.questions.count()
    now = timezone.now()
    if not test.is_active:
        test_status = "Qoralama"
        test_status_tone = "warning"
    elif test.end_datetime and test.end_datetime < now:
        test_status = "Yakunlangan"
        test_status_tone = "danger"
    else:
        test_status = "Faol"
        test_status_tone = "success"

    context = {
        "action": "edit",
        "test": test,
        "courses": courses,
        "sections": sections,
        "question_total": question_total,
        "test_status": test_status,
        "test_status_tone": test_status_tone,
    }
    return render(request, "lms/test_form.html", context)

@login_required
def add_questions(request, test_id):
    role = get_user_role(request.user, request.session)
    if role == Role.TEACHER and not _has_global_admin_access(request.user):
        test = get_object_or_404(Test, id=test_id, course__teacher=request.user)
    else:
        test = get_object_or_404(Test, id=test_id)
    if request.method == "POST":
        memo_text = request.POST.get("memo_text", "").strip()
        if memo_text:
            blocks = [block.strip() for block in memo_text.split("+++++") if block.strip()]
            count = 0
            for block in blocks:
                parts = [part.strip() for part in block.split("====") if part.strip()]
                if len(parts) < 3: continue
                
                correct_idx = "1"
                options = []
                for i, opt in enumerate(parts[1:], start=1):
                    if opt.startswith("#"):
                        correct_idx = str(i)
                        opt = opt[1:].strip()
                    options.append(opt)
                
                while len(options) < 4:
                    options.append("")
                
                Question.objects.create(
                    test=test,
                    text=parts[0],
                    option1=options[0],
                    option2=options[1],
                    option3=options[2],
                    option4=options[3],
                    correct_answer=correct_idx,
                    score=1
                )
                count += 1
            messages.success(request, f"{count} ta savol yuklandi!")
            return redirect('lms:add_questions', test_id=test.id)

        text = request.POST.get("text", "").strip()
        if text:
            Question.objects.create(
                test=test,
                text=text,
                option1=request.POST.get("option1", "").strip(),
                option2=request.POST.get("option2", "").strip(),
                option3=request.POST.get("option3", "").strip(),
                option4=request.POST.get("option4", "").strip(),
                correct_answer=request.POST.get("correct_answer", "1"),
                score=int(request.POST.get("score") or 1)
            )
            messages.success(request, "Savol qo'shildi!")
            return redirect('lms:add_questions', test_id=test.id)
            
    return render(request, "lms/add_questions.html", {"test": test, "questions": test.questions.all()})

@login_required
def student_tests(request):
    enrolled_course_ids = Enrollment.objects.filter(student=request.user).values_list('course_id', flat=True)
    tests = Test.objects.filter(course_id__in=enrolled_course_ids, is_active=True).order_by('start_datetime')
    
    student_profile = getattr(request.user, 'student_profile', None)
    if not student_profile:
        messages.error(request, "Talaba profili topilmadi.")
        return redirect('lms:portal')

    tests_with_attempts = []
    for test in tests:
        completed_attempts = TestAttempt.objects.filter(student=student_profile, test=test, is_completed=True).order_by('-finished_at')
        active_attempt = TestAttempt.objects.filter(student=student_profile, test=test, is_completed=False).first()
        attempts_done = completed_attempts.count()
        last_attempt = completed_attempts.first()
        
        tests_with_attempts.append({
            "test": test,
            "attempts_done": attempts_done,
            "attempts_left": max(test.attempts_allowed - attempts_done, 0),
            "last_score": last_attempt.score if last_attempt else None,
            "has_active_attempt": active_attempt is not None,
        })
        
    return render(request, "lms/student_tests.html", {"tests_with_attempts": tests_with_attempts})

@login_required
def take_test(request, test_id):
    test = get_object_or_404(Test, id=test_id)
    enrollment = Enrollment.objects.filter(student=request.user, course=test.course).first()
    if not enrollment:
        messages.error(request, "Siz ushbu test uchun ro'yxatdan o'tmagansiz.")
        return redirect('lms:student_tests')

    student_profile = getattr(request.user, 'student_profile', None)
    if not student_profile:
        messages.error(request, "Talaba profili topilmadi.")
        return redirect('lms:portal')

    active_attempt = TestAttempt.objects.filter(student=student_profile, test=test, is_completed=False).order_by('-started_at').first()
    now = timezone.now()

    if not test.is_active:
        messages.error(request, "Bu test hozirda faol emas.")
        return redirect('lms:student_tests')
    
    if not active_attempt and test.start_datetime > (now + timedelta(minutes=2)):
        messages.error(request, f"Test hali boshlanmadi. Boshlanishi: {test.start_datetime}")
        return redirect('lms:student_tests')
        
    if not active_attempt and test.end_datetime < now:
        messages.error(request, "Test muddati tugagan.")
        return redirect('lms:student_tests')

    face_verified_key = f"face_verified_{test.id}"
    if test.face_id_required and not request.session.get(face_verified_key):
        face_image_url = None
        if student_profile.image:
             face_image_url = student_profile.image_url
        return render(request, "lms/face_verify.html", {"test": test, "student": student_profile, "face_image_url": face_image_url})

    attempt = active_attempt
    if attempt is None:
        completed_count = TestAttempt.objects.filter(student=student_profile, test=test, is_completed=True).count()
        if completed_count >= test.attempts_allowed:
            messages.error(request, "Urinishlar tugagan.")
            return redirect('lms:student_tests')
            
        question_order = build_test_question_order(test)
        if not question_order:
            messages.error(request, "Savollar topilmadi.")
            return redirect('lms:student_tests')
            
        attempt = TestAttempt.objects.create(
            student=student_profile,
            test=test,
            question_order=question_order,
            answers={}
        )

    questions = get_questions_from_order(test, attempt.question_order)
    end_time = get_attempt_end_time(test, attempt)
    
    if end_time:
        remaining = (end_time - timezone.now()).total_seconds()
        attempt_total_seconds = max(0, int(remaining))
    else:
        attempt_total_seconds = test.duration_minutes * 60

    per_question_score = calculate_test_score(test, len(questions), 1)
    
    face_image_url = student_profile.image_url if student_profile.image else None

    if request.method == "POST":
        answers = {}
        correct_count = 0
        for q in questions:
            ans = request.POST.get(f"question_{q.id}")
            answers[str(q.id)] = ans
            if ans and str(ans) == str(q.correct_answer):
                correct_count += 1
        
        attempt.score = calculate_test_score(test, len(questions), correct_count)
        attempt.correct_count = correct_count
        attempt.answers = answers
        attempt.finished_at = timezone.now()
        attempt.is_completed = True
        attempt.save()
        
        messages.success(request, f"Test yakunlandi. Ball: {attempt.score}/{test.max_score}")
        return redirect('lms:student_tests')

    context = {
        "test": test,
        "attempt": attempt,
        "questions": questions,
        "saved_answers": attempt.answers or {},
        "end_time": end_time.isoformat() if end_time else None,
        "attempt_total_seconds": attempt_total_seconds,
        "per_question_score": per_question_score,
        "face_image_url": face_image_url,
    }
    return render(request, "lms/take_test.html", context)

@login_required
def view_test_result(request, test_id):
    test = get_object_or_404(Test, id=test_id)
    student_profile = getattr(request.user, 'student_profile', None)
    attempt = TestAttempt.objects.filter(student=student_profile, test=test, is_completed=True).order_by('-finished_at').first()
    if not attempt:
        messages.error(request, "Natija topilmadi.")
        return redirect('lms:student_tests')

    questions = get_questions_from_order(test, attempt.question_order)
    result_items = []
    for idx, q in enumerate(questions, start=1):
        user_ans = (attempt.answers or {}).get(str(q.id))
        result_items.append({
            "number": idx,
            "question": q,
            "user_answer_val": getattr(q, f"option{user_ans}") if user_ans else None,
            "correct_answer_val": getattr(q, f"option{q.correct_answer}"),
            "is_correct": str(user_ans) == str(q.correct_answer),
        })

    return render(request, "lms/view_test_result.html", {"test": test, "attempt": attempt, "result_items": result_items})
