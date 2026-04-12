# O'qituvchi → LMS Biriktirish va Baholash Tizimi (Qayta O'qish)
## To'liq Fullstack Prompt

---

## Muammo: Hozirgi holat

```
sync_retake_group_to_lms()  ← Fan guruhi barcha a'zolarini biriktiradi
                               HEMIS guruh farqsiz, barchasi bitta kursga
create_lms_course view      ← Xuddi shu muammo

ExamSheet grading           ← Baholashda LMS completion tekshiriladi
                               Lekin enrollment qaysi HEMIS guruh uchun
                               ekanini bilmaydi
```

---

## To'g'ri oqim (user tasdiqlagan)

```
RetakeSubjectGroup: "Matematika 1-semestr"
├── HEMIS guruh: MT-21-1 → 8 talaba
├── HEMIS guruh: MT-22-3 → 12 talaba  
└── HEMIS guruh: KI-21-2 → 5 talaba

         ↓  O'qituvchi "LMS kurs yaratish" bosadi

LMS Course: "Matematika 1-semestr (Qayta o'qish)"
├── Enrolled: MT-21-1 dan 8 ta talaba
├── Enrolled: MT-22-3 dan 12 ta talaba  
├── Enrolled: KI-21-2 dan 5 ta talaba
│   (O'qituvchi guruh tanlab yoki barchasini qo'shadi)
│
└── Teacher kurs kontentini qo'shadi (bo'limlar, materiallar)
              ↓
         Talabalar o'qiydi → SectionCompletion yaratiladi
              ↓
    O'qituvchi ExamSheet ochadi (masalan: MT-21-1 → Yakuniy)
              ↓
    Har talaba qatori: [Ismi] [Tugatdi ✓/✗ X/Y] [Ball input] [Kelmadi]
    Ball faqat tugatganlar uchun kiritiladi (yoki ogohlantirish bilan)
              ↓
    O'qituvchi → Saqlash → Topshirish
    DB Manager → Bloklash → ExamSheet LOCKED
```

---

## 1-QADAM: YANGI MODEL — `RetakeCourseEnrollmentLog`

**Fayl:** `retake/models.py`

```python
class RetakeCourseEnrollmentLog(models.Model):
    """
    Qayta o'qish LMS kursiga talaba qo'shilganda log.
    Qaysi fan guruhi, qaysi HEMIS guruh, qachon, kim tomonidan qo'shilganini saqlaydi.
    """
    group = models.ForeignKey(
        RetakeSubjectGroup,
        on_delete=models.CASCADE,
        related_name='enrollment_logs'
    )
    lms_course = models.ForeignKey(
        'lms.Course',
        on_delete=models.CASCADE,
        related_name='retake_enrollment_logs'
    )
    student_snapshot = models.ForeignKey(
        'hemis.HemisStudentSnapshot',
        on_delete=models.CASCADE
    )
    hemis_student_group = models.CharField(
        max_length=255,
        default="",
        help_text="Student snapshot ning group_name qiymati"
    )
    enrolled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True
    )
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['group', 'lms_course', 'student_snapshot']
        verbose_name = "Retake LMS Enrollment Log"
```

**Migration:**
```bash
python manage.py makemigrations retake --name="retake_course_enrollment_log"
python manage.py migrate
```

---

## 2-QADAM: `sync_retake_group_to_lms` YANGILASH

**Fayl:** `retake/utils/lms_integration_utils.py`

