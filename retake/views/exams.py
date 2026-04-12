from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from datetime import datetime
from django.db import transaction
from ..models import (
    RetakeSubjectGroup, AssessmentSchedule, ExamSheet, 
    ExamSheetEntry, RetakeGroupMembership, ExamSheetStatus,
    AssessmentScheduleStatus, WorkflowEvent
)
from lms.models import ControlType
from users.utils.roles import Role, get_user_role

@login_required
def teacher_groups(request):
    role = get_user_role(request.user, request.session)
    if role == Role.SUPER_ADMIN:
        assessments = AssessmentSchedule.objects.all()
    elif hasattr(request.user, 'teacher_profile'):
        teacher = request.user.teacher_profile
        assessments = AssessmentSchedule.objects.filter(
            group__teacher_profile=teacher
        ) | AssessmentSchedule.objects.filter(teacher_profile=teacher)
    else:
        assessments = []
        
    return render(request, "retake/teacher_groups.html", {"assessments": assessments})

@login_required
def exam_sheet(request, sheet_id):
    sheet = get_object_or_404(ExamSheet, id=sheet_id)
    schedule = sheet.assessment_schedule
    group = schedule.group
    
    if request.method == "POST":
        if sheet.status == ExamSheetStatus.LOCKED and not (get_user_role(request.user, request.session) in [Role.SUPER_ADMIN, Role.RET_DB_MANAGER]):
            messages.error(request, "Ushbu qaydnoma yopilgan.")
            return redirect('retake:retake_teacher_groups')

        with transaction.atomic():
            # If DB Manager is unlocking
            if request.POST.get("unlock_sheet") and get_user_role(request.user, request.session) in [Role.SUPER_ADMIN, Role.RET_DB_MANAGER]:
                sheet.status = ExamSheetStatus.OPEN
                sheet.save()
                WorkflowEvent.objects.create(
                    entity_type="ExamSheet",
                    object_id=sheet.id,
                    action="unlock_sheet",
                    from_status=ExamSheetStatus.LOCKED,
                    to_status=ExamSheetStatus.OPEN,
                    actor=request.user,
                    comment="Qaydnoma DB Menejeri tomonidan ochildi."
                )
                messages.success(request, "Qaydnoma muvaffaqiyatli ochildi.")
                return redirect('retake:retake_exam_sheet', sheet_id=sheet.id)

            # Normal saving/locking
            from lms.models import Section, SectionCompletion
            lms_course = group.lms_course
            
            for entry in sheet.entries.all():
                score_str = request.POST.get(f"score_{entry.id}")
                is_absent = request.POST.get(f"absent_{entry.id}") == "on"
                
                # Check for LMS Course Completion if linked
                if lms_course and score_str and not is_absent:
                    student_user = entry.student_snapshot.student_profile.user
                    published_sections_count = Section.objects.filter(course=lms_course, is_published=True).count()
                    completed_sections_count = SectionCompletion.objects.filter(student=student_user, section__course=lms_course).count()
                    
                    if published_sections_count > 0 and completed_sections_count < published_sections_count:
                        # Student hasn't finished the course. 
                        # We skip saving the score for this specific student and move to next.
                        # Note: We don't fail the whole transaction, we just ignore this grade entry
                        # OR we could return an error. Let's return a specific message.
                        messages.warning(request, f"{entry.student_snapshot.full_name} kursni tugatmagan. Baho saqlanmadi.")
                        continue

                try:
                    score = float(score_str) if score_str and not is_absent else 0 if is_absent else None
                except ValueError:
                    score = None
                    
                entry.score = score
                entry.is_absent = is_absent
                entry.entered_by = request.user
                entry.entered_at = timezone.now()
                entry.save()

            if request.POST.get("lock_sheet"):
                if schedule.control_type == ControlType.FINAL:
                    sheet.status = ExamSheetStatus.LOCKED
                    sheet.locked_at = timezone.now()
                else:
                    sheet.status = ExamSheetStatus.SUBMITTED
                
                WorkflowEvent.objects.create(
                    entity_type="ExamSheet",
                    object_id=sheet.id,
                    action="lock_sheet",
                    from_status=ExamSheetStatus.OPEN,
                    to_status=sheet.status,
                    actor=request.user,
                    comment="Qaydnoma o'qituvchi tomonidan yakunlandi."
                )
                messages.success(request, "Qaydnoma saqlandi va yakunlandi.")
            else:
                messages.success(request, "Baholar qoralama holatida saqlandi.")
            sheet.save()
            
        return redirect('retake:retake_teacher_groups')
    
    # Stats for the template
    entries = sheet.entries.select_related('student_snapshot', 'student_snapshot__student_profile__user').order_by('student_snapshot__full_name')
    
    # Calculate Course Completion for Frontend
    from lms.models import Section, SectionCompletion
    lms_course = group.lms_course
    completion_map = {} # student_id -> (completed_count, total_published)
    if lms_course:
        published_sections_count = Section.objects.filter(course=lms_course, is_published=True).count()
        for entry in entries:
            student_user = entry.student_snapshot.student_profile.user
            completed_count = SectionCompletion.objects.filter(student=student_user, section__course=lms_course).count()
            completion_map[entry.student_snapshot_id] = {
                'completed': completed_count,
                'total': published_sections_count,
                'is_finished': completed_count >= published_sections_count if published_sections_count > 0 else True
            }

    # Calculate detailed grading stats for the 1-form summary
    grad_5 = 0; grad_4 = 0; grad_3 = 0; grad_2 = 0; grad_absent = 0
    for e in entries:
        if e.is_absent:
            grad_absent += 1
        elif e.score is not None:
            if e.score >= 86: grad_5 += 1
            elif e.score >= 71: grad_4 += 1
            elif e.score >= 60: grad_3 += 1
            else: grad_2 += 1
            
    stats = {
        'total': entries.count(),
        'present': entries.filter(is_absent=False).count(),
        'absent': grad_absent,
        'graded': entries.filter(score__isnull=False).count(),
        'count_5': grad_5,
        'count_4': grad_4,
        'count_3': grad_3,
        'count_2': grad_2,
    }
    
    # Global config check
    from ..models import RetakeAssessmentConfig
    config = RetakeAssessmentConfig.objects.filter(control_type=schedule.control_type).first()
    if config and not config.is_active:
        messages.error(request, f"{schedule.get_control_type_display()} hozirda nofaol holatda.")
        return redirect('retake:retake_teacher_groups')
    
    max_score = config.max_score if config else 100
    
    # Fetch all other scores for these students in this same group (JN, ON)
    membership_ids = entries.values_list('group_membership_id', flat=True)
    all_related_entries = ExamSheetEntry.objects.filter(
        group_membership_id__in=membership_ids,
        sheet__assessment_schedule__group=group
    ).select_related('sheet__assessment_schedule').exclude(sheet=sheet)
    
    # Map membership_id -> { 'jn': sum, 'on': sum }
    cross_scores = {}
    for e in all_related_entries:
        m_id = e.group_membership_id
        c_type = e.sheet.assessment_schedule.control_type
        if m_id not in cross_scores:
            cross_scores[m_id] = {'jn': 0, 'on': 0}
        
        # Group into JN or ON
        if c_type in ['current', '1-jn', '2-jn']:
            cross_scores[m_id]['jn'] += float(e.score or 0)
        elif c_type in ['midterm', '1-on', '2-on']:
            cross_scores[m_id]['on'] += float(e.score or 0)
            
    # Dynamic Template Support
    from ..models import ExamSheetTemplate
    custom_template = ExamSheetTemplate.objects.filter(is_active=True).first()
    rendered_custom = None
    
    if custom_template and schedule.control_type == 'final':
        # Prepare context for the custom template
        from django.template import Template, Context
        from django.template.loader import render_to_string
        
        # 1. Generate the student table HTML part
        student_table_html = render_to_string("retake/partials/exam_sheet_student_table.html", {
            "entries": entries,
            "cross_scores": cross_scores,
            "stats": stats
        })
        
        # 2. Generate stats summary
        stats_summary = f'Jami: {stats["total"]}, "5": {stats["count_5"]}, "4": {stats["count_4"]}, "3": {stats["count_3"]}, "2": {stats["count_2"]}, Kelmadi: {stats["absent"]}'
        
        # 3. Replace global placeholders
        html = custom_template.html_content
        html = html.replace("[[UNIVERSITY_NAME]]", "BUXORO DAVLAT TEXNIKA UNIVERSITETI")
        html = html.replace("[[STUDENT_TABLE]]", student_table_html)
        html = html.replace("[[STATS_SUMMARY]]", stats_summary)
        
        # 4. Render with Django Context for standard variables like {{ sheet_no }}
        t = Template(html)
        ctx = Context({
            "sheet_no": sheet.sheet_no,
            "faculty": group.cycle.name, # Or faculty snapshot
            "group_code": group.code,
            "subject_name": group.subject_snapshot.subject_name,
            "date": schedule.scheduled_at.strftime("%d.%m.%Y"),
            "schedule": schedule,
            "stats": stats
        })
        rendered_custom = t.render(ctx)
        
    return render(request, "retake/exam_sheet.html", {
        "sheet": sheet, 
        "schedule": schedule, 
        "group": group,
        "entries": entries,
        "stats": stats,
        "cross_scores": cross_scores,
        "max_score": max_score,
        "completion_map": completion_map,
        "custom_template_html": rendered_custom,
        "custom_template_css": custom_template.css_content if custom_template else "",
        "now": timezone.now()
    })

