# Fan Guruhi (Qayta O'qish Guruh Tizimi) — To'liq Fullstack Prompt

## Tushuncha

**Fan Guruhi** (`RetakeSubjectGroup`) — bitta semestr bo'yicha bitta fandan (masalan: "Matematika 1-semestr") 
barcha fakultetlardan kelib tushgan qayta o'qish arizalaridagi **unikal fan** asosida tuzilgan guruh.

```
Tasdiqlangan arizalar (APPROVED_FOR_GROUPING)
        ↓
Unikal fanlar bo'yicha guruhlash:
  MT-21-1 dan 8 ta talaba │
  MT-22-3 dan 12 ta talaba ├──► Fan Guruhi: "Matematika 1-semestr"
  KI-21-2 dan 5 ta talaba  │
        ↓
Har bir HEMIS guruh bo'yicha alohida nazorat jadvali:
  MT-21-1 → Joriy: 5-aprel │ Oraliq: 15-aprel │ Yakuniy: 25-aprel
  MT-22-3 → Joriy: 6-aprel │ Oraliq: 16-aprel │ Yakuniy: 26-aprel
  KI-21-2 → Joriy: 7-aprel │ Oraliq: 17-aprel │ Yakuniy: 27-aprel
        ↓
AssessmentSchedule har biri uchun ExamSheet (Qaydnoma) yaratiladi:
  ExamSheet #ES-2025-001 → MT-21-1 → Joriy → [8 talabaning bali]
  ExamSheet #ES-2025-002 → MT-22-3 → Joriy → [12 talabaning bali]
  ...
        ↓
O'qituvchi ball kiritadi → ExamSheet LOCKED → HEMIS ga yuborish
```

---

## 1. MODEL MIGRATION — `AssessmentSchedule` ga `student_group_name` qo'shish

**Muammo:** Hozirgi `AssessmentSchedule` faqat `RetakeSubjectGroup` (fan guruhi) ga bog'langan,
lekin qaysi HEMIS talabalar guruhi (MT-21-1, KI-22-3) uchun ekanini bildiruvchi field yo'q.

**Fayl:** `retake/models.py`

```python
class AssessmentSchedule(models.Model):
    group = models.ForeignKey(RetakeSubjectGroup, on_delete=models.CASCADE, related_name='assessment_schedules')
    
    # YANGI FIELD — qaysi HEMIS talabalar guruhi uchun
    student_group_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="HEMIS talabalar guruhi nomi (masalan: MT-21-1). Bo'sh bo'lsa — barcha."
    )
    
    control_type = models.CharField(max_length=16, default="other")
    scheduled_at = models.DateTimeField()
    pair_number = models.IntegerField(null=True, blank=True)
    room = models.CharField(max_length=128, blank=True, default="")
    teacher_profile = models.ForeignKey('users.TeacherProfile', on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=16, choices=AssessmentScheduleStatus.choices, default=AssessmentScheduleStatus.DRAFT)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Bir guruh uchun bir turdagi nazorat faqat bir marta bo'lishi kerak
        unique_together = [('group', 'student_group_name', 'control_type')]
```

**Migration:**
```bash
python manage.py makemigrations retake --name="add_student_group_name_to_assessment_schedule"
python manage.py migrate
```

---

## 2. BACKEND API — Yangi va Yangilangan Viewlar

### 2.1 Fan Guruhi Detail API

**Fayl:** `retake/api_views.py`