```python
from django.db import transaction
from lms.models import Course, Enrollment
from retake.models import RetakeCourseEnrollmentLog
import logging

logger = logging.getLogger(__name__)


def sync_retake_group_to_lms(group, student_group_names=None, enrolled_by=None):
    """
    RetakeSubjectGroup ni LMS ga sinxronlashtiradi.
    
    Args:
        group: RetakeSubjectGroup instance
        student_group_names: list | None
            - None → barcha fan guruhi a'zolari biriktiriladi
            - ['MT-21-1', 'KI-22-3'] → faqat shu HEMIS guruhlar biriktiriladi
        enrolled_by: User instance (kim biriktirdi)
    
    Returns:
        dict: {'course': Course, 'enrolled': int, 'already_enrolled': int, 'skipped': int}
    """
    if not group.teacher_profile:
        logger.warning(f"Group {group.id} has no teacher, skipping LMS sync")
        return None

    try:
        with transaction.atomic():
            teacher_user = group.teacher_profile.user

            # 1. Kurs mavjudligini tekshirish / yaratish
            course = group.lms_course
            if not course:
                course = Course.objects.create(
                    title=f"{group.subject_snapshot.subject_name} (Qayta o'qish: {group.code})",
                    description=(
                        f"Qayta o'qish davri: {group.cycle.name}.\n"
                        f"Fan: {group.subject_snapshot.subject_name} "
                        f"({group.subject_snapshot.semester_name}).\n"
                        f"Guruh kodi: {group.code}."
                    ),
                    teacher=teacher_user,
                    is_active=True
                )
                group.lms_course = course
                group.save(update_fields=['lms_course'])
                logger.info(f"Created LMS course {course.id} for retake group {group.id}")
            else:
                # O'qituvchi o'zgargan bo'lsa yangilash
                if course.teacher_id != teacher_user.id:
                    course.teacher = teacher_user
                    course.save(update_fields=['teacher'])

            # 2. Biriktiriladigan a'zolarni aniqlash
            memberships_qs = group.memberships.select_related('student_snapshot')
            if student_group_names is not None:
                memberships_qs = memberships_qs.filter(
                    student_snapshot__group_name__in=student_group_names
                )

            # 3. Mavjud enrollment larni olish
            existing_enrollment_ids = set(
                Enrollment.objects.filter(course=course)
                .values_list('student_id', flat=True)
            )

            enrolled_count = 0
            already_count = 0
            skipped_count = 0
            enrollments_to_create = []
            logs_to_create = []

            for membership in memberships_qs:
                snapshot = membership.student_snapshot
                
                # Student User ni topish
                student_user = None
                try:
                    student_profile = snapshot.student_profile
                    student_user = student_profile.user
                except Exception:
                    skipped_count += 1
                    logger.warning(f"No user found for student snapshot {snapshot.id}")
                    continue

                if student_user.id in existing_enrollment_ids:
                    already_count += 1
                    continue

                enrollments_to_create.append(
                    Enrollment(student=student_user, course=course)
                )
                logs_to_create.append(
                    RetakeCourseEnrollmentLog(
                        group=group,
                        lms_course=course,
                        student_snapshot=snapshot,
                        hemis_student_group=snapshot.group_name or "",
                        enrolled_by=enrolled_by
                    )
                )
                enrolled_count += 1

            if enrollments_to_create:
                Enrollment.objects.bulk_create(enrollments_to_create, ignore_conflicts=True)
                RetakeCourseEnrollmentLog.objects.bulk_create(logs_to_create, ignore_conflicts=True)

            logger.info(
                f"Group {group.id} sync: enrolled={enrolled_count}, "
                f"already={already_count}, skipped={skipped_count}"
            )

            return {
                'course': course,
                'enrolled': enrolled_count,
                'already_enrolled': already_count,
                'skipped': skipped_count
            }

    except Exception as e:
        logger.error(f"Error syncing retake group {group.id} to LMS: {str(e)}", exc_info=True)
        return None
```

---

## 3-QADAM: YANGI API ENDPOINT — O'qituvchi enrollment boshqaruvi

**Fayl:** `retake/api_views.py` ga qo'shish

### 3.1 `api_teacher_course_enrollment` — GET + POST

