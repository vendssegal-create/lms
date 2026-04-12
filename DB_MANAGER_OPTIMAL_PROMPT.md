# DB Manager Tizimini Optimallashtirish — To'liq Fullstack Prompt

## Muammo: Hozirgi holat nima noto'g'ri

```
Hozir DB Manager ko'radigan sahifalar:
  ├── RetakeManageGroupsPage     → guruh CRUD (teacher, status, capacity)
  ├── RetakeSchedulesPage        ← REDUNDANT: group detail bilan bir xil, lekin noto'g'ri
  ├── RetakeExamCalendarPage     ← REDUNDANT: group detail da ko'rinadi
  ├── RetakeExamSheetPage        ✅ to'g'ri (bor)
  └── RetakeDashboard            ← mock data (real emas)

Muammo 1: AssessmentSchedule da student_group_name yo'q
           → Bir fan guruhidagi BARCHA talabalar bitta varaqda

Muammo 2: DB Manager o'ziga tayinlanmagan fakultetlarni ham ko'radi
           → DBManagerFacultyAssignment modeli yo'q

Muammo 3: open_assessment_sheet view hamma a'zolarni bir joyga yig'adi
           → HEMIS guruh bo'yicha bo'lish yo'q

Muammo 4: RetakeSchedulesPage va RetakeExamCalendarPage redundant
           → Ularni o'chiring, Group Detail ga tabing
```

---

## Yakuniy Maqsad

```
DB Manager (RET_DB_MANAGER) ko'radigan optimal tizim:

Dashboard → Fan Guruhlari → Guruh Detail → Nazorat Jadvali → Qaydnoma

  1. Dashboard: faqat o'z fakultetlari statistikasi
  2. Fan Guruhlari: faqat o'z fakultetlaridagi guruhlar + auto-grouping
  3. Guruh Detail (3 tab):
       [A'zolar]       → HEMIS guruh bo'yicha accordion
       [Nazorat jadvali] → har HEMIS guruh uchun alohida nazorat
       [Qaydnomalar]   → har nazorat uchun qaydnoma holati
  4. Qaydnomalar: o'z fakultetlaridagi barcha qaydnomalar ro'yxati

Admin ko'radigan qo'shimcha:
  - MB menejerlarga fakultet tayinlash
  - Nazorat konfiguratsiya
  - Tsikllar boshqaruvi
```

---

## 1-QADAM: YANGI MODEL — `DBManagerFacultyAssignment`

**Fayl:** `retake/models.py` ga qo'shish

```python
class DBManagerFacultyAssignment(models.Model):
    """
    Super admin yoki Registrator DB Manager foydalanuvchiga
    qaysi fakultetlarni boshqarish huquqini beradi.
    """
    db_manager_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='db_manager_faculty_assignments',
        limit_choices_to={'role': 'RET_DB_MANAGER'}
    )
    faculty_name = models.CharField(
        max_length=255,
        help_text="HemisStudentSnapshot.faculty_name bilan mos kelishi kerak"
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_db_manager_faculties'
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['db_manager_user', 'faculty_name']
        verbose_name = "MB Menejeri Fakultet Biriktiruvi"
        verbose_name_plural = "MB Menejerlari Fakultet Biriktiruvi"

    def __str__(self):
        return f"{self.db_manager_user.get_full_name()} → {self.faculty_name}"
```

---

## 2-QADAM: `AssessmentSchedule` MODELINI YANGILASH

**Fayl:** `retake/models.py` ichidagi `AssessmentSchedule` ga `student_group_name` qo'shish

```python
class AssessmentSchedule(models.Model):
    group = models.ForeignKey(RetakeSubjectGroup, on_delete=models.CASCADE, related_name='assessment_schedules')
    
    # YANGI ← HEMIS talabalar guruhi nomi (masalan: "MT-21-1", "KI-22-3")
    student_group_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="HEMIS talabalar guruhi. Bo'sh bo'lsa — bu guruhning barcha talabalari uchun."
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
        # Bir HEMIS guruh + fan guruhi + nazorat turi kombinatsiyasi unikal bo'lsin
        unique_together = [('group', 'student_group_name', 'control_type')]
    
    CONTROL_TYPE_LABELS = {
        'final': 'Yakuniy nazorat',
        '1-jn': '1-joriy nazorat',
        '2-jn': '2-joriy nazorat',
        '1-on': '1-oraliq nazorat',
        '2-on': '2-oraliq nazorat',
        'current': 'Joriy nazorat',
        'midterm': 'Oraliq nazorat',
    }
    
    @property
    def control_type_label(self):
        return self.CONTROL_TYPE_LABELS.get(self.control_type, self.control_type)
```

**Migration:**
```bash
python manage.py makemigrations retake --name="db_manager_faculty_assignment_and_assessment_student_group"
python manage.py migrate
```

---

## 3-QADAM: YORDAMCHI FUNKSIYA — DB Manager uchun fakultet filtr

**Fayl:** `retake/utils/db_manager_utils.py` (yangi fayl)

