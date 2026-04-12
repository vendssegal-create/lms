from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.db.models import Count
from django.utils import timezone
from datetime import datetime
from ..models import (
    RetakeCycle, RetakeSubjectGroup, RetakeGroupMembership,
    AssessmentSchedule, RetakeApplicationItem, RetakeCycleStatus,
    RetakeItemStatus, SubjectGroupStatus, AssessmentScheduleStatus,
    ClassSchedule
)
from users.models import TeacherProfile
from hemis.models import HemisSubjectSnapshot
from users.utils.roles import Role, get_user_role
from ..utils.lms_integration_utils import sync_retake_group_to_lms

@login_required
def manage_groups(request):
    role = get_user_role(request.user, request.session)
    if role not in [Role.SUPER_ADMIN, Role.REGISTRATOR, Role.RET_DB_MANAGER]:
        return redirect('lms:portal')
        
    cycle = RetakeCycle.objects.filter(status=RetakeCycleStatus.OPEN).first()
    groups = RetakeSubjectGroup.objects.filter(cycle=cycle).select_related('subject_snapshot', 'teacher_profile') if cycle else []
    
    subjects_needing_groups = RetakeApplicationItem.objects.filter(
        status=RetakeItemStatus.APPROVED_FOR_GROUPING
    ).values('subject_snapshot_id').annotate(count=Count('id'))
    
    subject_ids = [s['subject_snapshot_id'] for s in subjects_needing_groups]
    subject_names = {s.id: s.subject_name for s in HemisSubjectSnapshot.objects.filter(id__in=subject_ids)}
    
    teachers = TeacherProfile.objects.all().order_by('full_name')
    
    context = {
        "groups": groups,
        "subjects_needing_groups": subjects_needing_groups,
        "subject_names": subject_names,
        "cycle": cycle,
        "teachers": teachers,
    }
    return render(request, "retake/groups.html", context)

@login_required
def create_group(request):
    if request.method != "POST":
        return redirect('retake:manage_groups')
        
    cycle = RetakeCycle.objects.filter(status=RetakeCycleStatus.OPEN).first()
    if not cycle:
        messages.error(request, "Faol qayta topshirish davri topilmadi.")
        return redirect('retake:manage_groups')
        
    subject_id = request.POST.get("subject_id")
    code = request.POST.get("code", "").strip()
    teacher_id = request.POST.get("teacher_id")
    
    if not code:
        messages.error(request, "Guruh kodi kiritilishi shart.")
        return redirect('retake:manage_groups')
        
    subject = get_object_or_404(HemisSubjectSnapshot, id=subject_id)
    
    if RetakeSubjectGroup.objects.filter(cycle=cycle, code=code).exists():
        messages.error(request, f"'{code}' kodli guruh allaqachon mavjud.")
        return redirect('retake:manage_groups')

    group = RetakeSubjectGroup.objects.create(
        cycle=cycle,
        subject_snapshot=subject,
        code=code,
        teacher_profile_id=teacher_id if teacher_id else None,
        created_by=request.user,
        status=SubjectGroupStatus.ACTIVE
    )
    # Fully Automated Sync
    if group.teacher_profile:
        sync_retake_group_to_lms(group)
        
    messages.success(request, f"Guruh {group.code} yaratildi.")
    return redirect('retake:manage_groups')

@login_required
def group_detail(request, group_id):
    group = get_object_or_404(RetakeSubjectGroup, id=group_id)
    available_items = RetakeApplicationItem.objects.filter(
        subject_snapshot=group.subject_snapshot, 
        status=RetakeItemStatus.APPROVED_FOR_GROUPING
    ).select_related('application__student_snapshot')
    
    teachers = TeacherProfile.objects.all().order_by('full_name')
    context = {
        "group": group,
        "members": group.memberships.all().select_related('student_snapshot', 'application_item'),
        "available_items": available_items,
        "assessments": group.assessment_schedules.all(),
        "class_schedules": group.class_schedules.all(),
        "teachers": teachers
    }
    return render(request, "retake/group_detail.html", context)