@login_required
def open_assessment_sheet(request, group_id, control_type):
    role = get_user_role(request.user, request.session)
    if role not in [Role.SUPER_ADMIN, Role.REGISTRATOR, Role.RET_DB_MANAGER]:
        return redirect('lms:portal')
        
    group = get_object_or_404(RetakeSubjectGroup, id=group_id)
    
    schedule, created = AssessmentSchedule.objects.get_or_create(
        group=group, 
        control_type=control_type,
        defaults={
            'scheduled_at': timezone.now(),
            'room': "LMS",
            'teacher_profile': group.teacher_profile,
            'status': AssessmentScheduleStatus.OPEN,
            'created_by': request.user
        }
    )
    
    if not hasattr(schedule, 'exam_sheet'):
        import uuid
        sheet_no = f"RET-{group.id}-{control_type}-{uuid.uuid4().hex[:6]}".upper()
        sheet = ExamSheet.objects.create(
            assessment_schedule=schedule,
            sheet_no=sheet_no,
            status=ExamSheetStatus.OPEN,
            opened_at=timezone.now()
        )
        # Create entries for all members
        for member in group.memberships.all():
            ExamSheetEntry.objects.create(
                sheet=sheet,
                group_membership=member,
                student_snapshot=member.student_snapshot
            )
    else:
        schedule.exam_sheet.status = ExamSheetStatus.OPEN
        schedule.exam_sheet.save()
        
    messages.success(request, f"{control_type} muvaffaqiyatli ochildi.")
    return redirect('retake:group_detail', group_id=group.id)