```python
@login_required
def api_teacher_course_enrollment(request, group_id):
    """
    O'qituvchi o'z fan guruhiga talabalarni LMS kursiga biriktiradi.
    
    GET: Fan guruhidagi HEMIS guruhlar va har birining enrollment holati
    POST: Tanlangan HEMIS guruhlarni kursga biriktirish
    """
    from ..utils.lms_integration_utils import sync_retake_group_to_lms
    from lms.models import Enrollment
    
    role = get_user_role(request.user, request.session)
    
    group = get_object_or_404(RetakeSubjectGroup, id=group_id)
    
    # Faqat guruh o'qituvchisi yoki admin/db-manager
    is_teacher = (
        role == Role.TEACHER and
        hasattr(request.user, 'teacher_profile') and
        group.teacher_profile == request.user.teacher_profile
    )
    is_admin = role in [Role.SUPER_ADMIN, Role.REGISTRATOR, Role.RET_DB_MANAGER]
    
    if not (is_teacher or is_admin):
        return JsonResponse({'error': 'Bu guruh uchun ruxsatingiz yo\'q'}, status=403)

    # Barcha a'zolar (HEMIS guruh bo'yicha)
    memberships = group.memberships.select_related('student_snapshot').all()

    # HEMIS guruh → talabalar ro'yxati
    hemis_groups: dict = {}
    for m in memberships:
        gname = m.student_snapshot.group_name or "Noma'lum"
        if gname not in hemis_groups:
            hemis_groups[gname] = {
                'group_name': gname,
                'faculty_name': m.student_snapshot.faculty_name,
                'count': 0,
                'students': []
            }
        hemis_groups[gname]['count'] += 1
        hemis_groups[gname]['students'].append({
            'snapshot_id': m.student_snapshot.id,
            'full_name': m.student_snapshot.full_name,
            'student_id': m.student_snapshot.student_id_number,
            'required_control_type': m.required_control_type,
        })

    # Mavjud enrollment larni tekshirish
    enrolled_user_ids = set()
    if group.lms_course:
        enrolled_user_ids = set(
            Enrollment.objects.filter(course=group.lms_course)
            .values_list('student_id', flat=True)
        )

    # Har talabaga "enrolled" flag qo'shish
    for g in hemis_groups.values():
        enrolled_in_group = 0
        for s in g['students']:
            try:
                from hemis.models import HemisStudentSnapshot
                snap = HemisStudentSnapshot.objects.get(id=s['snapshot_id'])
                user_id = snap.student_profile.user_id
                s['is_enrolled'] = user_id in enrolled_user_ids
                if s['is_enrolled']:
                    enrolled_in_group += 1
            except Exception:
                s['is_enrolled'] = False
        g['enrolled_count'] = enrolled_in_group
        g['all_enrolled'] = enrolled_in_group == g['count']

    if request.method == 'GET':
        return JsonResponse({
            'group': {
                'id': group.id,
                'code': group.code,
                'subject_name': group.subject_snapshot.subject_name,
                'semester_name': group.subject_snapshot.semester_name,
                'teacher': group.teacher_profile.full_name if group.teacher_profile else None,
                'lms_course': {
                    'id': group.lms_course.id,
                    'title': group.lms_course.title,
                    'total_enrolled': len(enrolled_user_ids),
                } if group.lms_course else None,
            },
            'hemis_groups': list(hemis_groups.values()),
            'total_members': memberships.count(),
            'total_enrolled': len(enrolled_user_ids),
        })

    # POST — biriktirish
    data = json.loads(request.body)
    action = data.get('action', 'enroll')  # 'enroll' | 'create_course'
    selected_hemis_groups = data.get('hemis_groups', None)  # None → barchasi

    if action == 'create_course':
        # Yangi kurs yaratish va biriktirish
        if group.lms_course:
            return JsonResponse({
                'error': f"Kurs allaqachon mavjud: {group.lms_course.title}"
            }, status=400)
        
        result = sync_retake_group_to_lms(
            group,
            student_group_names=selected_hemis_groups,
            enrolled_by=request.user
        )
        if result:
            return JsonResponse({
                'success': True,
                'action': 'created',
                'course_id': result['course'].id,
                'course_title': result['course'].title,
                'enrolled': result['enrolled'],
                'skipped': result['skipped'],
                'message': f"Kurs yaratildi. {result['enrolled']} ta talaba biriktirildi."
            })
        return JsonResponse({'error': 'Kurs yaratishda xatolik'}, status=500)

    elif action == 'enroll':
        # Mavjud kursga talabalar qo'shish
        if not group.lms_course:
            return JsonResponse({
                'error': 'Avval kurs yaratilishi yoki tanlanishi kerak'
            }, status=400)

        result = sync_retake_group_to_lms(
            group,
            student_group_names=selected_hemis_groups,
            enrolled_by=request.user
        )
        if result:
            return JsonResponse({
                'success': True,
                'action': 'enrolled',
                'enrolled': result['enrolled'],
                'already_enrolled': result['already_enrolled'],
                'skipped': result['skipped'],
                'message': (
                    f"{result['enrolled']} ta yangi talaba biriktirildi. "
                    f"{result['already_enrolled']} ta allaqachon biriktirilgan edi."
                )
            })
        return JsonResponse({'error': 'Biriktirish xatolik'}, status=500)

    return JsonResponse({'error': 'Noto\'g\'ri action'}, status=400)
```

### 3.2 Yangi ExamSheet API — LMS completion bilan boyitilgan