@login_required
def assign_group_teacher(request, group_id):
    if request.method != "POST":
        return redirect('retake:retake_group_detail', group_id=group_id)
        
    group = get_object_or_404(RetakeSubjectGroup, id=group_id)
    teacher_id = request.POST.get("teacher_id")
    
    if teacher_id:
        group.teacher_profile_id = teacher_id
        messages.success(request, "Guruhga yangi o'qituvchi tayinlandi.")
    else:
        group.teacher_profile = None
        messages.success(request, "Guruh o'qituvchisi olib tashlandi.")
        
    group.save()
    # Fully Automated Sync
    sync_retake_group_to_lms(group)
    
    next_url = request.POST.get("next")
    if next_url:
        return redirect(next_url)
    return redirect('retake:retake_group_detail', group_id=group.id)

@login_required
def assign_to_group(request, group_id):
    if request.method != "POST":
        return redirect('retake:group_detail', group_id=group_id)
        
    group = get_object_or_404(RetakeSubjectGroup, id=group_id)
    item_ids = request.POST.getlist("item_ids")
    
    for item_id in item_ids:
        item = get_object_or_404(RetakeApplicationItem, id=item_id, subject_snapshot=group.subject_snapshot)
        if item.status == RetakeItemStatus.APPROVED_FOR_GROUPING:
            RetakeGroupMembership.objects.get_or_create(
                group=group,
                application_item=item,
                student_snapshot=item.application.student_snapshot,
                required_control_type=item.required_control_type
            )
            item.status = RetakeItemStatus.GROUPED
            item.save()
            
    # Fully Automated Sync
    sync_retake_group_to_lms(group)
            
    messages.success(request, f"Talabalar {group.code} guruhiga qo'shildi.")
    return redirect('retake:group_detail', group_id=group.id)

@login_required
def create_assessment(request, group_id):
    if request.method != "POST":
        return redirect('retake:group_detail', group_id=group_id)
        
    group = get_object_or_404(RetakeSubjectGroup, id=group_id)
    try:
        scheduled_at_str = request.POST.get("scheduled_at")
        scheduled_at = datetime.fromisoformat(scheduled_at_str)
        
        assessment = AssessmentSchedule.objects.create(
            group=group,
            control_type=request.POST.get("control_type"),
            scheduled_at=scheduled_at,
            room=request.POST.get("room", "").strip(),
            created_by=request.user,
            teacher_profile=group.teacher_profile,
            status=AssessmentScheduleStatus.OPEN
        )
        messages.success(request, "Nazorat jadvali yaratildi.")
    except Exception as e:
        messages.error(request, f"Xatolik: {str(e)}")
        
    return redirect('retake:group_detail', group_id=group.id)