```python
@login_required
@require_http_methods(["GET"])
def api_subject_group_detail(request, group_id):
    """
    Fan guruhi to'liq ma'lumotlari:
    - guruh info
    - a'zolar (HEMIS guruh bo'yicha guruhlangan)
    - nazorat jadvali (guruh bo'yicha)
    - qaydnomalar holati
    """
    role = get_user_role(request.user, request.session)
    if role not in [Role.SUPER_ADMIN, Role.REGISTRATOR, Role.RET_DB_MANAGER, Role.RET_REGISTRATOR, Role.TEACHER]:
        return JsonResponse({'error': 'Ruxsat yo\'q'}, status=403)
    
    group = get_object_or_404(RetakeSubjectGroup, id=group_id)
    memberships = group.memberships.select_related(
        'student_snapshot', 'application_item'
    ).order_by('student_snapshot__group_name', 'student_snapshot__full_name')
    
    # A'zolarni HEMIS guruh bo'yicha guruhlash
    groups_dict = {}
    for m in memberships:
        g_name = m.student_snapshot.group_name or "Noma'lum"
        if g_name not in groups_dict:
            groups_dict[g_name] = {
                'group_name': g_name,
                'count': 0,
                'members': [],
                'control_types_needed': set()
            }
        groups_dict[g_name]['count'] += 1
        groups_dict[g_name]['members'].append({
            'membership_id': m.id,
            'student_name': m.student_snapshot.full_name,
            'student_id': m.student_snapshot.student_id_number,
            'required_control_type': m.required_control_type,
            'faculty_name': m.student_snapshot.faculty_name,
        })
        groups_dict[g_name]['control_types_needed'].add(m.required_control_type)
    
    # set() → list
    for g in groups_dict.values():
        g['control_types_needed'] = list(g['control_types_needed'])
    
    # Nazorat jadvali
    assessments = group.assessment_schedules.select_related('teacher_profile').prefetch_related('exam_sheet')
    assessments_data = []
    for a in assessments:
        exam_sheet = getattr(a, 'exam_sheet', None)
        assessments_data.append({
            'id': a.id,
            'student_group_name': a.student_group_name,
            'control_type': a.control_type,
            'control_type_label': a.control_type_label,
            'scheduled_at': a.scheduled_at.isoformat(),
            'room': a.room,
            'pair_number': a.pair_number,
            'status': a.status,
            'teacher': {
                'id': a.teacher_profile.id,
                'full_name': a.teacher_profile.full_name
            } if a.teacher_profile else None,
            'exam_sheet': {
                'id': exam_sheet.id,
                'sheet_no': exam_sheet.sheet_no,
                'status': exam_sheet.status,
                'entries_count': exam_sheet.entries.count(),
                'graded_count': exam_sheet.entries.filter(score__isnull=False).count(),
            } if exam_sheet else None
        })
    
    return JsonResponse({
        'group': {
            'id': group.id,
            'code': group.code,
            'subject_name': group.subject_snapshot.subject_name,
            'subject_code': group.subject_snapshot.subject_code,
            'semester_name': group.subject_snapshot.semester_name,
            'teacher': {
                'id': group.teacher_profile.id,
                'full_name': group.teacher_profile.full_name
            } if group.teacher_profile else None,
            'status': group.status,
            'capacity': group.capacity,
            'total_members': memberships.count(),
        },
        'student_groups': list(groups_dict.values()),
        'assessments': assessments_data,
        'teachers': [{'id': t.id, 'full_name': t.full_name} for t in TeacherProfile.objects.all().order_by('full_name')]
    })
```

---

### 2.2 Nazorat Jadvali Yaratish (Guruh bo'yicha)