```python
from ..models import DBManagerFacultyAssignment
from users.utils.roles import Role, get_user_role

def get_db_manager_faculties(user, session=None):
    """
    DB Manager uchun tayinlangan fakultetlar ro'yxatini qaytaradi.
    Super Admin / Registrator bo'lsa — None (hammasi ko'rinadi).
    """
    from users.utils.roles import get_user_role
    role = get_user_role(user, session)
    
    if role in [Role.SUPER_ADMIN, Role.REGISTRATOR]:
        return None  # Filtr yo'q — hammasi ko'rinadi
    
    if role == Role.RET_DB_MANAGER:
        assigned = DBManagerFacultyAssignment.objects.filter(
            db_manager_user=user
        ).values_list('faculty_name', flat=True)
        return list(assigned)  # Bo'sh bo'lsa — hech narsa ko'rinmaydi
    
    return []  # Boshqa rollar uchun — bo'sh


def filter_memberships_by_faculty(queryset, user, session=None):
    """
    RetakeGroupMembership queryset ni DB Manager uchun filtrlaydi.
    """
    faculties = get_db_manager_faculties(user, session)
    if faculties is None:
        return queryset  # Filtr yo'q
    if not faculties:
        return queryset.none()
    return queryset.filter(student_snapshot__faculty_name__in=faculties)


def filter_groups_by_faculty(queryset, user, session=None):
    """
    RetakeSubjectGroup queryset ni DB Manager uchun filtrlaydi.
    Guruh ichidagi a'zolardan birortasi DB Manager fakultetiga tegishli bo'lsa — ko'rinadi.
    """
    faculties = get_db_manager_faculties(user, session)
    if faculties is None:
        return queryset
    if not faculties:
        return queryset.none()
    return queryset.filter(
        memberships__student_snapshot__faculty_name__in=faculties
    ).distinct()
```

---

## 4-QADAM: YANGILANGAN `groups.py` VIEW LARI

**Fayl:** `retake/views/groups.py`

### 4.1 `manage_groups` — fakultet filtri bilan

```python
@login_required
def manage_groups(request):
    role = get_user_role(request.user, request.session)
    if role not in [Role.SUPER_ADMIN, Role.REGISTRATOR, Role.RET_DB_MANAGER]:
        return redirect('lms:portal')
    
    from ..utils.db_manager_utils import get_db_manager_faculties, filter_groups_by_faculty
    
    cycle = RetakeCycle.objects.filter(status=RetakeCycleStatus.OPEN).first()
    groups_qs = RetakeSubjectGroup.objects.filter(cycle=cycle) if cycle else RetakeSubjectGroup.objects.none()
    
    # DB Manager uchun fakultet filtr
    groups = filter_groups_by_faculty(groups_qs, request.user, request.session).select_related(
        'subject_snapshot', 'teacher_profile'
    )
    
    # Faqat DB Manager ning fakultetlaridagi APPROVED_FOR_GROUPING itemlar
    pending_items_qs = RetakeApplicationItem.objects.filter(status=RetakeItemStatus.APPROVED_FOR_GROUPING)
    faculties = get_db_manager_faculties(request.user, request.session)
    if faculties is not None:
        pending_items_qs = pending_items_qs.filter(
            application__student_snapshot__faculty_name__in=faculties
        )
    
    subjects_needing_groups = pending_items_qs.values('subject_snapshot_id').annotate(count=Count('id'))
    subject_ids = [s['subject_snapshot_id'] for s in subjects_needing_groups]
    subject_names = {s.id: s.subject_name for s in HemisSubjectSnapshot.objects.filter(id__in=subject_ids)}
    teachers = TeacherProfile.objects.all().order_by('full_name')
    
    # DB Manager ning tayinlangan fakultetlari
    assigned_faculties = faculties if faculties is not None else []
    
    context = {
        "groups": groups,
        "subjects_needing_groups": subjects_needing_groups,
        "subject_names": subject_names,
        "cycle": cycle,
        "teachers": teachers,
        "assigned_faculties": assigned_faculties,
    }
    return render(request, "retake/groups.html", context)
```

### 4.2 `create_assessment` — TO'G'RILASH (`student_group_name` bilan)