@login_required
def auto_group_subjects(request):
    role = get_user_role(request.user, request.session)
    if role not in [Role.SUPER_ADMIN, Role.REGISTRATOR, Role.RET_DB_MANAGER]:
        return redirect('lms:portal')
        
    cycle = RetakeCycle.objects.filter(status=RetakeCycleStatus.OPEN).first()
    if not cycle:
        messages.error(request, "Faol qayta topshirish davri topilmadi.")
        return redirect('retake:retake_manage_groups')
        
    items = RetakeApplicationItem.objects.filter(
        status=RetakeItemStatus.APPROVED_FOR_GROUPING
    ).select_related('subject_snapshot', 'application__student_snapshot')
    
    subjects_data = {}
    for item in items:
        sid = item.subject_snapshot_id
        if sid not in subjects_data:
            subjects_data[sid] = {
                'subject': item.subject_snapshot,
                'items': [],
            }
        subjects_data[sid]['items'].append(item)
    
    suggestions = []
    MAX_CAPACITY = 25
    
    for sid, data in subjects_data.items():
        subject = data['subject']
        pending_items = data['items']
        
        # Suggest assigning to existing groups first
        existing_groups = RetakeSubjectGroup.objects.filter(
            cycle=cycle, subject_snapshot_id=sid, status=SubjectGroupStatus.ACTIVE
        )
        for group in existing_groups:
            current_count = group.memberships.count()
            available = MAX_CAPACITY - current_count
            if available > 0:
                to_assign = pending_items[:available]
                if to_assign:
                    suggestions.append({
                        'type': 'assign',
                        'group_id': group.id,
                        'group_code': group.code,
                        'subject_id': subject.id,
                        'subject_name': subject.subject_name,
                        'items_count': len(to_assign),
                        'item_ids': [it.id for it in to_assign]
                    })
                    pending_items = pending_items[available:]
        
        # Suggest creating new groups for remaining items
        idx = 1
        while pending_items:
            to_assign = pending_items[:MAX_CAPACITY]
            # Suggested code based on subject code and a sequence
            base_code = subject.subject_code or "SUB"
            suggested_code = f"{base_code}-{cycle.id}-{subject.id}-{idx}"
            while RetakeSubjectGroup.objects.filter(cycle=cycle, code=suggested_code).exists():
                idx += 1
                suggested_code = f"{base_code}-{cycle.id}-{subject.id}-{idx}"
                
            suggestions.append({
                'type': 'create',
                'subject_id': subject.id,
                'subject_name': subject.subject_name,
                'suggested_code': suggested_code,
                'items_count': len(to_assign),
                'item_ids': [it.id for it in to_assign]
            })
            pending_items = pending_items[MAX_CAPACITY:]
            idx += 1
            
    if not suggestions:
        messages.info(request, "Guruhlanishi kerak bo'lgan yangi arizalar topilmadi.")
        return redirect('retake:retake_manage_groups')

    import json
    return render(request, "retake/auto_group_suggestions.html", {
        "suggestions": suggestions,
        "suggestions_json": json.dumps(suggestions),
        "cycle": cycle
    })

@login_required
def apply_group_suggestions(request):
    if request.method != "POST":
        return redirect('retake:retake_manage_groups')
        
    cycle = RetakeCycle.objects.filter(status=RetakeCycleStatus.OPEN).first()
    if not cycle:
        return redirect('retake:retake_manage_groups')
        
    import json
    suggestions_raw = request.POST.get("suggestions_data")
    if not suggestions_raw:
        return redirect('retake:retake_manage_groups')
        
    suggestions = json.loads(suggestions_raw)
    created_count = 0
    assigned_count = 0
    
    from django.db import transaction
    with transaction.atomic():
        for sug in suggestions:
            item_ids = sug.get('item_ids', [])
            items = RetakeApplicationItem.objects.filter(id__in=item_ids)
            
            if sug['type'] == 'assign':
                group = RetakeSubjectGroup.objects.get(id=sug['group_id'])
            else:
                subject = HemisSubjectSnapshot.objects.get(id=sug['subject_id'])
                group = RetakeSubjectGroup.objects.create(
                    cycle=cycle,
                    subject_snapshot=subject,
                    code=sug['suggested_code'],
                    created_by=request.user,
                    status=SubjectGroupStatus.ACTIVE
                )
                created_count += 1
                
            for item in items:
                RetakeGroupMembership.objects.get_or_create(
                    group=group,
                    application_item=item,
                    student_snapshot=item.application.student_snapshot,
                    defaults={'required_control_type': item.required_control_type}
                )
                item.status = RetakeItemStatus.GROUPED
                item.save()
                assigned_count += 1
                
            # Fully Automated Sync per created/updated group
            sync_retake_group_to_lms(group)
                
    messages.success(request, f"{assigned_count} ta talaba guruhlandi. {created_count} ta yangi guruh yaratildi.")
    return redirect('retake:retake_manage_groups')