```python
@login_required
@require_http_methods(["POST"])
def api_create_assessment(request, group_id):
    """
    Bitta HEMIS guruh uchun bitta nazorat jadvali yaratish va
    avtomatik ravishda ExamSheet + ExamSheetEntry larni generatsiya qilish.
    """
    role = get_user_role(request.user, request.session)
    if role not in [Role.SUPER_ADMIN, Role.REGISTRATOR, Role.RET_DB_MANAGER, Role.RET_REGISTRATOR]:
        return JsonResponse({'error': 'Ruxsat yo\'q'}, status=403)
    
    group = get_object_or_404(RetakeSubjectGroup, id=group_id)
    data = json.loads(request.body)
    
    student_group_name = data.get('student_group_name', '').strip()
    control_type = data.get('control_type', '').strip()
    scheduled_at_str = data.get('scheduled_at', '')
    room = data.get('room', '').strip()
    pair_number = data.get('pair_number')
    teacher_id = data.get('teacher_id')
    
    if not control_type or not scheduled_at_str:
        return JsonResponse({'error': 'Nazorat turi va sana kiritilishi shart'}, status=400)
    
    # Unique check
    if AssessmentSchedule.objects.filter(
        group=group,
        student_group_name=student_group_name,
        control_type=control_type
    ).exists():
        return JsonResponse({
            'error': f"'{student_group_name}' guruhi uchun '{control_type}' nazorati allaqachon jadvalda mavjud."
        }, status=400)
    
    from datetime import datetime as dt
    try:
        scheduled_at = dt.fromisoformat(scheduled_at_str)
    except ValueError:
        return JsonResponse({'error': 'Sana formati noto\'g\'ri (ISO 8601 kerak)'}, status=400)
    
    teacher_profile = TeacherProfile.objects.filter(id=teacher_id).first() if teacher_id else group.teacher_profile
    
    with transaction.atomic():
        # 1. AssessmentSchedule yaratish
        assessment = AssessmentSchedule.objects.create(
            group=group,
            student_group_name=student_group_name,
            control_type=control_type,
            scheduled_at=scheduled_at,
            room=room,
            pair_number=pair_number if pair_number else None,
            teacher_profile=teacher_profile,
            created_by=request.user,
            status=AssessmentScheduleStatus.OPEN
        )
        
        # 2. ExamSheet avtomatik yaratish
        year = scheduled_at.year
        last_sheet = ExamSheet.objects.filter(sheet_no__startswith=f"ES-{year}-").order_by('-sheet_no').first()
        if last_sheet:
            last_num = int(last_sheet.sheet_no.split('-')[-1])
            sheet_no = f"ES-{year}-{str(last_num + 1).zfill(4)}"
        else:
            sheet_no = f"ES-{year}-0001"
        
        exam_sheet = ExamSheet.objects.create(
            assessment_schedule=assessment,
            sheet_no=sheet_no,
            status=ExamSheetStatus.OPEN,
            opened_at=timezone.now()
        )
        
        # 3. ExamSheetEntry larni avtomatik to'ldirish
        # Faqat shu HEMIS guruhdagi va shu nazorat turini talab qiladigan talabalar
        memberships_query = group.memberships.select_related('student_snapshot')
        if student_group_name:
            memberships_query = memberships_query.filter(
                student_snapshot__group_name=student_group_name
            )
        # Nazorat turini filtrlash: "other" bo'lsa hammani kiritish, aks holda mos kelganlarni
        if control_type != 'other':
            memberships_query = memberships_query.filter(
                required_control_type=control_type
            )
        
        entries_created = 0
        for membership in memberships_query:
            ExamSheetEntry.objects.create(
                sheet=exam_sheet,
                group_membership=membership,
                student_snapshot=membership.student_snapshot,
            )
            entries_created += 1
            
            # Item statusini yangilash
            item = membership.application_item
            item.status = RetakeItemStatus.GRADE_ENTRY_OPEN
            item.save(update_fields=['status'])
        
        # WorkflowEvent loglash
        WorkflowEvent.objects.create(
            entity_type='ExamSheet',
            object_id=exam_sheet.id,
            action='created',
            from_status='',
            to_status=ExamSheetStatus.OPEN,
            actor=request.user,
            comment=f"{student_group_name} guruhi uchun {assessment.control_type_label} qaydnomasi yaratildi. {entries_created} ta talaba kiritildi."
        )
    
    return JsonResponse({
        'success': True,
        'assessment_id': assessment.id,
        'exam_sheet': {
            'id': exam_sheet.id,
            'sheet_no': exam_sheet.sheet_no,
            'entries_count': entries_created
        },
        'message': f"Nazorat jadvali va qaydnoma yaratildi. {entries_created} ta talaba."
    })
```

---

### 2.3 Batch — Barcha HEMIS Guruhlar uchun bir vaqtda nazorat yaratish

```python
@login_required  
@require_http_methods(["POST"])
def api_batch_create_assessments(request, group_id):
    """
    Fan guruhidagi barcha HEMIS guruhlar uchun bir turdagi nazoratni
    turli vaqt/xona bilan yaratish (masalan: barcha guruhlarga yakuniy nazorat).
    
    Payload:
    {
      "control_type": "final",
      "schedules": [
        {"student_group_name": "MT-21-1", "scheduled_at": "...", "room": "201", "pair_number": 1},
        {"student_group_name": "MT-22-3", "scheduled_at": "...", "room": "305", "pair_number": 2},
        ...
      ]
    }
    """
    role = get_user_role(request.user, request.session)
    if role not in [Role.SUPER_ADMIN, Role.REGISTRATOR, Role.RET_DB_MANAGER, Role.RET_REGISTRATOR]:
        return JsonResponse({'error': 'Ruxsat yo\'q'}, status=403)
    
    group = get_object_or_404(RetakeSubjectGroup, id=group_id)
    data = json.loads(request.body)
    control_type = data.get('control_type', '')
    schedules = data.get('schedules', [])
    
    if not control_type or not schedules:
        return JsonResponse({'error': 'control_type va schedules kiritilishi shart'}, status=400)
    
    results = []
    errors = []
    
    with transaction.atomic():
        for sched in schedules:
            student_group_name = sched.get('student_group_name', '')
            try:
                # api_create_assessment ning logic'ini qayta ishlatish (helper funksiya sifatida)
                result = _create_assessment_and_sheet(
                    group=group,
                    student_group_name=student_group_name,
                    control_type=control_type,
                    scheduled_at_str=sched.get('scheduled_at'),
                    room=sched.get('room', ''),
                    pair_number=sched.get('pair_number'),
                    teacher_id=sched.get('teacher_id'),
                    created_by=request.user
                )
                results.append(result)
            except Exception as e:
                errors.append({'student_group_name': student_group_name, 'error': str(e)})
    
    return JsonResponse({
        'created': len(results),
        'errors': errors,
        'results': results
    })
```

---

### 2.4 ExamSheet Detail + Baholash