```python
@login_required
def create_assessment(request, group_id):
    """
    Bitta HEMIS guruh uchun bitta nazorat va avtomatik ExamSheet yaratish.
    """
    if request.method != "POST":
        return redirect('retake:retake_group_detail', group_id=group_id)
    
    role = get_user_role(request.user, request.session)
    if role not in [Role.SUPER_ADMIN, Role.REGISTRATOR, Role.RET_DB_MANAGER, Role.RET_REGISTRATOR]:
        return redirect('lms:portal')
    
    group = get_object_or_404(RetakeSubjectGroup, id=group_id)
    
    student_group_name = request.POST.get("student_group_name", "").strip()
    control_type = request.POST.get("control_type", "").strip()
    scheduled_at_str = request.POST.get("scheduled_at", "")
    room = request.POST.get("room", "").strip()
    pair_number = request.POST.get("pair_number")
    teacher_id = request.POST.get("teacher_id")
    
    if not control_type or not scheduled_at_str:
        messages.error(request, "Nazorat turi va sana kiritilishi shart.")
        return redirect('retake:retake_group_detail', group_id=group_id)
    
    # Duplicate check
    if AssessmentSchedule.objects.filter(
        group=group, student_group_name=student_group_name, control_type=control_type
    ).exists():
        messages.error(request, f"'{student_group_name}' guruhi uchun '{control_type}' nazorati allaqachon mavjud.")
        return redirect('retake:retake_group_detail', group_id=group_id)
    
    try:
        from datetime import datetime as dt
        scheduled_at = dt.fromisoformat(scheduled_at_str)
    except ValueError:
        messages.error(request, "Sana formati noto'g'ri.")
        return redirect('retake:retake_group_detail', group_id=group_id)
    
    teacher_profile = TeacherProfile.objects.filter(id=teacher_id).first() if teacher_id else group.teacher_profile
    
    from django.db import transaction
    with transaction.atomic():
        # 1. AssessmentSchedule
        assessment = AssessmentSchedule.objects.create(
            group=group,
            student_group_name=student_group_name,
            control_type=control_type,
            scheduled_at=scheduled_at,
            room=room,
            pair_number=int(pair_number) if pair_number else None,
            teacher_profile=teacher_profile,
            created_by=request.user,
            status=AssessmentScheduleStatus.OPEN
        )
        
        # 2. ExamSheet — avtomatik yaratish
        year = scheduled_at.year
        last = ExamSheet.objects.filter(sheet_no__startswith=f"ES-{year}-").order_by('-id').first()
        next_num = int(last.sheet_no.split('-')[-1]) + 1 if last else 1
        sheet_no = f"ES-{year}-{str(next_num).zfill(4)}"
        
        sheet = ExamSheet.objects.create(
            assessment_schedule=assessment,
            sheet_no=sheet_no,
            status=ExamSheetStatus.OPEN,
            opened_at=timezone.now()
        )
        
        # 3. ExamSheetEntry — faqat shu HEMIS guruhdagi va shu nazorat turini kutayotganlar
        memberships_qs = group.memberships.select_related('student_snapshot')
        if student_group_name:
            memberships_qs = memberships_qs.filter(student_snapshot__group_name=student_group_name)
        # required_control_type filtr: "other" bo'lsa hammani kiritamiz
        if control_type and control_type != 'other':
            memberships_qs = memberships_qs.filter(required_control_type=control_type)
        
        entry_count = 0
        for membership in memberships_qs:
            ExamSheetEntry.objects.create(
                sheet=sheet,
                group_membership=membership,
                student_snapshot=membership.student_snapshot
            )
            entry_count += 1
        
        # 4. WorkflowEvent
        from ..models import WorkflowEvent
        WorkflowEvent.objects.create(
            entity_type='ExamSheet', object_id=sheet.id,
            action='created', from_status='', to_status=ExamSheetStatus.OPEN,
            actor=request.user,
            comment=f"'{student_group_name}' guruhi uchun '{assessment.control_type_label}' nazorati. {entry_count} talaba."
        )
    
    messages.success(request, f"Nazorat va qaydnoma yaratildi. #{sheet_no} — {entry_count} ta talaba.")
    return redirect('retake:retake_group_detail', group_id=group_id)
```

---

## 5-QADAM: ADMIN PANEL — Fakultet Tayinlash

**Fayl:** `retake/views/admin_control.py` ga qo'shish

```python
@login_required
def manage_db_manager_faculties(request):
    """
    Super Admin / Registrator → DB Manager foydalanuvchilarga fakultet tayinlash.
    """
    role = get_user_role(request.user, request.session)
    if role not in [Role.SUPER_ADMIN, Role.REGISTRATOR]:
        return redirect('retake:retake_dashboard')
    
    from users.models import User
    from ..models import DBManagerFacultyAssignment
    from hemis.models import HemisStudentSnapshot
    
    db_managers = User.objects.filter(role='RET_DB_MANAGER').order_by('first_name', 'last_name')
    
    # Barcha mavjud fakultetlar (HEMIS dan)
    all_faculties = list(
        HemisStudentSnapshot.objects.values_list('faculty_name', flat=True)
        .exclude(faculty_name='').distinct().order_by('faculty_name')
    )
    
    if request.method == "POST":
        action = request.POST.get("action")
        
        if action == "assign":
            user_id = request.POST.get("user_id")
            faculty_name = request.POST.get("faculty_name", "").strip()
            if user_id and faculty_name:
                obj, created = DBManagerFacultyAssignment.objects.get_or_create(
                    db_manager_user_id=user_id,
                    faculty_name=faculty_name,
                    defaults={'assigned_by': request.user}
                )
                if created:
                    messages.success(request, f"Fakultet muvaffaqiyatli tayinlandi.")
                else:
                    messages.info(request, "Bu tayinlov allaqachon mavjud.")
        
        elif action == "revoke":
            assignment_id = request.POST.get("assignment_id")
            if assignment_id:
                DBManagerFacultyAssignment.objects.filter(id=assignment_id).delete()
                messages.success(request, "Tayinlov olib tashlandi.")
        
        return redirect('retake:retake_db_manager_faculties')
    
    # Har bir DB Manager uchun tayinlangan fakultetlar
    assignments = DBManagerFacultyAssignment.objects.select_related(
        'db_manager_user', 'assigned_by'
    ).order_by('db_manager_user__first_name', 'faculty_name')
    
    return render(request, "retake/admin_db_manager_faculties.html", {
        "db_managers": db_managers,
        "all_faculties": all_faculties,
        "assignments": assignments,
    })
```