```python
@login_required
def api_retake_exam_sheet_detail(request, sheet_id):
    """
    ExamSheet detali — LMS completion ma'lumotlari bilan.
    Mavjud retake/api_views.py dagi exam sheet view ni to'ldiradi.
    """
    from lms.models import Section, SectionCompletion, Enrollment
    
    sheet = get_object_or_404(ExamSheet, id=sheet_id)
    assessment = sheet.assessment_schedule
    group = assessment.group
    
    role = get_user_role(request.user, request.session)
    
    # Ruxsat tekshiruvi
    is_teacher = (
        role == Role.TEACHER and
        hasattr(request.user, 'teacher_profile') and (
            group.teacher_profile == request.user.teacher_profile or
            assessment.teacher_profile == request.user.teacher_profile
        )
    )
    is_admin = role in [Role.SUPER_ADMIN, Role.REGISTRATOR, Role.RET_DB_MANAGER]
    
    if not (is_teacher or is_admin):
        return JsonResponse({'error': 'Ruxsat yo\'q'}, status=403)

    entries = sheet.entries.select_related('student_snapshot').order_by('student_snapshot__full_name')
    
    # LMS course bog'langan bo'lsa — completion ma'lumotlarini olish
    lms_course = group.lms_course
    completion_data = {}
    total_sections = 0
    is_enrolled_set = set()
    
    if lms_course:
        total_sections = Section.objects.filter(
            course=lms_course, is_published=True
        ).count()
        
        enrolled_user_ids = set(
            Enrollment.objects.filter(course=lms_course)
            .values_list('student_id', flat=True)
        )
        
        for entry in entries:
            try:
                student_user = entry.student_snapshot.student_profile.user
                uid = student_user.id
                
                is_enrolled = uid in enrolled_user_ids
                if is_enrolled:
                    is_enrolled_set.add(uid)
                
                completed = SectionCompletion.objects.filter(
                    student_id=uid,
                    section__course=lms_course
                ).count()
                
                completion_data[entry.id] = {
                    'is_enrolled': is_enrolled,
                    'completed_sections': completed,
                    'total_sections': total_sections,
                    'completion_pct': round((completed / total_sections * 100) if total_sections > 0 else 0),
                    'is_finished': completed >= total_sections if total_sections > 0 else True,
                }
            except Exception:
                completion_data[entry.id] = {
                    'is_enrolled': False,
                    'completed_sections': 0,
                    'total_sections': total_sections,
                    'completion_pct': 0,
                    'is_finished': False,
                }

    # Config dan max_score
    from ..models import RetakeAssessmentConfig
    config = RetakeAssessmentConfig.objects.filter(
        control_type=assessment.control_type
    ).first()
    max_score = float(config.max_score) if config else 100.0

    # Boshqa nazorat turlari baholarini olish (JN, ON ko'rsatish uchun)
    membership_ids = entries.values_list('group_membership_id', flat=True)
    other_entries = ExamSheetEntry.objects.filter(
        group_membership_id__in=membership_ids
    ).exclude(sheet=sheet).select_related('sheet__assessment_schedule')

    cross_map = {}
    for e in other_entries:
        mid = e.group_membership_id
        ct = e.sheet.assessment_schedule.control_type
        if mid not in cross_map:
            cross_map[mid] = {}
        if ct not in cross_map[mid]:
            cross_map[mid][ct] = 0
        cross_map[mid][ct] += float(e.score or 0)

    entries_data = []
    for entry in entries:
        comp = completion_data.get(entry.id, {})
        membership_id = entry.group_membership_id
        entries_data.append({
            'id': entry.id,
            'full_name': entry.student_snapshot.full_name,
            'student_id_number': entry.student_snapshot.student_id_number,
            'group_name': entry.student_snapshot.group_name,
            'faculty_name': entry.student_snapshot.faculty_name,
            'score': float(entry.score) if entry.score is not None else None,
            'is_absent': entry.is_absent,
            'comment': entry.comment,
            # LMS completion
            'lms': comp,
            # Boshqa nazoratlar
            'cross_scores': cross_map.get(membership_id, {}),
        })

    stats = {
        'total': len(entries_data),
        'graded': sum(1 for e in entries_data if e['score'] is not None),
        'absent': sum(1 for e in entries_data if e['is_absent']),
        'present': sum(1 for e in entries_data if not e['is_absent']),
        'lms_enrolled': len(is_enrolled_set),
        'lms_finished': sum(1 for c in completion_data.values() if c.get('is_finished')),
    }

    can_edit = sheet.status in [ExamSheetStatus.OPEN, ExamSheetStatus.SUBMITTED]
    can_unlock = (
        sheet.status == ExamSheetStatus.LOCKED and
        role in [Role.SUPER_ADMIN, Role.REGISTRATOR, Role.RET_DB_MANAGER]
    )

    return JsonResponse({
        'sheet': {
            'id': sheet.id,
            'sheet_no': sheet.sheet_no,
            'status': sheet.status,
            'status_label': sheet.get_status_display() if hasattr(sheet, 'get_status_display') else sheet.status,
            'student_group_name': assessment.student_group_name,
            'control_type': assessment.control_type,
            'control_type_label': assessment.control_type_label,
            'scheduled_at': assessment.scheduled_at.isoformat(),
            'room': assessment.room,
            'max_score': max_score,
            'can_edit': can_edit,
            'can_unlock': can_unlock,
        },
        'group': {
            'id': group.id,
            'code': group.code,
            'subject_name': group.subject_snapshot.subject_name,
            'cycle_name': group.cycle.name,
        },
        'lms': {
            'course_id': lms_course.id if lms_course else None,
            'course_title': lms_course.title if lms_course else None,
            'total_sections': total_sections,
            'has_course': bool(lms_course),
        },
        'entries': entries_data,
        'stats': stats,
        'warnings': [
            f"{stats['lms_finished']} / {stats['total']} talaba kursni tugatgan"
        ] if lms_course and stats['lms_finished'] < stats['total'] else []
    })
```

### 3.3 ExamSheet saqlash (POST) — completion tekshiruvi bilan