```python
@login_required
def api_exam_sheet_detail(request, sheet_id):
    """
    Qaydnoma detali — o'qituvchi uchun baholash interfeysi.
    GET: barcha entry lar bilan
    POST: ballarni saqlash
    """
    sheet = get_object_or_404(ExamSheet, id=sheet_id)
    role = get_user_role(request.user, request.session)
    
    # Teacher faqat o'zining assessment schedule'idagi sheet'ni ko'rishi mumkin
    if role == Role.TEACHER:
        teacher_profile = getattr(request.user, 'teacher_profile', None)
        if not teacher_profile or sheet.assessment_schedule.teacher_profile != teacher_profile:
            return JsonResponse({'error': 'Ruxsat yo\'q'}, status=403)
    elif role not in [Role.SUPER_ADMIN, Role.REGISTRATOR, Role.RET_DB_MANAGER, Role.RET_REGISTRATOR]:
        return JsonResponse({'error': 'Ruxsat yo\'q'}, status=403)
    
    if request.method == 'GET':
        assessment = sheet.assessment_schedule
        entries = sheet.entries.select_related('student_snapshot').order_by('student_snapshot__full_name')
        
        # Max score config dan olish
        config = RetakeAssessmentConfig.objects.filter(control_type=assessment.control_type).first()
        max_score = float(config.max_score) if config else 100.0
        
        return JsonResponse({
            'sheet': {
                'id': sheet.id,
                'sheet_no': sheet.sheet_no,
                'status': sheet.status,
                'student_group_name': assessment.student_group_name,
                'control_type': assessment.control_type,
                'control_type_label': assessment.control_type_label,
                'scheduled_at': assessment.scheduled_at.isoformat(),
                'room': assessment.room,
                'subject_name': assessment.group.subject_snapshot.subject_name,
                'teacher': assessment.teacher_profile.full_name if assessment.teacher_profile else None,
                'max_score': max_score,
            },
            'entries': [{
                'id': e.id,
                'student_name': e.student_snapshot.full_name,
                'student_id': e.student_snapshot.student_id_number,
                'faculty_name': e.student_snapshot.faculty_name,
                'score': float(e.score) if e.score is not None else None,
                'is_absent': e.is_absent,
                'comment': e.comment,
            } for e in entries],
            'can_edit': sheet.status in [ExamSheetStatus.OPEN, ExamSheetStatus.SUBMITTED],
            'is_locked': sheet.status == ExamSheetStatus.LOCKED
        })
    
    # POST — ballarni saqlash
    if sheet.status == ExamSheetStatus.LOCKED:
        return JsonResponse({'error': 'Qaydnoma bloklangan, o\'zgartirib bo\'lmaydi'}, status=400)
    
    data = json.loads(request.body)
    action = data.get('action', 'save')  # 'save' | 'submit' | 'lock'
    
    if action in ['save', 'submit']:
        entries_data = data.get('entries', [])
        
        with transaction.atomic():
            for entry_data in entries_data:
                entry = get_object_or_404(ExamSheetEntry, id=entry_data['id'], sheet=sheet)
                entry.score = entry_data.get('score')
                entry.is_absent = entry_data.get('is_absent', False)
                entry.comment = entry_data.get('comment', '')
                entry.entered_by = request.user
                entry.entered_at = timezone.now()
                entry.save()
            
            if action == 'submit':
                sheet.status = ExamSheetStatus.SUBMITTED
                sheet.submitted_at = timezone.now()
                sheet.save()
                WorkflowEvent.objects.create(
                    entity_type='ExamSheet', object_id=sheet.id,
                    action='submitted', from_status=ExamSheetStatus.OPEN,
                    to_status=ExamSheetStatus.SUBMITTED, actor=request.user
                )
        
        return JsonResponse({'success': True, 'status': sheet.status})
    
    if action == 'lock':
        if role not in [Role.SUPER_ADMIN, Role.REGISTRATOR, Role.RET_DB_MANAGER]:
            return JsonResponse({'error': 'Bloklash uchun ruxsat yo\'q'}, status=403)
        
        with transaction.atomic():
            sheet.status = ExamSheetStatus.LOCKED
            sheet.locked_at = timezone.now()
            sheet.save()
            
            # Item statuslarini COMPLETED ga o'tkazish
            for entry in sheet.entries.select_related('group_membership__application_item'):
                item = entry.group_membership.application_item
                item.status = RetakeItemStatus.COMPLETED
                item.save(update_fields=['status'])
            
            WorkflowEvent.objects.create(
                entity_type='ExamSheet', object_id=sheet.id,
                action='locked', from_status=ExamSheetStatus.SUBMITTED,
                to_status=ExamSheetStatus.LOCKED, actor=request.user
            )
        
        return JsonResponse({'success': True, 'status': ExamSheetStatus.LOCKED})
    
    return JsonResponse({'error': 'Noto\'g\'ri action'}, status=400)
```

