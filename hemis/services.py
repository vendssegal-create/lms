from datetime import datetime, timezone as dt_timezone
from decimal import Decimal
from collections import defaultdict
from typing import Any, Tuple, List, Dict
from django.db import transaction
from django.utils import timezone
from .models import (
    HemisStudentSnapshot, 
    HemisSubjectSnapshot, 
    HemisStudentDebt, 
    HemisSyncLog,
    HemisSyncStatus,
    HemisCurriculumSnapshot,
    HemisRoomSnapshot
)
from .utils.client import HemisRestClient, HemisRestApiError
from .utils.helpers import (
    normalize_control_type, 
    to_decimal, 
    exam_code, 
    exam_name, 
    nested_name, 
    nested_code
)
from users.models import User, StudentProfile, TeacherProfile
from lms.models import ControlType

class RetakeHemisSyncService:
    def __init__(self, client: HemisRestClient = None):
        self.client = client or HemisRestClient()

    @transaction.atomic
    def sync_student(self, student_id: int = None, student_id_number: str = None, sync_debts: bool = True) -> HemisStudentSnapshot:
        payload = self.client.get_student_info(student_id=student_id, student_id_number=student_id_number)
        snapshot = self._upsert_student_snapshot_from_info(payload)
        
        if sync_debts:
            try:
                self.sync_student_debts_for_snapshot(snapshot)
            except Exception:
                pass
        return snapshot

    @transaction.atomic
    def sync_curriculum_subjects(self, curriculum_id: int, semester_code: str = None) -> List[HemisSubjectSnapshot]:
        payloads = self.client.get_curriculum_subjects(curriculum_id, semester_code=semester_code)
        snapshots = []
        for payload in payloads:
            subject = payload.get("subject") or {}
            if not subject.get("id"):
                continue
            
            snapshot, _ = HemisSubjectSnapshot.objects.get_or_create(hemis_subject_id=subject["id"])
            exam_types = self._extract_exam_types(payload)
            snapshot.curriculum_subject_id = payload.get("id")
            snapshot.subject_code = subject.get("code", "") or ""
            snapshot.subject_name = subject.get("name", "") or ""
            snapshot.credit = payload.get("credit") or 0
            snapshot.semester_code = nested_code(payload.get("semester"))
            snapshot.semester_name = nested_name(payload.get("semester"))
            snapshot.primary_exam_type = exam_types[0] if exam_types else ""
            snapshot.exam_types = exam_types
            snapshot.raw_payload = payload
            snapshot.save()
            snapshots.append(snapshot)
        return snapshots

    @transaction.atomic
    def sync_student_debts_for_snapshot(self, student_snapshot: HemisStudentSnapshot) -> Tuple[HemisStudentSnapshot, List[HemisStudentDebt], str]:
        try:
            student, debt_rows = self.sync_student_debts_from_student_info(student_snapshot)
            return student, debt_rows, 'student_info'
        except Exception as e:
            raise e

    @transaction.atomic
    def sync_student_debts(self, pinfl: str, student_token: str = None) -> Tuple[HemisStudentSnapshot, List[HemisStudentDebt]]:
        payload = self.client.get_student_debts_by_pinfl(pinfl, student_token=student_token)
        data = payload.get("data", {}) if isinstance(payload, dict) else {}
        student_payload = data.get("student", {}) if isinstance(data, dict) else {}
        
        if not student_payload.get("id"):
            raise HemisRestApiError("HEMIS debt response student ma'lumotini qaytarmadi.")
        
        student_snapshot = self._upsert_student_snapshot_from_debt_payload(
            student_payload, pinfl=pinfl, current_semester=data.get("current_semester")
        )
        
        # Deactivate old debts
        HemisStudentDebt.objects.filter(student_snapshot=student_snapshot, is_active=True).update(is_active=False)

        debt_rows = []
        for debt in data.get("debts", []) or []:
            subject_snapshot, _ = HemisSubjectSnapshot.objects.get_or_create(hemis_subject_id=debt["subject_id"])
            subject_snapshot.subject_code = debt.get("subject_code", "") or ""
            subject_snapshot.subject_name = debt.get("subject_name", "") or ""
            subject_snapshot.credit = to_decimal(debt.get("credit") or debt.get("credits")) or Decimal("0.00")
            subject_snapshot.semester_code = debt.get("semester", "") or ""
            subject_snapshot.semester_name = debt.get("semester", "") or ""
            subject_snapshot.primary_exam_type = debt.get("exam_type", "") or ""
            subject_snapshot.exam_types = [debt.get("exam_type")] if debt.get("exam_type") else []
            subject_snapshot.raw_payload = debt
            subject_snapshot.save()

            debt_row, _ = HemisStudentDebt.objects.get_or_create(
                student_snapshot=student_snapshot,
                subject_snapshot=subject_snapshot,
                semester_label=debt.get("semester", "") or "",
                control_type=normalize_control_type(debt.get("exam_type")),
            )
            debt_row.education_year = data.get("education_year", "") or ""
            debt_row.exam_type_label = debt.get("exam_type", "") or ""
            debt_row.debt_status = debt.get("status", "") or "active"
            debt_row.total_point = to_decimal(debt.get("total_point"))
            debt_row.grade = to_decimal(debt.get("grade"))
            debt_row.required_point = to_decimal(debt.get("required_point")) or Decimal("55.00")
            debt_row.is_active = True
            debt_row.raw_payload = debt
            debt_row.save()
            debt_rows.append(debt_row)
            
        return student_snapshot, debt_rows

    @transaction.atomic
    def sync_student_debts_from_performance(self, student_snapshot: HemisStudentSnapshot) -> Tuple[HemisStudentSnapshot, List[HemisStudentDebt]]:
        student_subjects = self.client.get_student_subjects(student_snapshot.hemis_student_id)
        performance_items = self.client.get_student_performance(student_snapshot.hemis_student_id)
        curriculum_subjects = []
        if student_snapshot.curriculum_id:
            try:
                curriculum_subjects = self.sync_curriculum_subjects(int(student_snapshot.curriculum_id))
            except Exception:
                curriculum_subjects = []

        student_subject_index = self._build_student_subject_index(student_subjects)
        curriculum_index = self._build_curriculum_subject_index(curriculum_subjects)
        grouped_performance = defaultdict(list)
        
        for item in performance_items:
            subject = item.get("subject") or {}
            subject_id = subject.get("id")
            if not subject_id: continue
            semester = item.get("semester") or {}
            semester_code = str(semester.get("code") or "")
            grouped_performance[(int(subject_id), semester_code)].append(item)

        # Deactivate old performance-based debts
        HemisStudentDebt.objects.filter(student_snapshot=student_snapshot, is_active=True).update(is_active=False)
        
        debt_rows = []
        for (subject_id, semester_code), rows in grouped_performance.items():
            # Collect all valid grades for this subject/semester grouping
            all_grades = []
            for r in rows:
                grade = to_decimal(r.get("grade"))
                if grade is not None:
                    all_grades.append(grade)
            
            if not all_grades:
                continue

            # Use the maximum grade across all exam types as the representative score
            # A student has "passed" if ANY of their attempts reached >= 55
            max_grade = max(all_grades)
            
            PASSING_GRADE = Decimal("55.00")
            if max_grade >= PASSING_GRADE:
                continue
            
            # This subject is a debt — use the last (most recent) row's metadata
            latest_row = rows[-1]
            # For display, prefer the "final"-type exam row
            final_item = next(
                (r for r in rows if (r.get("examType") or r.get("finalExamType") or {}).get("code") in ("13", "14")),
                None
            )
            display_row = final_item or latest_row
            semester_label = (display_row.get("semester") or {}).get("name", "")
            exam_type_info = display_row.get("examType") or display_row.get("finalExamType") or {}
            exam_type_label = exam_type_info.get("name", "Performance-Inferred") if isinstance(exam_type_info, dict) else "Performance-Inferred"
            
            student_subject_payload = student_subject_index.get((subject_id, semester_code)) or student_subject_index.get((subject_id, ""))
            curriculum_payload = curriculum_index.get((subject_id, semester_code)) or curriculum_index.get((subject_id, ""))
            
            subject_snapshot = self._upsert_subject_snapshot_from_academic_payload(
                subject_id=subject_id,
                performance_rows=rows,
                student_subject_payload=student_subject_payload,
                curriculum_payload=curriculum_payload
            )
            
            debt_row, _ = HemisStudentDebt.objects.update_or_create(
                student_snapshot=student_snapshot,
                subject_snapshot=subject_snapshot,
                control_type=ControlType.FINAL,
                defaults={
                    'semester_label': semester_label,
                    'exam_type_label': f"{exam_type_label} (Perf-Inferred)",
                    'debt_status': 'inferred_from_performance',
                    'total_point': max_grade,
                    'grade': to_decimal(final_item.get("grade") if final_item else max_grade),
                    'required_point': PASSING_GRADE,
                    'is_active': True,
                    'raw_payload': {'performance_rows': rows}
                }
            )
            debt_rows.append(debt_row)
                
        return student_snapshot, debt_rows

    def sync_student_debts_from_student_info(self, student_snapshot: HemisStudentSnapshot) -> Tuple[HemisStudentSnapshot, List[HemisStudentDebt]]:
        """
        Uses /v1/data/student-info which contains the full curriculum list.
        Each subject has: id, name, credit, semester, total_point, grade, passed.
        A subject is a DEBT if passed=False.
        Subjects with total_point=0 and no grade (current semester, not yet completed) are also debts.
        """
        PASSING_GRADE = Decimal("55.00")

        # Fetch full student info
        info = self.client.get_student_info(
            student_id=student_snapshot.hemis_student_id,
            student_id_number=student_snapshot.student_id_number
        )
        if not info:
            raise HemisRestApiError("student-info bo'sh qaytdi.")

        subjects = info.get("subjects") or []
        if not subjects:
            raise HemisRestApiError("student-info'da subjects ro'yxati topilmadi.")

        # Deactivate old debts
        HemisStudentDebt.objects.filter(student_snapshot=student_snapshot, is_active=True).update(is_active=False)
        debt_rows = []

        for subject in subjects:
            # Safety: skip non-dict items
            if not isinstance(subject, dict):
                continue
            # passed=False means the student did NOT pass this subject → debt
            passed = subject.get("passed")
            if passed is True:
                continue  # Student passed, skip

            subject_id = subject.get("id")
            if not subject_id:
                continue

            subject_name = subject.get("name") or f"Subject {subject_id}"
            credit = to_decimal(subject.get("credit")) or Decimal("0.00")
            total_point = to_decimal(subject.get("total_point"))
            grade = to_decimal(subject.get("grade"))
            semester_info = subject.get("semester") or {}
            semester_name = semester_info.get("name") or ""

            subject_snapshot, _ = HemisSubjectSnapshot.objects.get_or_create(hemis_subject_id=subject_id)
            subject_snapshot.subject_name = subject_name
            subject_snapshot.credit = credit
            subject_snapshot.semester_name = semester_name
            subject_snapshot.save()

            debt_row, _ = HemisStudentDebt.objects.update_or_create(
                student_snapshot=student_snapshot,
                subject_snapshot=subject_snapshot,
                control_type=ControlType.FINAL,
                defaults={
                    'semester_label': semester_name,
                    'exam_type_label': "Yakuniy (Student Info)",
                    'debt_status': 'from_student_info',
                    'total_point': total_point or Decimal("0.00"),
                    'grade': grade or Decimal("0.00"),
                    'required_point': PASSING_GRADE,
                    'is_active': True,
                    'raw_payload': subject,
                }
            )
            debt_rows.append(debt_row)

        return student_snapshot, debt_rows


    def _build_student_subject_index(self, student_subjects: List[Dict]) -> Dict:
        result = {}
        for item in student_subjects:
            cs = item.get("curriculumSubject") or {}
            subject = cs.get("subject") or {}
            subject_id = subject.get("id") or item.get("_subject")
            if not subject_id: continue
            semester_code = str(item.get("_semester") or cs.get("_semester") or "")
            result[(int(subject_id), semester_code)] = item
            result.setdefault((int(subject_id), ""), item)
        return result

    def _build_curriculum_subject_index(self, curriculum_subjects: List) -> Dict:
        result = {}
        for item in curriculum_subjects:
            if hasattr(item, 'raw_payload'):
                payload = item.raw_payload
            else:
                payload = item
            subject = payload.get("subject") or {}
            subject_id = subject.get("id")
            if not subject_id: continue
            semester = payload.get("semester") or {}
            semester_code = str(semester.get("code") or "")
            result[(int(subject_id), semester_code)] = payload
            result.setdefault((int(subject_id), ""), payload)
        return result

    def _upsert_subject_snapshot_from_academic_payload(self, subject_id, performance_rows, student_subject_payload, curriculum_payload):
        snapshot, _ = HemisSubjectSnapshot.objects.get_or_create(hemis_subject_id=subject_id)
        
        # Priority: Performance data -> Curriculum data -> Student-Subject data
        perf_sub = performance_rows[0].get("subject") or {}
        snapshot.subject_code = perf_sub.get("code") or ""
        snapshot.subject_name = perf_sub.get("name") or f"Subject {subject_id}"
        
        # Extract credits (try all common HEMIS field names)
        snapshot.credit = (
            to_decimal(curriculum_payload.get("credit") if curriculum_payload else None)
            or to_decimal(curriculum_payload.get("credits") if curriculum_payload else None)
            or to_decimal((student_subject_payload.get("curriculumSubject") or {}).get("credit") if student_subject_payload else None)
            or to_decimal(performance_rows[0].get("credit"))
            or Decimal("0.00")
        )
        snapshot.save()
        return snapshot

    def _extract_exam_types(self, payload: Dict[str, Any]) -> List[str]:
        result = []
        for item in payload.get("subjectExamTypes") or []:
            exam_type = item.get("examType") or {}
            name = exam_type.get("name") or exam_type.get("code")
            if name:
                result.append(name)
        return result

    def _upsert_student_snapshot_from_info(self, payload: Dict[str, Any]) -> HemisStudentSnapshot:
        snapshot, _ = HemisStudentSnapshot.objects.get_or_create(hemis_student_id=payload["id"])
        snapshot.student_id_number = payload.get("student_id_number", "") or ""
        snapshot.pinfl = payload.get("hash", "") or payload.get("pinfl", "") or ""
        snapshot.full_name = payload.get("full_name", "") or ""
        snapshot.short_name = payload.get("short_name", "") or ""
        snapshot.faculty_name = nested_name(payload.get("department"))
        snapshot.specialty_name = nested_name(payload.get("specialty"))
        snapshot.group_name = nested_name(payload.get("group"))
        snapshot.semester_code = nested_code(payload.get("semester"))
        snapshot.semester_name = nested_name(payload.get("semester"))
        snapshot.curriculum_id = payload.get("_curriculum")
        snapshot.raw_payload = payload
        snapshot.save()
        return snapshot

    def _upsert_student_snapshot_from_debt_payload(self, payload: Dict[str, Any], pinfl: str, current_semester: Any) -> HemisStudentSnapshot:
        snapshot, _ = HemisStudentSnapshot.objects.get_or_create(hemis_student_id=payload["id"])
        snapshot.student_id_number = payload.get("student_id_number", "") or ""
        snapshot.pinfl = payload.get("pinfl", "") or pinfl
        snapshot.full_name = payload.get("full_name", "") or ""
        snapshot.faculty_name = payload.get("department", "") or ""
        snapshot.group_name = payload.get("group", "") or ""
        snapshot.semester_code = str(current_semester or "")
        snapshot.semester_name = str(current_semester or "")
        snapshot.raw_payload = payload
        snapshot.save()
        return snapshot