```python
@login_required
@require_http_methods(["POST"])
def api_save_exam_sheet(request, sheet_id):
    """
    ExamSheet ga baho kiritish, saqlash, topshirish, bloklash.
    """
    sheet = get_object_or_404(ExamSheet, id=sheet_id)
    role = get_user_role(request.user, request.session)

    # ... (ruxsat tekshiruvi yuqoridek)

    if sheet.status == ExamSheetStatus.LOCKED and not can_unlock:
        return JsonResponse({'error': 'Qaydnoma bloklangan'}, status=400)

    data = json.loads(request.body)
    action = data.get('action', 'save')
    entries_data = data.get('entries', [])

    with transaction.atomic():
        # 1. Baholarni saqlash
        if action in ['save', 'submit']:
            for ed in entries_data:
                entry = get_object_or_404(ExamSheetEntry, id=ed['id'], sheet=sheet)
                
                score_val = ed.get('score')
                is_absent = ed.get('is_absent', False)
                force_grade = ed.get('force_grade', False)  # LMS tugamagan bo'lsa override
                
                # LMS completion tekshiruvi (faqat yakuniy va oraliq nazorat uchun)
                assessment = sheet.assessment_schedule
                group = assessment.group
                lms_course = group.lms_course
                
                if (lms_course and score_val is not None and not is_absent and
                    assessment.control_type in ['final', 'midterm', '1-on', '2-on'] and
                    not force_grade):
                    try:
                        from lms.models import Section, SectionCompletion
                        student_user = entry.student_snapshot.student_profile.user
                        total = Section.objects.filter(
                            course=lms_course, is_published=True
                        ).count()
                        completed = SectionCompletion.objects.filter(
                            student=student_user, section__course=lms_course
                        ).count()
                        
                        if total > 0 and completed < total:
                            # Ogohlantirish qaytarish (bloklash emas)
                            # force_grade=true bilan qayta yuborilsa — qabul qilinadi
                            entry.comment = f"[OGOHLANTIRISH: kurs {completed}/{total} tugatilgan] " + (ed.get('comment', ''))
                    except Exception:
                        pass
                
                entry.score = score_val
                entry.is_absent = is_absent
                entry.comment = ed.get('comment', entry.comment)
                entry.entered_by = request.user
                entry.entered_at = timezone.now()
                entry.save()

        # 2. Status o'zgartirish
        if action == 'submit':
            sheet.status = ExamSheetStatus.SUBMITTED
            sheet.submitted_at = timezone.now()
            sheet.save()
            WorkflowEvent.objects.create(
                entity_type='ExamSheet', object_id=sheet.id,
                action='submitted',
                from_status=ExamSheetStatus.OPEN,
                to_status=ExamSheetStatus.SUBMITTED,
                actor=request.user
            )

        elif action == 'lock':
            if role not in [Role.SUPER_ADMIN, Role.REGISTRATOR, Role.RET_DB_MANAGER]:
                return JsonResponse({'error': 'Bloklash ruxsati yo\'q'}, status=403)
            
            sheet.status = ExamSheetStatus.LOCKED
            sheet.locked_at = timezone.now()
            sheet.save()
            
            # Item statuslarini COMPLETED ga o'tkazish
            for e in sheet.entries.select_related('group_membership__application_item'):
                try:
                    item = e.group_membership.application_item
                    item.status = RetakeItemStatus.COMPLETED
                    item.save(update_fields=['status'])
                except Exception:
                    pass
            
            WorkflowEvent.objects.create(
                entity_type='ExamSheet', object_id=sheet.id,
                action='locked',
                from_status=ExamSheetStatus.SUBMITTED,
                to_status=ExamSheetStatus.LOCKED,
                actor=request.user
            )

        elif action == 'unlock':
            if not can_unlock:
                return JsonResponse({'error': 'Ochish ruxsati yo\'q'}, status=403)
            sheet.status = ExamSheetStatus.OPEN
            sheet.save()
            WorkflowEvent.objects.create(
                entity_type='ExamSheet', object_id=sheet.id,
                action='unlocked',
                from_status=ExamSheetStatus.LOCKED,
                to_status=ExamSheetStatus.OPEN,
                actor=request.user
            )

    return JsonResponse({'success': True, 'status': sheet.status})
```

---

## 4-QADAM: URL ROUTING

**Fayl:** `retake/urls.py` ga qo'shish

```python
# Teacher enrollment API
path('api/groups/<int:group_id>/enrollment/', api_views.api_teacher_course_enrollment, name='api_teacher_course_enrollment'),

# ExamSheet API (mavjud django view ni SPA API bilan almashtiramiz)
path('api/exam-sheets/<int:sheet_id>/', api_views.api_retake_exam_sheet_detail, name='api_retake_exam_sheet_detail'),
path('api/exam-sheets/<int:sheet_id>/save/', api_views.api_save_exam_sheet, name='api_save_exam_sheet'),
```

---

## 5-QADAM: `RetakeTeacherGroupsPage.tsx` YANGILASH

### Qo'shiladigan: "Talabalarni kursga biriktirish" tugmasi va modali