---

### 2.5 Fan Guruhidagi HEMIS Guruhlarni Avtomatik Aniqlash

```python
@login_required
def api_group_student_groups(request, group_id):
    """
    Fan guruhidagi talabalarni HEMIS guruh bo'yicha guruhlash va
    har biri uchun qaysi nazoratlar kerakligini qaytarish.
    Nazorat jadvali yaratish formasi uchun ishlatiladi.
    """
    group = get_object_or_404(RetakeSubjectGroup, id=group_id)
    
    memberships = group.memberships.select_related('student_snapshot').all()
    
    groups_info = {}
    for m in memberships:
        g_name = m.student_snapshot.group_name or "Noma'lum"
        if g_name not in groups_info:
            groups_info[g_name] = {
                'group_name': g_name,
                'faculty_name': m.student_snapshot.faculty_name,
                'student_count': 0,
                'control_types_needed': set(),
                'has_assessment': {}  # control_type -> bool
            }
        groups_info[g_name]['student_count'] += 1
        groups_info[g_name]['control_types_needed'].add(m.required_control_type)
    
    # Mavjud AssessmentSchedule larni tekshirish
    existing = AssessmentSchedule.objects.filter(group=group).values(
        'student_group_name', 'control_type', 'id', 'status'
    )
    existing_map = {}
    for a in existing:
        key = (a['student_group_name'], a['control_type'])
        existing_map[key] = {'id': a['id'], 'status': a['status']}
    
    result = []
    for g_name, info in sorted(groups_info.items()):
        control_types = list(info['control_types_needed'])
        assessment_status = {}
        for ct in control_types:
            key = (g_name, ct)
            assessment_status[ct] = existing_map.get(key)
        
        result.append({
            'group_name': g_name,
            'faculty_name': info['faculty_name'],
            'student_count': info['student_count'],
            'control_types_needed': control_types,
            'assessment_status': assessment_status,
            'all_scheduled': all(assessment_status.get(ct) for ct in control_types)
        })
    
    return JsonResponse({'student_groups': result})
```

---

## 3. URL ROUTING — Yangi endpointlar

**Fayl:** `retake/urls.py` ga qo'shish:

```python
# Fan Guruhi Detail API
path('api/subject-groups/<int:group_id>/', api_views.api_subject_group_detail, name='api_subject_group_detail'),
path('api/subject-groups/<int:group_id>/student-groups/', api_views.api_group_student_groups, name='api_group_student_groups'),
path('api/subject-groups/<int:group_id>/assessments/', api_views.api_create_assessment, name='api_create_assessment'),
path('api/subject-groups/<int:group_id>/assessments/batch/', api_views.api_batch_create_assessments, name='api_batch_create_assessments'),

# ExamSheet (Qaydnoma) API
path('api/exam-sheets/<int:sheet_id>/', api_views.api_exam_sheet_detail, name='api_exam_sheet_detail'),
```

---

## 4. FRONTEND — SPA Sahifalari

### 4.1 `RetakeGroupDetailPage.tsx` — To'liq guruh boshqaruvi

**Manzil:** `design/src/pages/RetakeGroupDetailPage.tsx`

```tsx
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Users, Calendar, ClipboardList, BookOpen, ArrowLeft, Plus, Zap } from 'lucide-react';
import { fetchGroupDetail, fetchGroupStudentGroups, createAssessment } from '@/src/api/retake';

type Tab = 'members' | 'schedule' | 'assessments' | 'sheets';

export default function RetakeGroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [tab, setTab] = useState<Tab>('members');
  const [data, setData] = useState<any>(null);
  const [studentGroups, setStudentGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  
  // Tab konfiguratsiyasi
  const tabs = [
    { id: 'members', label: 'A\'zolar', icon: Users },
    { id: 'schedule', label: 'Dars jadvali', icon: Calendar },
    { id: 'assessments', label: 'Nazorat jadvali', icon: ClipboardList },
    { id: 'sheets', label: 'Qaydnomalar', icon: BookOpen },
  ];
  
  // ... render
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6">
        <Link to="/retake/groups" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-primary mb-4">
          <ArrowLeft size={16} />Guruhlarga qaytish
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-text-primary">{data?.group.subject_name}</h1>
            <p className="text-sm text-text-muted mt-1">{data?.group.code} • {data?.group.semester_name}</p>
          </div>
          <div className="flex gap-3">
            <span className={`status-pill ${data?.group.status === 'active' ? 'status-pill-success' : 'status-pill-muted'}`}>
              {data?.group.status}
            </span>
            <span className="text-sm font-bold text-text-secondary">{data?.group.total_members} talaba</span>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
              tab === t.id 
                ? 'border-primary text-primary' 
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      {tab === 'members' && <MembersTab studentGroups={data?.student_groups} />}
      {tab === 'schedule' && <ClassScheduleTab groupId={groupId!} />}
      {tab === 'assessments' && (
        <AssessmentsTab 
          groupId={groupId!}
          assessments={data?.assessments}
          studentGroups={studentGroups}
          teachers={data?.teachers}
          onCreated={() => void loadData()}
        />
      )}
      {tab === 'sheets' && <ExamSheetsTab assessments={data?.assessments} />}
    </div>
  );
}
```