@login_required
def add_class_schedule(request, group_id):
    if request.method != "POST":
        return redirect('retake:retake_group_detail', group_id=group_id)
        
    group = get_object_or_404(RetakeSubjectGroup, id=group_id)
    try:
        ClassSchedule.objects.create(
            group=group,
            day_of_week=int(request.POST.get("day_of_week")),
            start_time=request.POST.get("start_time"),
            end_time=request.POST.get("end_time"),
            room=request.POST.get("room", "").strip(),
            start_date=request.POST.get("start_date"),
            end_date=request.POST.get("end_date")
        )
        messages.success(request, "Dars jadvali qo'shildi.")
    except Exception as e:
        messages.error(request, f"Xatolik: {str(e)}")
        
    return redirect('retake:retake_group_detail', group_id=group.id)

@login_required
def delete_class_schedule(request, schedule_id):
    schedule = get_object_or_404(ClassSchedule, id=schedule_id)
    group_id = schedule.group_id
    schedule.delete()
    messages.success(request, "Dars jadvali o'chirildi.")
    return redirect('retake:retake_group_detail', group_id=group_id)

@login_required
@login_required
def assign_students_view(request):
    from hemis.models import HemisStudentSnapshot
    
    role = get_user_role(request.user, request.session)
    if role not in [Role.SUPER_ADMIN, Role.RET_DB_MANAGER, Role.RET_REGISTRATOR]:
        return redirect('lms:portal')
        
    cycle = RetakeCycle.objects.filter(status=RetakeCycleStatus.OPEN).first()
    
    # Filtering logic
    faculty_filter = request.GET.get('faculty', '').strip()
    subject_filter = request.GET.get('subject_id', '').strip()
    
    # Items waiting for grouping
    pending_items = RetakeApplicationItem.objects.filter(
        status=RetakeItemStatus.APPROVED_FOR_GROUPING
    ).select_related('application__student_snapshot', 'subject_snapshot').order_by('subject_snapshot__subject_name')
    
    if faculty_filter:
        pending_items = pending_items.filter(application__student_snapshot__faculty_name=faculty_filter)
    if subject_filter:
        pending_items = pending_items.filter(subject_snapshot_id=subject_filter)
        
    # Bulk Assign Logic
    if request.method == "POST" and "bulk_assign" in request.POST:
        item_ids = request.POST.getlist('item_ids')
        target_group_id = request.POST.get('target_group_id')
        
        if not item_ids or not target_group_id:
            messages.error(request, "Talabalar va maqsadli guruh tanlanishi shart.")
        else:
            group = get_object_or_404(RetakeSubjectGroup, id=target_group_id)
            assigned_count = 0
            for item in RetakeApplicationItem.objects.filter(id__in=item_ids, status=RetakeItemStatus.APPROVED_FOR_GROUPING):
                # Ensure subject matches (safety check)
                if item.subject_snapshot_id == group.subject_snapshot_id:
                    RetakeGroupMembership.objects.get_or_create(
                        group=group,
                        application_item=item,
                        student_snapshot=item.application.student_snapshot,
                        defaults={'required_control_type': item.required_control_type}
                    )
                    item.status = RetakeItemStatus.GROUPED
                    item.save()
                    assigned_count += 1
            
            messages.success(request, f"{assigned_count} ta talaba {group.code} guruhiga muvaffaqiyatli biriktirildi.")
            return redirect('retake:retake_assign_students')

    # Existing active groups for selector
    active_groups = RetakeSubjectGroup.objects.filter(
        cycle=cycle, 
        status=SubjectGroupStatus.ACTIVE
    ).select_related('subject_snapshot', 'teacher_profile') if cycle else []
    
    # Filter selection options
    faculties = HemisStudentSnapshot.objects.values_list('faculty_name', flat=True).exclude(faculty_name='').distinct().order_by('faculty_name')
    pending_subjects = RetakeApplicationItem.objects.filter(
        status=RetakeItemStatus.APPROVED_FOR_GROUPING
    ).values('subject_snapshot_id', 'subject_snapshot__subject_name').distinct().order_by('subject_snapshot__subject_name')

    context = {
        'pending_items': pending_items,
        'active_groups': active_groups,
        'cycle': cycle,
        'faculties': faculties,
        'pending_subjects': pending_subjects,
    }
    return render(request, "retake/assign_students.html", context)