```tsx
// design/src/pages/RetakeTeacherGroupsPage.tsx

// Mavjud sahifaga quyidagi qismlarni qo'shing:

// 1. State
const [enrollmentModal, setEnrollmentModal] = useState<{
  groupId: number;
  groupCode: string;
  subjectName: string;
} | null>(null);

// 2. Har guruh kartasida qo'shimcha tugma (item.group.id ishlatiladi):
<div className="mt-4 flex flex-wrap gap-3">
  {/* Mavjud qaydnoma tugmasi */}
  {item.sheet && (
    <Link to={`/retake/exam-sheets/${item.sheet.id}`}
      className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white">
      <FileSpreadsheet size={16} />
      Qaydnoma ochish
    </Link>
  )}
  
  {/* YANGI: Talabalarni kursga biriktirish */}
  <button
    onClick={() => setEnrollmentModal({
      groupId: item.group.id,
      groupCode: item.group.code,
      subjectName: item.group.subject_name
    })}
    className="inline-flex items-center gap-2 rounded-2xl border border-primary px-4 py-3 text-sm font-bold text-primary hover:bg-primary/5"
  >
    <UserPlus size={16} />
    {item.group.lms_course_title ? 'Kurs: ' + item.group.lms_course_title : 'LMS kurs yaratish'}
  </button>
</div>

// 3. Enrollment modal komponenti (sahifa pastida):
{enrollmentModal && (
  <EnrollmentModal
    groupId={enrollmentModal.groupId}
    groupCode={enrollmentModal.groupCode}
    subjectName={enrollmentModal.subjectName}
    onClose={() => setEnrollmentModal(null)}
    onSuccess={() => { setEnrollmentModal(null); void loadTeacherGroups(); }}
  />
)}
```

---

## 6-QADAM: `EnrollmentModal` komponenti (yangi fayl)

**Fayl:** `design/src/components/retake/EnrollmentModal.tsx`