---

### 4.2 `MembersTab` komponenti

```tsx
function MembersTab({ studentGroups }: { studentGroups: any[] }) {
  // HEMIS guruh bo'yicha a'zolarni accordion tarzda ko'rsatish
  return (
    <div className="space-y-4">
      {studentGroups?.map(sg => (
        <details key={sg.group_name} className="card overflow-hidden">
          <summary className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50">
            <div className="flex items-center gap-3">
              <span className="font-black text-text-primary">{sg.group_name}</span>
              <span className="text-sm text-text-muted">{sg.faculty_name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold">{sg.count} ta talaba</span>
              <div className="flex gap-1">
                {sg.control_types_needed.map((ct: string) => (
                  <span key={ct} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                    {ct}
                  </span>
                ))}
              </div>
            </div>
          </summary>
          <div className="border-t border-border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-bold">F.I.O</th>
                  <th className="px-4 py-2 text-left font-bold">Talaba ID</th>
                  <th className="px-4 py-2 text-left font-bold">Nazorat turi</th>
                  <th className="px-4 py-2 text-left font-bold">Fakultet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sg.members.map((m: any) => (
                  <tr key={m.membership_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{m.student_name}</td>
                    <td className="px-4 py-3 text-text-muted">{m.student_id}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                        {m.required_control_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{m.faculty_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </div>
  );
}
```

---

### 4.3 `AssessmentsTab` komponenti — Nazorat jadvali (asosiy qism)

```tsx
function AssessmentsTab({ groupId, assessments, studentGroups, teachers, onCreated }) {
  const [showForm, setShowForm] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [form, setForm] = useState({
    student_group_name: '',
    control_type: '',
    scheduled_at: '',
    room: '',
    pair_number: '',
    teacher_id: ''
  });
  
  // Guruhlash: student_group_name + control_type bo'yicha
  const grouped = assessments?.reduce((acc: any, a: any) => {
    const key = a.student_group_name || 'Barcha guruhlar';
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});
  
  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-black">Nazorat jadvali</h3>
        <div className="flex gap-3">
          <button onClick={() => setShowBatchForm(true)} 
            className="inline-flex items-center gap-2 rounded-2xl border border-primary px-4 py-2 text-sm font-bold text-primary hover:bg-primary/5">
            <Zap size={16} />Barcha guruhlar uchun
          </button>
          <button onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-white">
            <Plus size={16} />Nazorat qo'shish
          </button>
        </div>
      </div>
      
      {/* Status matritsasi — qaysi guruh uchun qaysi nazoratlar tayyor */}
      <div className="card overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <h4 className="font-bold text-text-primary">Jadval holati</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-bold">Guruh</th>
                <th className="px-4 py-3 text-center font-bold">Joriy 1</th>
                <th className="px-4 py-3 text-center font-bold">Joriy 2</th>
                <th className="px-4 py-3 text-center font-bold">Oraliq</th>
                <th className="px-4 py-3 text-center font-bold">Yakuniy</th>
                <th className="px-4 py-3 text-center font-bold">Talabalar</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {studentGroups?.map((sg: any) => (
                <tr key={sg.group_name} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold">{sg.group_name}</td>
                  {['1-jn', '2-jn', '1-on', 'final'].map(ct => {
                    const status = sg.assessment_status?.[ct];
                    return (
                      <td key={ct} className="px-4 py-3 text-center">
                        {sg.control_types_needed.includes(ct) ? (
                          status ? (
                            <span className="text-emerald-600">✓ Tayyor</span>
                          ) : (
                            <button 
                              onClick={() => { setForm(f => ({...f, student_group_name: sg.group_name, control_type: ct})); setShowForm(true); }}
                              className="text-amber-600 hover:underline text-xs">
                              + Qo'shish
                            </button>
                          )
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center text-text-muted">{sg.student_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Mavjud nazorat jadvali — guruh bo'yicha */}
      {Object.entries(grouped || {}).map(([groupName, items]: [string, any]) => (
        <div key={groupName} className="card overflow-hidden">
          <div className="border-b border-border bg-slate-50 px-6 py-3">
            <span className="font-black text-text-primary">{groupName}</span>
            <span className="ml-2 text-sm text-text-muted">— {items.length} ta nazorat</span>
          </div>
          <div className="divide-y">
            {items.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <span className="font-bold text-text-primary">{a.control_type_label}</span>
                  <p className="mt-0.5 text-sm text-text-muted">
                    {new Date(a.scheduled_at).toLocaleString('uz')} • {a.room || 'Xona ko\'rsatilmagan'}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {a.exam_sheet ? (
                    <div className="text-right">
                      <span className={`status-pill ${
                        a.exam_sheet.status === 'locked' ? 'status-pill-success' :
                        a.exam_sheet.status === 'submitted' ? 'status-pill-warning' : 'status-pill-primary'
                      }`}>{a.exam_sheet.status}</span>
                      <p className="mt-1 text-xs text-text-muted">
                        {a.exam_sheet.graded_count}/{a.exam_sheet.entries_count} baholangan
                      </p>
                      <Link to={`/retake/exam-sheets/${a.exam_sheet.id}`} 
                        className="text-xs text-primary hover:underline">
                        {a.exam_sheet.sheet_no} →
                      </Link>
                    </div>
                  ) : (
                    <span className="text-xs text-amber-600">Qaydnoma yo'q</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      
      {/* Yangi nazorat qo'shish modali */}
      {showForm && (
        <AssessmentFormModal 
          form={form}
          setForm={setForm}
          teachers={teachers}
          studentGroups={studentGroups}
          groupId={groupId}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); onCreated(); }}
        />
      )}
    </div>
  );
}
```