**URL ga qo'shish** (`retake/urls.py`):
```python
path('admin/db-manager-faculties/', admin_control.manage_db_manager_faculties, name='retake_db_manager_faculties'),
```

---

## 6-QADAM: REDUNDANT SAHIFALARNI O'CHIRISH

### O'chiriladi (SPA router dan ham olib tashlanadi):

| Sahifa | Sabab |
|--------|-------|
| `RetakeSchedulesPage.tsx` | Group Detail sahifasining `Nazorat` tabi buni o'z ichiga oladi |
| `RetakeExamCalendarPage.tsx` | Group Detail'da assessment holati ko'rinadi; alohida kerak emas |
| `RetakeStudentDebtsPage.tsx` | Bu LMS studentlar sahifasida bo'lishi kerak, Retake menusida emas |

### O'chirilmaydi (kerak):
- `RetakeDashboard.tsx` ✅ (real API bilan yangilash kerak)
- `RetakeManageGroupsPage.tsx` ✅ (guruhlar ro'yxati — asosiy sahifa)
- `RetakeExamSheetPage.tsx` ✅ (baholash — yaxshi yozilgan)
- `RetakeCyclesPage.tsx` ✅ (admin uchun)
- `RetakeSyncPage.tsx` ✅ (admin uchun)
- `RetakeTeacherGroupsPage.tsx` ✅ (o'qituvchi uchun)
- `RetakeSearchStudentPage.tsx` ✅ (registrator uchun)

---

## 7-QADAM: OPTIMAL MENYU STRUKTURASI (Rol bo'yicha)

### RET_DB_MANAGER menyu (faqat 3 ta):

```
RETAKE bo'limi:
  📊 Dashboard          → /retake/dashboard
  📚 Fan Guruhlari      → /retake/groups        ← ASOSIY SAHIFA
  📋 Qaydnomalar        → /retake/exam-sheets    ← barcha qaydnomalar holati
```

### RET_REGISTRATOR menyu:
```
RETAKE bo'limi:
  📊 Dashboard          → /retake/dashboard
  📝 Arizalar           → /retake/applications
  👥 Talaba qidirish    → /retake/search-student
```

### RET_ACCOUNTING menyu:
```
RETAKE bo'limi:
  📊 Dashboard          → /retake/dashboard
  💰 To'lovlar          → /retake/accounting/list
```

### RET_SUPERVISOR menyu:
```
RETAKE bo'limi:
  📊 Dashboard          → /retake/dashboard
  ✅ Tasdiqlash         → /retake/supervisor/list
```

### SUPER_ADMIN / REGISTRATOR retake menyu:
```
RETAKE bo'limi:
  📊 Dashboard          → /retake/dashboard
  🔄 Tsikllar           → /retake/cycles
  📝 Arizalar           → /retake/applications
  📚 Fan Guruhlari      → /retake/groups
  📋 Qaydnomalar        → /retake/exam-sheets
  🔗 HEMIS Sinxron      → /retake/sync
  👥 MB menejerlari     → /retake/admin/db-manager-faculties
  ⚙️ Nazorat sozlama   → /retake/admin/assessment-control
```

### SidebarMenuAccess DB migration (fixture yoki management command):
```python
# Management command: retake/management/commands/setup_retake_menus.py

from django.core.management.base import BaseCommand
from users.models import SidebarMenu, SidebarMenuAccess

RETAKE_MENUS = [
    {
        'key': 'retake-dashboard',
        'label': 'Retake Dashboard',
        'section': 'RETAKE',
        'icon_lucide': 'layout-dashboard',
        'spa_path': '/retake/dashboard',
        'roles': {
            'RET_DB_MANAGER': 1, 'RET_REGISTRATOR': 1, 'RET_ACCOUNTING': 1,
            'RET_SUPERVISOR': 1, 'REGISTRATOR': 1, 'SUPER_ADMIN': 1,
        }
    },
    {
        'key': 'retake-groups',
        'label': 'Fan Guruhlari',
        'section': 'RETAKE',
        'icon_lucide': 'users',
        'spa_path': '/retake/groups',
        'roles': {'RET_DB_MANAGER': 2, 'REGISTRATOR': 3, 'SUPER_ADMIN': 3}
    },
    {
        'key': 'retake-exam-sheets',
        'label': 'Qaydnomalar',
        'section': 'RETAKE',
        'icon_lucide': 'clipboard-list',
        'spa_path': '/retake/exam-sheets',
        'roles': {'RET_DB_MANAGER': 3, 'REGISTRATOR': 4, 'SUPER_ADMIN': 4}
    },
    {
        'key': 'retake-applications',
        'label': 'Arizalar',
        'section': 'RETAKE',
        'icon_lucide': 'file-text',
        'spa_path': '/retake/applications',
        'roles': {'RET_REGISTRATOR': 2, 'REGISTRATOR': 2, 'SUPER_ADMIN': 2}
    },
    {
        'key': 'retake-cycles',
        'label': 'Tsikllar',
        'section': 'RETAKE',
        'icon_lucide': 'repeat',
        'spa_path': '/retake/cycles',
        'roles': {'REGISTRATOR': 5, 'SUPER_ADMIN': 5}
    },
    {
        'key': 'retake-db-manager-faculties',
        'label': 'MB Menejerlari',
        'section': 'RETAKE',
        'icon_lucide': 'user-check',
        'spa_path': '/retake/admin/db-manager-faculties',
        'roles': {'REGISTRATOR': 6, 'SUPER_ADMIN': 6}
    },
    {
        'key': 'retake-sync',
        'label': 'HEMIS Sinxron',
        'section': 'RETAKE',
        'icon_lucide': 'refresh-cw',
        'spa_path': '/retake/sync',
        'roles': {'REGISTRATOR': 7, 'SUPER_ADMIN': 7}
    },
    {
        'key': 'retake-assessment-control',
        'label': 'Nazorat sozlamasi',
        'section': 'RETAKE',
        'icon_lucide': 'settings',
        'spa_path': '/retake/admin/assessment-control',
        'roles': {'SUPER_ADMIN': 8}
    },
    {
        'key': 'retake-accounting',
        'label': "To'lovlar",
        'section': 'RETAKE',
        'icon_lucide': 'credit-card',
        'spa_path': '/retake/accounting/list',
        'roles': {'RET_ACCOUNTING': 2}
    },
    {
        'key': 'retake-supervisor',
        'label': 'Tasdiqlash',
        'section': 'RETAKE',
        'icon_lucide': 'check-circle',
        'spa_path': '/retake/supervisor/list',
        'roles': {'RET_SUPERVISOR': 2}
    },
    {
        'key': 'retake-teacher-groups',
        'label': 'Guruhlarim',
        'section': 'RETAKE',
        'icon_lucide': 'book-open',
        'spa_path': '/retake/teacher/groups',
        'roles': {'TEACHER': 10}
    },
]

class Command(BaseCommand):
    help = 'Retake menyu elementlarini yaratadi yoki yangilaydi'

    def handle(self, *args, **options):
        for menu_data in RETAKE_MENUS:
            roles = menu_data.pop('roles')
            menu, created = SidebarMenu.objects.update_or_create(
                key=menu_data['key'],
                defaults=menu_data
            )
            for role, order in roles.items():
                SidebarMenuAccess.objects.update_or_create(
                    menu=menu, role=role,
                    defaults={'order_index': order, 'is_visible': True}
                )
            action = 'Yaratildi' if created else 'Yangilandi'
            self.stdout.write(f"{action}: {menu.label}")
        
        self.stdout.write(self.style.SUCCESS('Retake menyulari muvaffaqiyatli sozlandi!'))
```

**Ishga tushirish:**
```bash
python manage.py setup_retake_menus
```

---

## 8-QADAM: `RetakeManageGroupsPage.tsx` YANGILASH

### Hozir nima noto'g'ri:
- Guruhga bosganda hech narsa ochilmaydi (detail yo'q)
- Filtr yo'q (DB Manager o'ziga tayinlangan fakultetlar bo'yicha)
- Auto-grouping tugmasi yo'q

### Yangilangan sahifa:

```tsx
// design/src/pages/RetakeManageGroupsPage.tsx

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Zap, Users, ChevronRight, Filter } from 'lucide-react';
import { fetchRetakeGroups, createRetakeGroup, runAutoGrouping } from '@/src/api/retake';

export default function RetakeManageGroupsPage() {
  const [data, setData] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [autoSuggestions, setAutoSuggestions] = useState<any[]>([]);
  const [createForm, setCreateForm] = useState({ subject_id: 0, code: '', teacher_id: 0, capacity: 25 });
  const [isLoading, setIsLoading] = useState(true);
  const [facultyFilter, setFacultyFilter] = useState('');

  // load, handleCreate, handleAutoGroup ... (standart)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-text-primary">Fan Guruhlari</h1>
            <p className="mt-1 text-sm text-text-muted">
              {data?.assigned_faculties?.length
                ? `Tayinlangan fakultetlar: ${data.assigned_faculties.join(', ')}`
                : 'Barcha fakultetlar'}
            </p>
          </div>
          <div className="flex gap-3">
            {/* Auto-grouping — eng muhim tugma */}
            <button
              onClick={() => void handleAutoGroup()}
              className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-white hover:bg-amber-600"
            >
              <Zap size={16} />
              Avtomatik guruhlash
            </button>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white"
            >
              <Plus size={16} />
              Yangi guruh
            </button>
          </div>
        </div>
        
        {/* Guruhlashga tayyor fanlar */}
        {data?.subjects_needing_groups?.length > 0 && (
          <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-sm font-bold text-amber-800">
              ⚠️ {data.subjects_needing_groups.length} ta fan guruhlashni kutmoqda
              ({data.subjects_needing_groups.reduce((s: number, x: any) => s + x.items_count, 0)} ta talaba)
            </p>
          </div>
        )}
      </div>

      {/* Guruhlar ro'yxati */}
      <div className="card overflow-hidden">
        {data?.groups.map((group: any) => (
          <Link
            key={group.id}
            to={`/retake/groups/${group.id}`}  {/* ← GROUP DETAIL sahifasiga o'tish */}
            className="flex items-center justify-between px-6 py-5 border-b border-border hover:bg-slate-50 transition-colors group"
          >
            <div className="flex-1">
              <p className="font-black text-text-primary text-base">{group.subject.name}</p>
              <p className="mt-0.5 text-xs font-bold text-text-muted uppercase tracking-wider">
                {group.code} • {group.subject.semester_name}
              </p>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <p className="font-black text-text-primary">{group.members_count}</p>
                <p className="text-xs text-text-muted">talaba</p>
              </div>
              <div className="text-center">
                <p className="font-black text-text-primary">{group.assessments_count}</p>
                <p className="text-xs text-text-muted">nazorat</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{group.teacher?.full_name || '—'}</p>
                <span className={`status-pill mt-1 ${group.status === 'active' ? 'status-pill-success' : 'status-pill-muted'}`}>
                  {group.status_label}
                </span>
              </div>
              <ChevronRight size={18} className="text-text-muted group-hover:text-primary transition-colors" />
            </div>
          </Link>
        ))}
      </div>
      
      {/* Auto-grouping tasdiqlash modali */}
      {showAutoModal && autoSuggestions.length > 0 && (
        <AutoGroupModal
          suggestions={autoSuggestions}
          onApply={handleApplySuggestions}
          onClose={() => setShowAutoModal(false)}
        />
      )}
    </div>
  );
}
```

---

## 9-QADAM: YANGI `RetakeGroupDetailPage.tsx`

```tsx
// design/src/pages/RetakeGroupDetailPage.tsx

import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Users, ClipboardList, BookOpen } from 'lucide-react';
import { useEffect, useState } from 'react';

type Tab = 'members' | 'assessments' | 'sheets';

export default function RetakeGroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('members');
  const [studentGroups, setStudentGroups] = useState<any[]>([]);

  const tabs = [
    { id: 'members',     label: "A'zolar",           icon: Users },
    { id: 'assessments', label: 'Nazorat jadvali',   icon: ClipboardList },
    { id: 'sheets',      label: 'Qaydnomalar',       icon: BookOpen },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div className="card p-6">
        <Link to="/retake/groups" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-primary mb-3">
          <ArrowLeft size={16} /> Fan Guruhlariga qaytish
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-text-primary">
              {data?.group.subject_name}
            </h1>
            <p className="text-sm text-text-muted mt-1">
              {data?.group.code} • {data?.group.semester_name} •{' '}
              {data?.group.total_members} ta talaba
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-text-secondary">
              O'qituvchi: {data?.group.teacher?.full_name || 'Tayinlanmagan'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border px-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: A'zolar */}
      {tab === 'members' && (
        <MembersTab studentGroups={data?.student_groups || []} />
      )}

      {/* Tab: Nazorat jadvali */}
      {tab === 'assessments' && (
        <AssessmentsTab
          groupId={groupId!}
          assessments={data?.assessments || []}
          studentGroups={studentGroups}
          teachers={data?.teachers || []}
          onRefresh={loadData}
        />
      )}

      {/* Tab: Qaydnomalar */}
      {tab === 'sheets' && (
        <ExamSheetsTab assessments={data?.assessments || []} />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────
// A'zolar tab — HEMIS guruh bo'yicha accordion
// ──────────────────────────────────────────────────
function MembersTab({ studentGroups }: { studentGroups: any[] }) {
  return (
    <div className="space-y-3">
      {studentGroups.map(sg => (
        <details key={sg.group_name} className="card overflow-hidden group" open={studentGroups.length === 1}>
          <summary className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 select-none">
            <div className="flex items-center gap-3">
              <span className="font-black text-text-primary text-base">{sg.group_name}</span>
              <span className="text-sm text-text-muted">{sg.faculty_name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-text-secondary">{sg.count} talaba</span>
              <div className="flex gap-1">
                {(sg.control_types_needed as string[]).map(ct => (
                  <span key={ct} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                    {ct}
                  </span>
                ))}
              </div>
            </div>
          </summary>
          <div className="border-t border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="px-4 py-3 text-left">F.I.O</th>
                  <th className="px-4 py-3 text-left">Talaba ID</th>
                  <th className="px-4 py-3 text-left">Nazorat turi</th>
                  <th className="px-4 py-3 text-left">Fakultet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sg.members.map((m: any) => (
                  <tr key={m.membership_id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-bold text-text-primary">{m.student_name}</td>
                    <td className="px-4 py-3 text-text-muted font-mono text-xs">{m.student_id}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                        {m.required_control_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs">{m.faculty_name}</td>
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

// ──────────────────────────────────────────────────
// Nazorat jadvali tab — HEMIS guruh bo'yicha matritsa
// ──────────────────────────────────────────────────
function AssessmentsTab({ groupId, assessments, studentGroups, teachers, onRefresh }: any) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    student_group_name: '', control_type: 'final',
    scheduled_at: '', room: '', pair_number: 1, teacher_id: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  
  const CONTROL_TYPES = [
    { value: '1-jn', label: '1-Joriy nazorat' },
    { value: '2-jn', label: '2-Joriy nazorat' },
    { value: '1-on', label: '1-Oraliq nazorat' },
    { value: '2-on', label: '2-Oraliq nazorat' },
    { value: 'final', label: 'Yakuniy nazorat' },
  ];
  
  // Jadval holat matritsasi: guruh x nazorat_turi
  const assessmentMap: Record<string, Record<string, any>> = {};
  for (const a of assessments) {
    if (!assessmentMap[a.student_group_name]) assessmentMap[a.student_group_name] = {};
    assessmentMap[a.student_group_name][a.control_type] = a;
  }

  return (
    <div className="space-y-6">
      {/* Holat matritsasi */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-black text-text-primary">Nazorat holati</h3>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white"
          >
            + Nazorat qo'shish
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-black text-text-muted uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">HEMIS Guruh</th>
                {CONTROL_TYPES.map(ct => (
                  <th key={ct.value} className="px-3 py-3 text-center">{ct.label.split(' ')[0]}<br/>{ct.label.split(' ').slice(1).join(' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {studentGroups.map((sg: any) => (
                <tr key={sg.group_name} className="hover:bg-slate-50/50">
                  <td className="px-4 py-4">
                    <p className="font-black text-text-primary">{sg.group_name}</p>
                    <p className="text-xs text-text-muted">{sg.count} talaba</p>
                  </td>
                  {CONTROL_TYPES.map(ct => {
                    const needed = (sg.control_types_needed as string[]).includes(ct.value);
                    const assessment = assessmentMap[sg.group_name]?.[ct.value];
                    return (
                      <td key={ct.value} className="px-3 py-4 text-center">
                        {!needed ? (
                          <span className="text-slate-300 text-lg">—</span>
                        ) : assessment ? (
                          <div>
                            <span className="text-emerald-600 text-sm font-bold">✓</span>
                            {assessment.exam_sheet ? (
                              <Link to={`/retake/exam-sheets/${assessment.exam_sheet.id}`}
                                className="block text-xs text-primary hover:underline mt-0.5">
                                {assessment.exam_sheet.sheet_no}
                              </Link>
                            ) : null}
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setForm(f => ({...f, student_group_name: sg.group_name, control_type: ct.value}));
                              setShowForm(true);
                            }}
                            className="text-xs text-amber-600 hover:text-amber-800 font-bold hover:underline"
                          >
                            + Qo'shish
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nazorat qo'shish modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md p-8 space-y-5">
            <h3 className="text-xl font-black text-text-primary">Nazorat qo'shish</h3>
            
            <div className="space-y-3">
              <label className="label-micro">HEMIS Guruh</label>
              <select value={form.student_group_name}
                onChange={e => setForm(f => ({...f, student_group_name: e.target.value}))}
                className="input">
                <option value="">Guruh tanlang</option>
                {studentGroups.map((sg: any) => (
                  <option key={sg.group_name} value={sg.group_name}>
                    {sg.group_name} ({sg.count} talaba)
                  </option>
                ))}
              </select>
              
              <label className="label-micro">Nazorat turi</label>
              <select value={form.control_type}
                onChange={e => setForm(f => ({...f, control_type: e.target.value}))}
                className="input">
                {CONTROL_TYPES.map(ct => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
              
              <label className="label-micro">Sana va vaqt</label>
              <input type="datetime-local" value={form.scheduled_at}
                onChange={e => setForm(f => ({...f, scheduled_at: e.target.value}))}
                className="input" />
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-micro">Xona</label>
                  <input type="text" value={form.room}
                    onChange={e => setForm(f => ({...f, room: e.target.value}))}
                    className="input" placeholder="201-xona" />
                </div>
                <div>
                  <label className="label-micro">Para raqami</label>
                  <input type="number" min="1" max="6" value={form.pair_number}
                    onChange={e => setForm(f => ({...f, pair_number: Number(e.target.value)}))}
                    className="input" />
                </div>
              </div>
              
              <label className="label-micro">O'qituvchi</label>
              <select value={form.teacher_id}
                onChange={e => setForm(f => ({...f, teacher_id: e.target.value}))}
                className="input">
                <option value="">Guruh o'qituvchisi</option>
                {teachers.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
            </div>
            
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 rounded-2xl border border-border py-3 text-sm font-bold">
                Bekor
              </button>
              <button
                disabled={isSaving || !form.student_group_name || !form.scheduled_at}
                onClick={() => void handleCreateAssessment()}
                className="flex-1 rounded-2xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-50">
                {isSaving ? 'Saqlanmoqda...' : 'Yaratish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────
// Qaydnomalar tab
// ──────────────────────────────────────────────────
function ExamSheetsTab({ assessments }: { assessments: any[] }) {
  const sheetsWithExam = assessments.filter(a => a.exam_sheet);
  
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-border px-6 py-4">
        <h3 className="font-black text-text-primary">Qaydnomalar holati</h3>
      </div>
      <div className="divide-y">
        {sheetsWithExam.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-text-muted">
            Hali qaydnoma yaratilmagan. Nazorat jadvali tabida nazorat qo'shing.
          </div>
        ) : sheetsWithExam.map(a => (
          <div key={a.id} className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="font-black text-text-primary">
                {a.student_group_name || 'Barcha talabalar'} — {a.control_type_label}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {new Date(a.scheduled_at).toLocaleDateString('uz')} • {a.room || '—'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right text-sm">
                <span className={`status-pill ${
                  a.exam_sheet.status === 'locked' ? 'status-pill-success' :
                  a.exam_sheet.status === 'submitted' ? 'status-pill-warning' : 'status-pill-primary'
                }`}>
                  {a.exam_sheet.status}
                </span>
                <p className="text-xs text-text-muted mt-1">
                  {a.exam_sheet.graded_count}/{a.exam_sheet.entries_count} baholangan
                </p>
              </div>
              <Link
                to={`/retake/exam-sheets/${a.exam_sheet.id}`}
                className="rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-primary/5 hover:border-primary/20 transition-colors"
              >
                {a.exam_sheet.sheet_no} →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 10-QADAM: ROUTER YANGILASH

**Fayl:** `design/src/app/router.tsx`

```tsx
// QOLADI:
<Route path="/retake/dashboard" element={<RetakeDashboard user={user} />} />
<Route path="/retake/groups" element={<RetakeManageGroupsPage />} />
<Route path="/retake/groups/:groupId" element={<RetakeGroupDetailPage />} />  {/* YANGI */}
<Route path="/retake/exam-sheets/:sheetId" element={<RetakeExamSheetPage />} />
<Route path="/retake/cycles" element={<RetakeCyclesPage />} />
<Route path="/retake/sync" element={<RetakeSyncPage />} />
<Route path="/retake/teacher/groups" element={<RetakeTeacherGroupsPage />} />
<Route path="/retake/applications" element={<RetakePage />} />
<Route path="/retake/search-student" element={<RetakeSearchStudentPage />} />

// O'CHIRILADI (redundant):
// <Route path="/retake/schedules" .../>         ← RetakeSchedulesPage
// <Route path="/retake/exam-calendar" .../>     ← RetakeExamCalendarPage
// <Route path="/retake/student-debts" .../>     ← RetakeStudentDebtsPage (LMS sahifasida bo'lsin)
```

---

## 11-QADAM: IMPLEMENTATSIYA TARTIBI

```
1. makemigrations + migrate
   → DBManagerFacultyAssignment model
   → AssessmentSchedule.student_group_name field

2. retake/utils/db_manager_utils.py fayl yaratish

3. manage_db_manager_faculties view + URL + template

4. python manage.py setup_retake_menus (management command)

5. groups.py → manage_groups, create_assessment viewlarini yangilash

6. RetakeManageGroupsPage.tsx yangilash (Link + auto-group + filter)

7. RetakeGroupDetailPage.tsx yaratish (tabs: A'zolar, Nazorat, Qaydnomalar)

8. Router yangilash (add GroupDetail, remove redundant)

9. RetakeSchedulesPage.tsx va RetakeExamCalendarPage.tsx → o'chirish yoki router dan olib tashlash

10. API types yangilash (student_group_name qo'shiladi)
```

---

## XULOSA: Qaysi sahifalar qoladi

| Sahifa | Rol | Holat |
|--------|-----|-------|
| Dashboard | Barcha retake rollari | ✅ Qoladi (real API kerak) |
| Fan Guruhlari | DB Manager, Admin | ✅ Yangilanadi (Link + filtr) |
| **Guruh Detail** (YANGI) | DB Manager, Admin | 🆕 Yaratiladi |
| Qaydnoma | DB Manager, Teacher | ✅ Yaxshi yozilgan |
| Tsikllar | Admin | ✅ Qoladi |
| HEMIS Sinxron | Admin | ✅ Qoladi |
| **MB Menejerlari** (YANGI) | Admin | 🆕 Yaratiladi |
| Arizalar | Registrator | ✅ Qoladi |
| Schedules | — | ❌ O'chiriladi |
| Exam Calendar | — | ❌ O'chiriladi |
| Student Debts | — | ❌ Retake menusidan olib tashlanadi |