```tsx
import { useEffect, useState } from 'react';
import { X, UserPlus, Users, CheckCircle2, AlertCircle, Loader } from 'lucide-react';

interface Props {
  groupId: number;
  groupCode: string;
  subjectName: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface HemisGroupInfo {
  group_name: string;
  faculty_name: string;
  count: number;
  enrolled_count: number;
  all_enrolled: boolean;
  students: Array<{
    full_name: string;
    student_id: string;
    is_enrolled: boolean;
    required_control_type: string;
  }>;
}

export default function EnrollmentModal({ groupId, groupCode, subjectName, onClose, onSuccess }: Props) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    void loadEnrollmentData();
  }, [groupId]);

  async function loadEnrollmentData() {
    setIsLoading(true);
    try {
      const res = await fetch(`/retake/api/groups/${groupId}/enrollment/`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      const json = await res.json();
      setData(json);
      
      // Hali biriktirilmagan guruhlarni avtomatik tanlash
      const notEnrolled = new Set<string>(
        (json.hemis_groups as HemisGroupInfo[])
          .filter(g => !g.all_enrolled)
          .map(g => g.group_name)
      );
      setSelected(notEnrolled);
    } catch {
      setMessage({ type: 'error', text: 'Ma\'lumot yuklanmadi' });
    } finally {
      setIsLoading(false);
    }
  }

  function toggleGroup(groupName: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set((data?.hemis_groups as HemisGroupInfo[] ?? []).map(g => g.group_name)));
  }

  async function handleAction(action: 'create_course' | 'enroll') {
    if (selected.size === 0) {
      setMessage({ type: 'error', text: 'Kamida bitta HEMIS guruh tanlansin' });
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/retake/api/groups/${groupId}/enrollment/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken') ?? ''
        },
        body: JSON.stringify({
          action,
          hemis_groups: Array.from(selected)
        })
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: json.message });
        await loadEnrollmentData();
        setTimeout(onSuccess, 1500);
      } else {
        setMessage({ type: 'error', text: json.error ?? 'Xatolik' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Server xatoligi' });
    } finally {
      setIsSaving(false);
    }
  }

  const hasCourse = Boolean(data?.group?.lms_course);
  const hemisGroups: HemisGroupInfo[] = data?.hemis_groups ?? [];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-border">
          <div>
            <h2 className="text-xl font-black text-text-primary">LMS Kursga Biriktirish</h2>
            <p className="text-sm text-text-muted mt-0.5">{subjectName} • {groupCode}</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100 transition-colors">
            <X size={20} className="text-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-text-muted">
              <Loader className="animate-spin" size={20} />
              Yuklanmoqda...
            </div>
          ) : (
            <>
              {/* Kurs holati */}
              {hasCourse ? (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span className="font-bold text-emerald-800 text-sm">
                      LMS Kurs: {data.group.lms_course.title}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-700 mt-1">
                    {data.group.lms_course.total_enrolled} ta talaba allaqachon biriktirilgan
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-amber-600" />
                    <span className="font-bold text-amber-800 text-sm">
                      LMS kurs hali yaratilmagan
                    </span>
                  </div>
                  <p className="text-xs text-amber-700 mt-1">
                    Talabalarni biriktirish uchun avval kurs yaratiladi
                  </p>
                </div>
              )}

              {/* HEMIS guruhlar jadvali */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-black text-text-primary">HEMIS Guruhlar</h3>
                  <button onClick={selectAll}
                    className="text-xs font-bold text-primary hover:underline">
                    Barchasini tanlash
                  </button>
                </div>
                
                <div className="space-y-2">
                  {hemisGroups.map(hg => (
                    <label
                      key={hg.group_name}
                      className={`flex items-center gap-4 rounded-2xl border px-4 py-4 cursor-pointer transition-colors ${
                        selected.has(hg.group_name)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(hg.group_name)}
                        onChange={() => toggleGroup(hg.group_name)}
                        className="w-4 h-4 accent-primary"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-text-primary">{hg.group_name}</span>
                          <div className="flex items-center gap-2">
                            {hg.all_enrolled ? (
                              <span className="text-xs font-bold text-emerald-600">
                                ✓ Barchasi biriktirilgan
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-amber-600">
                                {hg.enrolled_count}/{hg.count} biriktirilgan
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-text-muted mt-0.5">
                          {hg.faculty_name} • {hg.count} ta talaba
                        </p>
                        
                        {/* Progress bar */}
                        <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              hg.all_enrolled ? 'bg-emerald-500' : 'bg-amber-400'
                            }`}
                            style={{ width: `${(hg.enrolled_count / hg.count) * 100}%` }}
                          />
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Xabar */}
              {message && (
                <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${
                  message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-danger/10 text-danger border border-danger/20'
                }`}>
                  {message.text}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex gap-3 px-8 py-6 border-t border-border bg-slate-50/50">
          <button onClick={onClose}
            className="flex-1 rounded-2xl border border-border py-3 text-sm font-bold text-text-primary hover:bg-slate-100">
            Yopish
          </button>
          
          {!isLoading && (
            hasCourse ? (
              <button
                disabled={isSaving || selected.size === 0}
                onClick={() => void handleAction('enroll')}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {isSaving ? <Loader size={16} className="animate-spin" /> : <UserPlus size={16} />}
                {isSaving ? 'Biriktirilmoqda...' : 'Talabalarni biriktirish'}
              </button>
            ) : (
              <button
                disabled={isSaving || selected.size === 0}
                onClick={() => void handleAction('create_course')}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {isSaving ? <Loader size={16} className="animate-spin" /> : <Users size={16} />}
                {isSaving ? 'Yaratilmoqda...' : 'Kurs yaratish va biriktirish'}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()!.split(';').shift() ?? null;
  return null;
}
```

---

## 7-QADAM: `RetakeExamSheetPage.tsx` YANGILASH — LMS completion ko'rinishi

### Talabalar jadvaliga qo'shiladigan ustun:

```tsx
// Har bir entry qatorida (mavjud jadval ustunlariga qo'shish):

// thead ga:
<th className="px-4 py-4 text-center">LMS</th>

// tbody da har bir entry uchun:
<td className="px-4 py-4 text-center">
  {data?.lms?.has_course ? (
    entry.lms?.is_enrolled ? (
      <div className="flex flex-col items-center gap-1">
        {/* Progress circle yoki progress bar */}
        <div className="relative w-10 h-10">
          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="16" fill="none" stroke="#e2e8f0" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="16" fill="none"
              stroke={entry.lms.is_finished ? '#10b981' : '#f59e0b'}
              strokeWidth="3"
              strokeDasharray={`${entry.lms.completion_pct} ${100 - entry.lms.completion_pct}`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black">
            {entry.lms.completion_pct}%
          </span>
        </div>
        <span className={`text-[10px] font-bold ${
          entry.lms.is_finished ? 'text-emerald-600' : 'text-amber-600'
        }`}>
          {entry.lms.completed_sections}/{entry.lms.total_sections}
        </span>
      </div>
    ) : (
      <div className="text-center">
        <span className="text-xs font-bold text-danger">Kursda yo'q</span>
      </div>
    )
  ) : (
    <span className="text-slate-300 text-sm">—</span>
  )}
</td>

// Ball kiritish inputi yonida ogohlantirish:
<td className="px-4 py-4">
  <div className="space-y-1">
    <input
      type="number"
      step="0.01"
      min="0"
      max={data?.sheet.max_score}
      disabled={!data?.sheet.can_edit || draft[entry.id]?.is_absent}
      value={draft[entry.id]?.score || ''}
      onChange={(e) => setDraft(prev => ({
        ...prev,
        [entry.id]: { ...prev[entry.id], score: e.target.value }
      }))}
      className={`w-28 rounded-2xl border px-3 py-2 font-bold text-text-primary outline-none focus:border-primary/30 disabled:bg-slate-100 ${
        data?.lms?.has_course && !entry.lms?.is_finished && draft[entry.id]?.score
          ? 'border-amber-400 bg-amber-50/50'
          : 'border-border bg-white'
      }`}
    />
    {/* LMS ogohlantirish */}
    {data?.lms?.has_course && !entry.lms?.is_finished && draft[entry.id]?.score && (
      <p className="text-[10px] text-amber-600 font-bold">
        ⚠ Kurs tugatilmagan
      </p>
    )}
  </div>
</td>
```

### Dashboard stats kartasida LMS holati:

```tsx
// Mavjud summary kartalardan keyin:
{data?.lms?.has_course && (
  <section className="card p-5 flex items-center justify-between">
    <div>
      <p className="label-micro">LMS holati</p>
      <p className="mt-2 text-2xl font-black text-text-primary">
        {data.stats.lms_finished}/{data.stats.total}
      </p>
      <p className="text-xs text-text-muted">kurs tugatgan</p>
    </div>
    <div className="text-right">
      <p className="text-sm font-bold text-text-secondary">{data.lms.course_title}</p>
      <p className="text-xs text-text-muted mt-1">
        {data.stats.lms_enrolled} biriktirilgan
      </p>
      <a
        href={`/lms/courses/${data.lms.course_id}/`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-primary hover:underline"
      >
        Kursga o'tish →
      </a>
    </div>
  </section>
)}
```

---

## 8-QADAM: API TYPES YANGILASH

**Fayl:** `design/src/types/retake.ts`

```typescript
// ExamSheet entry uchun LMS ma'lumotlari
export interface RetakeExamSheetEntryLMS {
  is_enrolled: boolean;
  completed_sections: number;
  total_sections: number;
  completion_pct: number;
  is_finished: boolean;
}

export interface RetakeExamSheetEntry {
  id: number;
  full_name: string;
  student_id_number: string;
  group_name: string;
  faculty_name: string;
  score: number | null;
  is_absent: boolean;
  comment: string;
  lms: RetakeExamSheetEntryLMS;
  cross_scores: Record<string, number>;
  completion: {  // mavjud field — LMS dan farq
    completed: number;
    total: number;
    is_finished: boolean;
  };
}

// Enrollment modal uchun
export interface RetakeEnrollmentData {
  group: {
    id: number;
    code: string;
    subject_name: string;
    semester_name: string;
    teacher: string | null;
    lms_course: {
      id: number;
      title: string;
      total_enrolled: number;
    } | null;
  };
  hemis_groups: Array<{
    group_name: string;
    faculty_name: string;
    count: number;
    enrolled_count: number;
    all_enrolled: boolean;
    students: Array<{
      full_name: string;
      student_id: string;
      is_enrolled: boolean;
      required_control_type: string;
    }>;
  }>;
  total_members: number;
  total_enrolled: number;
}
```

---

## 9-QADAM: IMPLEMENTATSIYA TARTIBI

```
1. makemigrations + migrate
   → RetakeCourseEnrollmentLog modeli

2. lms_integration_utils.py → sync_retake_group_to_lms yangilash
   (student_group_names parametri, log yaratish)

3. api_views.py ga qo'shish:
   → api_teacher_course_enrollment (GET + POST)
   → api_retake_exam_sheet_detail (LMS completion bilan)
   → api_save_exam_sheet (force_grade support bilan)

4. urls.py yangilash (enrollment + exam-sheet API)

5. EnrollmentModal.tsx yaratish

6. RetakeTeacherGroupsPage.tsx yangilash
   → EnrollmentModal import + state
   → Har guruh kartasiga "LMS kursga biriktirish" tugmasi

7. RetakeExamSheetPage.tsx yangilash
   → LMS ustun jadvalga
   → Completion progress circle
   → LMS stats kartasi
   → force_grade support (ogohlantirish bilan ball kiritish)

8. Types yangilash
```

---

## Xulosa: Qoidalar

```
FAQAT o'qituvchiga tegishli fan guruhi talabalari biriktiriladi
   → group.teacher_profile == request.user.teacher_profile tekshiruvi

HEMIS guruhlar bo'yicha tanlash imkoniyati
   → O'qituvchi MT-21-1 ni alohida, KI-22-3 ni alohida yoki barchasini biriktiradi

Kurs yaratish faqat bir marta
   → group.lms_course mavjud bo'lsa "Enrollment qo'shish" rejimiga o'tadi

LMS completion tekshiruvi — bloklash emas, ogohlantirish
   → force_grade=true bilan o'qituvchi override qila oladi
   → ExamSheet da "⚠ Kurs tugatilmagan" ko'rinadi

Baholash va enrollment mustaqil
   → Kurs bo'lmasa — ball erkin kiritiladi
   → Kurs bo'lsa — completion ko'rinadi, lekin mandatory emas
```