---

### 4.4 `RetakeExamSheetPage.tsx` — O'qituvchi baholash sahifasi

**Manzil:** `design/src/pages/RetakeExamSheetPage.tsx`

```tsx
export default function RetakeExamSheetPage() {
  const { sheetId } = useParams<{ sheetId: string }>();
  const [data, setData] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Score yangilash
  function updateEntry(id: number, field: string, value: any) {
    setEntries(prev => prev.map(e => e.id === id ? {...e, [field]: value} : e));
  }
  
  // Saqlash
  async function handleSave(action: 'save' | 'submit' | 'lock') {
    setIsSaving(true);
    try {
      await saveExamSheet(sheetId!, { action, entries });
      if (action === 'submit') toast.success('Qaydnoma topshirildi');
      if (action === 'lock') toast.success('Qaydnoma bloklandi');
    } finally {
      setIsSaving(false);
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-primary/10 px-3 py-1 text-xs font-black text-primary">
                {data?.sheet.sheet_no}
              </span>
              <span className={`status-pill ${
                data?.sheet.status === 'locked' ? 'status-pill-success' : 'status-pill-primary'
              }`}>{data?.sheet.status}</span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-text-primary">{data?.sheet.subject_name}</h1>
            <p className="text-sm text-text-muted">
              {data?.sheet.student_group_name} • {data?.sheet.control_type_label} •{' '}
              {data?.sheet.room} • {data?.sheet.teacher}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-primary">
              {entries.filter(e => e.score !== null).length}/{entries.length}
            </p>
            <p className="text-xs text-text-muted">baholangan</p>
          </div>
        </div>
      </div>
      
      {/* Baholash jadvali */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-bold w-8">#</th>
              <th className="px-4 py-3 text-left font-bold">Talaba</th>
              <th className="px-4 py-3 text-left font-bold">Fakultet</th>
              <th className="px-4 py-3 text-center font-bold w-32">
                Ball (max: {data?.sheet.max_score})
              </th>
              <th className="px-4 py-3 text-center font-bold w-24">Kelmadi</th>
              <th className="px-4 py-3 text-left font-bold">Izoh</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((entry, idx) => (
              <tr key={entry.id} className={`hover:bg-slate-50 ${entry.is_absent ? 'bg-red-50/30' : ''}`}>
                <td className="px-4 py-3 text-text-muted">{idx + 1}</td>
                <td className="px-4 py-3 font-bold">
                  {entry.student_name}
                  <span className="ml-2 text-xs text-text-muted">{entry.student_id}</span>
                </td>
                <td className="px-4 py-3 text-text-muted">{entry.faculty_name}</td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    max={data?.sheet.max_score}
                    value={entry.score ?? ''}
                    onChange={e => updateEntry(entry.id, 'score', e.target.value ? Number(e.target.value) : null)}
                    disabled={data?.is_locked || entry.is_absent}
                    className="input text-center w-24 disabled:bg-slate-50 disabled:cursor-not-allowed"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={entry.is_absent}
                    onChange={e => {
                      updateEntry(entry.id, 'is_absent', e.target.checked);
                      if (e.target.checked) updateEntry(entry.id, 'score', null);
                    }}
                    disabled={data?.is_locked}
                    className="w-4 h-4 accent-red-500"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={entry.comment}
                    onChange={e => updateEntry(entry.id, 'comment', e.target.value)}
                    disabled={data?.is_locked}
                    className="input text-xs disabled:bg-slate-50"
                    placeholder="Izoh..."
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Action tugmalari */}
      {!data?.is_locked && (
        <div className="flex gap-3">
          <button onClick={() => void handleSave('save')} disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-bold">
            Saqlash
          </button>
          <button onClick={() => void handleSave('submit')} disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white">
            Topshirish
          </button>
          {/* Admin/registrator uchun */}
          <button onClick={() => void handleSave('lock')} disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white">
            Bloklash (yakunlash)
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## 5. API TYPES — `design/src/types/retake.ts` ga qo'shish

```typescript
// AssessmentSchedule
export interface AssessmentScheduleItem {
  id: number;
  student_group_name: string;
  control_type: string;
  control_type_label: string;
  scheduled_at: string;
  room: string;
  pair_number: number | null;
  status: 'draft' | 'open' | 'closed';
  teacher: { id: number; full_name: string } | null;
  exam_sheet: {
    id: number;
    sheet_no: string;
    status: 'draft' | 'open' | 'submitted' | 'locked';
    entries_count: number;
    graded_count: number;
  } | null;
}