@login_required
def manage_schedules_view(request):
    role = get_user_role(request.user, request.session)
    if role not in [Role.SUPER_ADMIN, Role.RET_DB_MANAGER, Role.RET_REGISTRATOR]:
        return redirect('lms:portal')
        
    cycle = RetakeCycle.objects.filter(status=RetakeCycleStatus.OPEN).first()
    
    groups = RetakeSubjectGroup.objects.filter(
        cycle=cycle
    ).select_related('subject_snapshot', 'teacher_profile').prefetch_related(
        'class_schedules', 'assessment_schedules', 'memberships'
    ) if cycle else []
    
    teachers = TeacherProfile.objects.all().order_by('full_name')
    
    context = {
        'groups': groups,
        'cycle': cycle,
        'teachers': teachers
    }
    return render(request, "retake/manage_schedules.html", context)

@login_required
def exam_calendar_view(request):
    import calendar as cal_module
    from datetime import date
    from hemis.models import HemisStudentSnapshot
    
    role = get_user_role(request.user, request.session)
    if role not in [Role.SUPER_ADMIN, Role.RET_DB_MANAGER, Role.RET_REGISTRATOR]:
        return redirect('lms:portal')
    
    # Cycle filter
    cycles = RetakeCycle.objects.all().order_by('-created_at')
    cycle_id = request.GET.get('cycle_id', '').strip()
    if cycle_id:
        cycle = RetakeCycle.objects.filter(id=cycle_id).first()
    else:
        cycle = RetakeCycle.objects.filter(status=RetakeCycleStatus.OPEN).first()
    
    # Get current month/year from query params or default to now
    today = date.today()
    year = int(request.GET.get('year', today.year))
    month = int(request.GET.get('month', today.month))
    group_id = request.GET.get('group_id', '')
    
    # Build calendar data
    cal = cal_module.Calendar(firstweekday=0)  # Monday first
    month_days = cal.monthdayscalendar(year, month)
    
    # Month name in Uzbek
    month_names = {
        1: 'Yanvar', 2: 'Fevral', 3: 'Mart', 4: 'Aprel',
        5: 'May', 6: 'Iyun', 7: 'Iyul', 8: 'Avgust',
        9: 'Sentyabr', 10: 'Oktyabr', 11: 'Noyabr', 12: 'Dekabr'
    }
    
    # Navigation (prev/next month)
    if month == 1:
        prev_year, prev_month = year - 1, 12
    else:
        prev_year, prev_month = year, month - 1
    if month == 12:
        next_year, next_month = year + 1, 1
    else:
        next_year, next_month = year, month + 1
    
    # Get groups for filter dropdown
    groups = RetakeSubjectGroup.objects.filter(
        cycle=cycle, status=SubjectGroupStatus.ACTIVE
    ).select_related('subject_snapshot', 'teacher_profile') if cycle else []
    
    # Get assessments for this month
    assessments = AssessmentSchedule.objects.filter(
        scheduled_at__year=year,
        scheduled_at__month=month,
        group__cycle=cycle
    ).select_related('group__subject_snapshot', 'teacher_profile') if cycle else []
    
    if group_id:
        assessments = assessments.filter(group_id=group_id)
    
    # Build a dict: day_number -> list of assessments
    day_assessments = {}
    for a in assessments:
        day = a.scheduled_at.day
        if day not in day_assessments:
            day_assessments[day] = []
        day_assessments[day].append(a)
    
    teachers = TeacherProfile.objects.all().order_by('full_name')
    
    # Faculties for filter
    faculties = HemisStudentSnapshot.objects.values_list('faculty_name', flat=True).exclude(faculty_name='').distinct().order_by('faculty_name')
    
    context = {
        'cycle': cycle,
        'cycles': cycles,
        'year': year,
        'month': month,
        'month_name': month_names.get(month, ''),
        'month_days': month_days,
        'day_assessments': day_assessments,
        'prev_year': prev_year,
        'prev_month': prev_month,
        'next_year': next_year,
        'next_month': next_month,
        'groups': groups,
        'teachers': teachers,
        'faculties': faculties,
        'selected_group_id': int(group_id) if group_id else None,
    }
    return render(request, "retake/exam_calendar.html", context)