class HemisAdminSyncService:
    def __init__(self, client: HemisRestClient = None):
        self.client = client or HemisRestClient()

    def sync_students(self, initiated_by=None, page_size: int = 200, filters: dict = None) -> HemisSyncLog:
        return self._run_sync(
            scope="students",
            initiated_by=initiated_by,
            page_size=page_size,
            filters=filters or {},
            fetch_page=lambda page, limit, f: self.client.list_students(page=page, limit=limit, **f),
            process_row=self._upsert_student,
        )

    def sync_curriculums(self, initiated_by=None, page_size: int = 200, filters: dict = None) -> HemisSyncLog:
        return self._run_sync(
            scope="curriculums",
            initiated_by=initiated_by,
            page_size=page_size,
            filters=filters or {},
            fetch_page=lambda page, limit, f: self.client.list_curriculums(page=page, limit=limit, **f),
            process_row=self._upsert_curriculum,
        )

    def sync_rooms(self, initiated_by=None, page_size: int = 200, filters: dict = None) -> HemisSyncLog:
        return self._run_sync(
            scope="rooms",
            initiated_by=initiated_by,
            page_size=page_size,
            filters=filters or {},
            fetch_page=lambda page, limit, f: self.client.list_rooms(page=page, limit=limit, **f),
            process_row=self._upsert_room,
        )

    def sync_teachers(self, initiated_by=None, page_size: int = 200, filters: dict = None) -> HemisSyncLog:
        return self._run_sync(
            scope="teachers",
            initiated_by=initiated_by,
            page_size=page_size,
            filters=filters or {},
            fetch_page=lambda page, limit, f: self.client.list_teachers(page=page, limit=limit, **f),
            process_row=self._upsert_teacher,
        )

    def sync_all(self, initiated_by=None) -> List[HemisSyncLog]:
        logs = []
        # Sequential sync of all entities
        logs.append(self.sync_teachers(initiated_by=initiated_by))
        logs.append(self.sync_students(initiated_by=initiated_by))
        logs.append(self.sync_curriculums(initiated_by=initiated_by))
        logs.append(self.sync_rooms(initiated_by=initiated_by))
        return logs

    def _run_sync(self, scope: str, initiated_by, page_size: int, filters: dict, fetch_page, process_row) -> HemisSyncLog:
        log = HemisSyncLog.objects.create(
            scope=scope, 
            status=HemisSyncStatus.RUNNING, 
            initiated_by=initiated_by
        )

        counters = {"processed_count": 0, "error_count": 0}
        try:
            page = 1
            while True:
                rows, pagination = fetch_page(page, page_size, filters)
                if not rows:
                    break
                for row in rows:
                    try:
                        with transaction.atomic():
                            process_row(row)
                        counters["processed_count"] += 1
                    except Exception as exc:
                        counters["error_count"] += 1
                        continue
                
                total_pages = int(pagination.get("pageCount") or 0)
                if page >= total_pages:
                    break
                page += 1

            log.status = HemisSyncStatus.SUCCESS if counters["error_count"] == 0 else HemisSyncStatus.PARTIAL
        except Exception as exc:
            log.status = HemisSyncStatus.FAILED
            log.message = str(exc)
        finally:
            log.finished_at = timezone.now()
            log.processed_count = counters["processed_count"]
            log.save()

        return log

    def _upsert_student(self, payload: dict) -> None:
        hemis_student_id = payload.get("id")
        student_id_number = str(payload.get("student_id_number") or "").strip()
        if not hemis_student_id:
            return

        snapshot, _ = HemisStudentSnapshot.objects.get_or_create(hemis_student_id=hemis_student_id)
        snapshot.student_id_number = student_id_number
        snapshot.full_name = payload.get("full_name") or ""
        snapshot.raw_payload = payload
        snapshot.save()

        if student_id_number:
            username = f"student_{student_id_number}"
            user, _ = User.objects.get_or_create(username=username)
            user.role = User.Role.STUDENT
            user.save()

            profile, _ = StudentProfile.objects.get_or_create(user=user)
            profile.full_name = payload.get("full_name") or ""
            profile.student_id_number = student_id_number
            profile.save()

    def _upsert_teacher(self, payload: dict) -> None:
        hemis_id = str(payload.get("id") or "").strip()
        if not hemis_id:
            return
            
        username = f"teacher_{hemis_id}"
        user, _ = User.objects.get_or_create(username=username)
        user.role = User.Role.TEACHER
        user.save()

        teacher_profile, _ = TeacherProfile.objects.get_or_create(user=user)
        teacher_profile.full_name = payload.get("full_name") or ""
        teacher_profile.hemis_id = hemis_id
        teacher_profile.save()

    def _upsert_curriculum(self, payload: dict) -> None:
        hemis_id = payload.get("id")
        if not hemis_id:
            return
        
        snapshot, _ = HemisCurriculumSnapshot.objects.get_or_create(hemis_curriculum_id=hemis_id)
        snapshot.name = payload.get("name") or ""
        snapshot.specialty_code = nested_code(payload.get("specialty"))
        snapshot.specialty_name = nested_name(payload.get("specialty"))
        snapshot.department_code = nested_code(payload.get("department"))
        snapshot.department_name = nested_name(payload.get("department"))
        snapshot.education_type_code = nested_code(payload.get("educationType"))
        snapshot.education_type_name = nested_name(payload.get("educationType"))
        snapshot.education_form_code = nested_code(payload.get("educationForm"))
        snapshot.education_form_name = nested_name(payload.get("educationForm"))
        snapshot.education_year_code = nested_code(payload.get("educationYear"))
        snapshot.education_year_name = nested_name(payload.get("educationYear"))
        snapshot.semester_count = payload.get("semester_count") or 0
        snapshot.active = payload.get("active", True)
        snapshot.raw_payload = payload
        snapshot.save()

    def _upsert_room(self, payload: dict) -> None:
        hemis_id = payload.get("id")
        if not hemis_id:
            return
            
        snapshot, _ = HemisRoomSnapshot.objects.get_or_create(hemis_id=hemis_id)
        snapshot.name = payload.get("name") or ""
        snapshot.code = payload.get("code", "") or ""
        snapshot.building_name = nested_name(payload.get("building"))
        snapshot.capacity = payload.get("capacity") or 0
        snapshot.room_type = nested_name(payload.get("auditoriumType"))
        snapshot.raw_payload = payload
        snapshot.save()