// ExamSheet detail
export interface ExamSheetDetail {
  sheet: {
    id: number;
    sheet_no: string;
    status: string;
    student_group_name: string;
    control_type: string;
    control_type_label: string;
    scheduled_at: string;
    room: string;
    subject_name: string;
    teacher: string | null;
    max_score: number;
  };
  entries: ExamSheetEntryItem[];
  can_edit: boolean;
  is_locked: boolean;
}

export interface ExamSheetEntryItem {
  id: number;
  student_name: string;
  student_id: string;
  faculty_name: string;
  score: number | null;
  is_absent: boolean;
  comment: string;
}
```

---

## 6. ROUTER YANGILASH

**Fayl:** `design/src/App.tsx` yoki router faylga qo'shish:

```tsx
// Mavjud guruhlar sahifasiga "Detail" route qo'shish
<Route path="/retake/groups/:groupId" element={<RetakeGroupDetailPage />} />
<Route path="/retake/exam-sheets/:sheetId" element={<RetakeExamSheetPage />} />
```

**`RetakeManageGroupsPage.tsx` da har bir guruhga havola qo'shish:**
```tsx
// Guruh kartasini bosib Detail sahifaga o'tish
<Link to={`/retake/groups/${group.id}`}>
  {/* mavjud karta kontenti */}
</Link>
```

---

## 7. IMPLEMENTATSIYA TARTIBI

```
1. makemigrations + migrate (AssessmentSchedule.student_group_name)
2. api_subject_group_detail va api_group_student_groups viewlarini yozish
3. api_create_assessment viewini yozish (ExamSheet auto-create bilan)
4. api_exam_sheet_detail viewini yozish (GET + POST)
5. URL routing yangilash
6. RetakeGroupDetailPage.tsx yaratish (tablar bilan)
7. MembersTab, AssessmentsTab, ExamSheetsTab komponentlari
8. RetakeExamSheetPage.tsx yaratish
9. Router yangilash + RetakeManageGroupsPage linklar
10. O'qituvchi uchun sidebar navigatsiya (ExamSheets menu item)
```

---

## 8. MUHIM QOIDALAR

### Nazorat jadvali qoidasi:
- Bitta HEMIS guruh uchun bitta nazorat turidan faqat **bitta** AssessmentSchedule bo'lishi mumkin
  (unique_together: group + student_group_name + control_type)
- Nazorat yaratilishi bilan **avtomatik** ExamSheet ham yaratilishi kerak

### ExamSheetEntry to'ldirish qoidasi:
Faqat **ikkala shartni** qanoatlantirgan talabalar kiritiladi:
1. `student_snapshot__group_name == assessment.student_group_name`
2. `required_control_type == assessment.control_type` (yoki "other" bo'lsa hammasi)

### Bloklash qoidasi:
- ExamSheet LOCKED bo'lgach o'zgartirib bo'lmaydi
- Bloklanganda `RetakeApplicationItem.status = COMPLETED` bo'ladi
- Faqat SUPER_ADMIN / REGISTRATOR / RET_DB_MANAGER bloklashi mumkin