@login_required
def save_exam_schedule(request):
    if request.method != "POST":
        return redirect('retake:retake_exam_calendar')
    
    action = request.POST.get("action", "create")
    assessment_id = request.POST.get("assessment_id")
    exam_date_str = request.POST.get("exam_date", "")
    
    try:
        from datetime import datetime as dt
        pair_times = {
            '1': '08:00', '2': '09:30', '3': '11:00',
            '4': '13:00', '5': '14:30', '6': '16:00',
        }
        
        if action == "delete":
            assessment = get_object_or_404(AssessmentSchedule, id=assessment_id)
            group_code = assessment.group.code
            assessment.delete()
            messages.success(request, f"{group_code} guruhining nazorat jadvali o'chirildi.")
            
        else:
            group_id = request.POST.get("group_id")
            control_type = request.POST.get("control_type")
            teacher_id = request.POST.get("teacher_id")
            pair_number = request.POST.get("pair_number")
            room = request.POST.get("room", "").strip()
            
            if not group_id or not exam_date_str or not control_type:
                messages.error(request, "Guruh, sana va nazorat turi kiritilishi shart.")
                return redirect('retake:retake_exam_calendar')
            
            group = get_object_or_404(RetakeSubjectGroup, id=group_id)
            time_str = pair_times.get(str(pair_number), '09:00')
            scheduled_at = dt.strptime(f"{exam_date_str} {time_str}", "%Y-%m-%d %H:%M")
            teacher_profile = TeacherProfile.objects.filter(id=teacher_id).first() if teacher_id else None
            
            if action == "edit" and assessment_id:
                assessment = get_object_or_404(AssessmentSchedule, id=assessment_id)
                assessment.group = group
                assessment.control_type = control_type
                assessment.scheduled_at = scheduled_at
                assessment.pair_number = int(pair_number) if pair_number else None
                assessment.room = room
                assessment.teacher_profile = teacher_profile
                assessment.save()
                messages.success(request, f"Nazorat jadvali muvaffaqiyatli yangilandi.")
            else:
                assessment = AssessmentSchedule.objects.create(
                    group=group,
                    control_type=control_type,
                    scheduled_at=scheduled_at,
                    pair_number=int(pair_number) if pair_number else None,
                    room=room,
                    teacher_profile=teacher_profile,
                    created_by=request.user,
                    status=AssessmentScheduleStatus.OPEN
                )
                messages.success(request, f"Nazorat jadvali {group.code} guruhiga qo'shildi ({assessment.control_type_label}).")
                
    except Exception as e:
        messages.error(request, f"Xatolik: {str(e)}")
    
    # Redirect back to the same month if possible
    if exam_date_str:
        try:
            parts = exam_date_str.split("-")
            if len(parts) >= 2:
                return redirect(f"/retake/db-manager/exam-calendar/?year={parts[0]}&month={parts[1]}")
        except:
            pass
            
    return redirect('retake:retake_exam_calendar')
    
@login_required
def delete_group(request, group_id):
    role = get_user_role(request.user, request.session)
    if role not in [Role.SUPER_ADMIN, Role.RET_DB_MANAGER]:
        messages.error(request, "Guruhni o'chirish uchun huquqingiz yo'q.")
        return redirect('retake:retake_manage_groups')
        
    group = get_object_or_404(RetakeSubjectGroup, id=group_id)
    group_code = group.code
    
    # Reset membership item statuses before deletion
    from ..models import RetakeItemStatus
    memberships = group.memberships.select_related('application_item').all()
    for member in memberships:
        item = member.application_item
        item.status = RetakeItemStatus.APPROVED_FOR_GROUPING
        item.save()
        
    group.delete()
    messages.success(request, f"'{group_code}' guruhi muvaffaqiyatli o'chirildi va talabalar holati qayta tiklandi.")
    return redirect('retake:retake_manage_groups')
