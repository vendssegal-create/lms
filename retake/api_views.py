import json
import threading
from decimal import Decimal

from django.contrib.auth.decorators import login_required
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET
from django.views.decorators.http import require_POST
from django.utils import timezone
import calendar as cal_module
from datetime import date, datetime as dt

from users.utils.roles import Role, get_user_role
from users.models import StudentProfile
from users.models import TeacherProfile
from hemis.models import (
    HemisSubjectSnapshot,
    HemisStudentSnapshot,
    HemisStudentDebt,
    HemisSyncLog,
    HemisCurriculumSnapshot,
    HemisRoomSnapshot,
    HemisSyncStatus,
)
from hemis.services import RetakeHemisSyncService, HemisAdminSyncService
from django.db import close_old_connections

from .models import (
    PaymentReview,
    PaymentReviewStatus,
    RetakeApplication,
    RetakeApplicationStatus,
    RetakeCycle,
    RetakeCycleStatus,
    RetakeItemStatus,
    WorkflowEvent,
    AssessmentSchedule,
    ExamSheetStatus,
    SubjectGroupStatus,
    ExamSheet,
    ExamSheetEntry,
    RetakeAssessmentConfig,
    RetakeSubjectGroup,
    RetakeApplicationItem,
    RetakeDocument,
    RetakeItemStatus,
    ClassSchedule,
    AssessmentScheduleStatus,
)
from lms.models import ControlType, Section, SectionCompletion
from django.db.models import Count, Prefetch


ALLOWED_RETAKE_ROLES = {
    Role.SUPER_ADMIN,
    Role.REGISTRATOR,
    Role.RET_REGISTRATOR,
    Role.RET_ACCOUNTING,
    Role.RET_SUPERVISOR,
    Role.RET_DB_MANAGER,
    Role.STUDENT,
}

ACCOUNTING_ROLES = {Role.SUPER_ADMIN, Role.RET_ACCOUNTING}
SUPERVISOR_ROLES = {Role.SUPER_ADMIN, Role.RET_SUPERVISOR}
TEACHER_GROUP_ROLES = {Role.SUPER_ADMIN, Role.TEACHER}
EXAM_SHEET_ACCESS_ROLES = {Role.SUPER_ADMIN, Role.TEACHER, Role.RET_DB_MANAGER}
CYCLE_VIEW_ROLES = {Role.SUPER_ADMIN, Role.RET_SUPERVISOR, Role.REGISTRATOR}
CYCLE_MANAGE_ROLES = {Role.SUPER_ADMIN, Role.RET_SUPERVISOR}
GROUP_MANAGE_ROLES = {Role.SUPER_ADMIN, Role.REGISTRATOR, Role.RET_DB_MANAGER}
SCHEDULE_MANAGE_ROLES = {Role.SUPER_ADMIN, Role.RET_DB_MANAGER, Role.RET_REGISTRATOR}
EXAM_CALENDAR_ROLES = {Role.SUPER_ADMIN, Role.RET_DB_MANAGER, Role.RET_REGISTRATOR}
SEARCH_STUDENT_ROLES = {Role.SUPER_ADMIN, Role.REGISTRATOR, Role.RET_REGISTRATOR}
SYNC_ROLES = {Role.SUPER_ADMIN}


def _decimal_to_float(value):
    if value is None:
        return None
    return float(Decimal(str(value)))


def _json_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body)
    except json.JSONDecodeError:
        return {}


def _get_config_ok():
    token = getattr(settings, "HEMIS_BACKEND_API_TOKEN", "").strip()
    base_url = getattr(settings, "HEMIS_REST_BASE_URL", "").strip()
    return bool(token and base_url)


def _serialize_cycle(cycle):
    if not cycle:
        return None
    return {
        "id": cycle.id,
        "name": cycle.name,
        "academic_year": cycle.academic_year,
        "status": cycle.status,
        "status_label": cycle.get_status_display(),
        "starts_at": cycle.starts_at.isoformat() if cycle.starts_at else None,
        "ends_at": cycle.ends_at.isoformat() if cycle.ends_at else None,
        "max_allowed_credits": _decimal_to_float(cycle.max_allowed_credits),
    }


def _parse_cycle_payload(payload, instance=None):
    cycle = instance or RetakeCycle()
    cycle.name = (payload.get("name") or "").strip()
    cycle.academic_year = (payload.get("academic_year") or "").strip()
    cycle.starts_at = (payload.get("starts_at") or "").strip() or None
    cycle.ends_at = (payload.get("ends_at") or "").strip() or None
    cycle.status = (payload.get("status") or cycle.status or RetakeCycleStatus.DRAFT).strip()
    cycle.max_allowed_credits = Decimal(str(payload.get("max_allowed_credits") or "15.00").replace(",", "."))
    cycle.full_clean()
    cycle.save()
    return cycle


def _serialize_retake_group(group):
    return {
        "id": group.id,
        "code": group.code,
        "status": group.status,
        "status_label": group.get_status_display(),
        "capacity": group.capacity,
        "created_at": group.created_at.isoformat(),
        "subject": {
            "id": group.subject_snapshot_id,
            "name": group.subject_snapshot.subject_name,
            "code": group.subject_snapshot.subject_code,
        },
        "cycle": {
            "id": group.cycle_id,
            "name": group.cycle.name,
        },
        "teacher": {
            "id": group.teacher_profile_id,
            "full_name": group.teacher_profile.full_name if group.teacher_profile else "",
        },
        "members_count": group.memberships.count(),
        "assessments_count": group.assessment_schedules.count(),
        "class_schedules_count": group.class_schedules.count(),
        "lms_course_title": group.lms_course.title if group.lms_course else "",
    }


def _serialize_class_schedule(item):
    return {
        "id": item.id,
        "day_of_week": item.day_of_week,
        "start_time": item.start_time.isoformat() if item.start_time else "",
        "end_time": item.end_time.isoformat() if item.end_time else "",
        "room": item.room,
        "start_date": item.start_date.isoformat() if item.start_date else None,
        "end_date": item.end_date.isoformat() if item.end_date else None,
    }


def _serialize_assessment_schedule(item):
    sheet = getattr(item, 'exam_sheet', None)
    return {
        "id": item.id,
        "student_group_name": item.student_group_name,
        "control_type": item.control_type,
        "control_type_label": item.control_type_label,
        "scheduled_at": item.scheduled_at.isoformat() if item.scheduled_at else None,
        "pair_number": item.pair_number,
        "pair_label": item.pair_label,
        "room": item.room,
        "status": item.status,
        "status_label": item.get_status_display(),
        "teacher_name": item.teacher_profile.full_name if item.teacher_profile else "",
        "teacher": {
            "id": item.teacher_profile.id,
            "full_name": item.teacher_profile.full_name,
        } if item.teacher_profile else None,
        "exam_sheet": {
            "id": sheet.id,
            "sheet_no": sheet.sheet_no,
            "status": sheet.status,
            "status_label": sheet.get_status_display(),
            "entries_count": sheet.entries.count(),
            "graded_count": sheet.entries.filter(score__isnull=False).count(),
        } if sheet else None,
    }


def _serialize_student_snapshot(student):
    return {
        "id": student.id,
        "hemis_student_id": student.hemis_student_id,
        "full_name": student.full_name,
        "short_name": student.short_name,
        "student_id_number": student.student_id_number,
        "pinfl": student.pinfl,
        "group_name": student.group_name,
        "faculty_name": student.faculty_name,
        "specialty_name": student.specialty_name,
        "semester_code": student.semester_code,
        "semester_name": student.semester_name,
        "email": student.email,
        "phone": student.phone,
        "synced_at": student.synced_at.isoformat() if student.synced_at else None,
    }


def _serialize_student_debt(debt):
    return {
        "id": debt.id,
        "subject_name": debt.subject_snapshot.subject_name,
        "subject_code": debt.subject_snapshot.subject_code,
        "credit": _decimal_to_float(debt.subject_snapshot.credit),
        "semester_label": debt.semester_label or debt.subject_snapshot.semester_name,
        "exam_type_label": debt.exam_type_label,
        "control_type": debt.control_type,
        "debt_status": debt.debt_status,
        "total_point": _decimal_to_float(debt.total_point),
        "grade": _decimal_to_float(debt.grade),
        "required_point": _decimal_to_float(debt.required_point),
        "is_active": debt.is_active,
        "status_tag": debt.debt_status,
    }


def _serialize_sync_log(item):
    return {
        "id": item.id,
        "scope": item.scope,
        "status": item.status,
        "status_label": item.get_status_display() if hasattr(item, "get_status_display") else item.status,
        "started_at": item.started_at.isoformat() if item.started_at else None,
        "finished_at": item.finished_at.isoformat() if item.finished_at else None,
        "processed_count": item.processed_count,
        "message": item.message,
        "summary": item.summary,
        "initiated_by": item.initiated_by.get_full_name() or item.initiated_by.username if item.initiated_by else "System",
    }


def _serialize_application(application):
    item_count = application.items.count()
    approved_count = sum(1 for item in application.items.all() if item.status in {
        "approved_for_grouping",
        "grouped",
        "scheduled",
        "grade_entry_open",
        "completed",
    })
    return {
        "id": application.id,
        "status": application.status,
        "status_label": application.get_status_display(),
        "student": {
            "id": application.student_snapshot_id,
            "full_name": application.student_snapshot.full_name,
            "student_id_number": application.student_snapshot.student_id_number,
            "faculty_name": application.student_snapshot.faculty_name,
            "group_name": application.student_snapshot.group_name,
        },
        "cycle": _serialize_cycle(application.cycle),
        "declared_amount": _decimal_to_float(application.declared_amount),
        "accountant_amount": _decimal_to_float(application.accountant_amount),
        "total_credit": _decimal_to_float(application.total_credit),
        "item_count": item_count,
        "approved_item_count": approved_count,
        "contract_attached": application.contract_attached,
        "contract_url": application.contract_file.url if application.contract_file else None,
        "contract_original_name": application.contract_original_name,
        "receipt_attached": application.receipt_attached,
        "receipt_url": application.receipt_file.url if application.receipt_file else None,
        "receipt_original_name": application.receipt_original_name,
        "can_edit": application.status in [RetakeApplicationStatus.DRAFT, RetakeApplicationStatus.RETURNED],
        "can_move_to_supervisor": application.can_move_to_supervisor,
        "submitted_at": application.submitted_at.isoformat() if application.submitted_at else None,
        "created_at": application.created_at.isoformat(),
        "updated_at": application.updated_at.isoformat(),
    }


def _serialize_application_detail(application):
    return {
        **_serialize_application(application),
        "notes": application.notes,
        "accountant_comment": application.accountant_comment,
        "items": [
            {
                "id": item.id,
                "subject_name": item.subject_snapshot.subject_name,
                "subject_code": item.subject_snapshot.subject_code,
                "credit": _decimal_to_float(item.subject_snapshot.credit),
                "required_control_type": item.required_control_type,
                "status": item.status,
                "status_label": item.get_status_display(),
                "amount": _decimal_to_float(item.amount),
                "payment_date": item.payment_date.isoformat() if item.payment_date else None,
            }
            for item in application.items.all()
        ],
        "workflow_events": [
            {
                "id": event.id,
                "action": event.action,
                "from_status": event.from_status,
                "to_status": event.to_status,
                "comment": event.comment,
                "actor_name": event.actor.get_full_name() or event.actor.username if event.actor else "System",
                "created_at": event.created_at.isoformat(),
            }
            for event in WorkflowEvent.objects.filter(
                entity_type="retake_application", object_id=application.id
            ).select_related("actor").order_by("-created_at")
        ],
    }


def _serialize_retake_document(doc):
    return {
        "id": doc.id,
        "document_type": doc.document_type,
        "url": doc.file.url if doc.file else None,
        "original_name": doc.original_name or "",
        "created_at": doc.created_at.isoformat(),
    }


def _serialize_application_with_items_and_docs(application):
    """Ariza + fanlar bo'yicha biriktirilgan PDF/hujjatlar (talaba profili uchun)."""
    data = _serialize_application(application)
    data["items"] = [
        {
            "id": item.id,
            "subject_name": item.subject_snapshot.subject_name,
            "subject_code": item.subject_snapshot.subject_code,
            "credit": _decimal_to_float(item.subject_snapshot.credit),
            "required_control_type": item.required_control_type,
            "status": item.status,
            "status_label": item.get_status_display(),
            "amount": _decimal_to_float(item.amount),
            "payment_date": item.payment_date.isoformat() if item.payment_date else None,
            "documents": [_serialize_retake_document(d) for d in item.documents.all()],
        }
        for item in application.items.all()
    ]
    return data


def _require_retake_access(request):
    role = get_user_role(request.user, request.session)
    if role not in ALLOWED_RETAKE_ROLES:
        return None, JsonResponse({"error": "Retake moduliga kirish huquqi yo'q."}, status=403)
    return role, None


def _create_workflow_event(application, action, from_status, to_status, actor, comment=""):
    WorkflowEvent.objects.create(
        entity_type="retake_application",
        object_id=application.id,
        action=action,
        from_status=from_status,
        to_status=to_status,
        actor=actor,
        comment=comment,
    )


def _serialize_teacher_assessment(schedule):
    sheet = getattr(schedule, "exam_sheet", None)
    members_count = schedule.group.memberships.count()
    entered_count = sheet.entries.filter(score__isnull=False).count() if sheet else 0
    absent_count = sheet.entries.filter(is_absent=True).count() if sheet else 0

    return {
        "id": schedule.id,
        "control_type": schedule.control_type,
        "control_type_label": schedule.control_type_label,
        "scheduled_at": schedule.scheduled_at.isoformat() if schedule.scheduled_at else None,
        "pair_label": schedule.pair_label,
        "room": schedule.room,
        "status": schedule.status,
        "status_label": schedule.get_status_display(),
        "teacher": {
            "full_name": schedule.teacher_profile.full_name if schedule.teacher_profile else "",
        },
        "group": {
            "id": schedule.group.id,
            "code": schedule.group.code,
            "status": schedule.group.status,
            "status_label": schedule.group.get_status_display(),
            "capacity": schedule.group.capacity,
            "members_count": members_count,
            "subject_name": schedule.group.subject_snapshot.subject_name,
            "subject_code": schedule.group.subject_snapshot.subject_code,
            "cycle_name": schedule.group.cycle.name,
            "lms_course_title": schedule.group.lms_course.title if schedule.group.lms_course else "",
        },
        "sheet": {
            "id": sheet.id if sheet else None,
            "sheet_no": sheet.sheet_no if sheet else "",
            "status": sheet.status if sheet else "",
            "status_label": sheet.get_status_display() if sheet else "",
            "entered_count": entered_count,
            "absent_count": absent_count,
            "total_count": members_count,
        } if sheet else None,
    }


def _get_user_from_snapshot(snapshot):
    student_profile = StudentProfile.objects.filter(student_id_number=snapshot.student_id_number).select_related("user").first()
    return student_profile.user if student_profile and student_profile.user_id else None


def _serialize_exam_sheet(sheet, request_user):
    schedule = sheet.assessment_schedule
    group = schedule.group
    lms_course = group.lms_course

    config = RetakeAssessmentConfig.objects.filter(control_type=schedule.control_type).first()
    max_score = _decimal_to_float(config.max_score) if config else 100
    config_active = config.is_active if config else True

    membership_ids = list(sheet.entries.values_list("group_membership_id", flat=True))
    all_related_entries = ExamSheetEntry.objects.filter(
        group_membership_id__in=membership_ids,
        sheet__assessment_schedule__group=group,
    ).select_related("sheet__assessment_schedule").exclude(sheet=sheet)

    cross_scores = {}
    for related in all_related_entries:
        membership_id = related.group_membership_id
        control_type = related.sheet.assessment_schedule.control_type
        if membership_id not in cross_scores:
            cross_scores[membership_id] = {"jn": 0.0, "on": 0.0}
        if control_type in ["current", "1-jn", "2-jn"]:
            cross_scores[membership_id]["jn"] += float(related.score or 0)
        elif control_type in ["midterm", "1-on", "2-on"]:
            cross_scores[membership_id]["on"] += float(related.score or 0)

    published_sections_count = Section.objects.filter(course=lms_course, is_published=True).count() if lms_course else 0

    entries_payload = []
    grad_5 = grad_4 = grad_3 = grad_2 = grad_absent = 0
    for entry in sheet.entries.select_related("student_snapshot").order_by("student_snapshot__full_name"):
        student_user = _get_user_from_snapshot(entry.student_snapshot) if lms_course else None
        completed_sections_count = (
            SectionCompletion.objects.filter(student=student_user, section__course=lms_course).count()
            if student_user and lms_course
            else 0
        )
        is_course_finished = completed_sections_count >= published_sections_count if published_sections_count > 0 else True

        if entry.is_absent:
            grad_absent += 1
        elif entry.score is not None:
            score_value = float(entry.score)
            if score_value >= 86:
                grad_5 += 1
            elif score_value >= 71:
                grad_4 += 1
            elif score_value >= 60:
                grad_3 += 1
            else:
                grad_2 += 1

        entries_payload.append({
            "id": entry.id,
            "student_snapshot_id": entry.student_snapshot_id,
            "membership_id": entry.group_membership_id,
            "full_name": entry.student_snapshot.full_name,
            "student_id_number": entry.student_snapshot.student_id_number,
            "group_name": entry.student_snapshot.group_name,
            "faculty_name": entry.student_snapshot.faculty_name,
            "score": _decimal_to_float(entry.score),
            "is_absent": entry.is_absent,
            "entered_at": entry.entered_at.isoformat() if entry.entered_at else None,
            "completion": {
                "completed": completed_sections_count,
                "total": published_sections_count,
                "is_finished": is_course_finished,
            },
            "cross_scores": cross_scores.get(entry.group_membership_id, {"jn": 0.0, "on": 0.0}),
        })

    active_role = get_user_role(request_user, request_user.session if hasattr(request_user, "session") else None)
    can_unlock = active_role in [Role.SUPER_ADMIN, Role.RET_DB_MANAGER]
    can_edit = sheet.status != ExamSheetStatus.LOCKED or can_unlock

    return {
        "sheet": {
            "id": sheet.id,
            "sheet_no": sheet.sheet_no,
            "status": sheet.status,
            "status_label": sheet.get_status_display(),
            "opened_at": sheet.opened_at.isoformat() if sheet.opened_at else None,
            "submitted_at": sheet.submitted_at.isoformat() if sheet.submitted_at else None,
            "locked_at": sheet.locked_at.isoformat() if sheet.locked_at else None,
            "max_score": max_score,
            "can_edit": can_edit,
            "can_unlock": can_unlock,
            "config_active": config_active,
        },
        "schedule": {
            "id": schedule.id,
            "control_type": schedule.control_type,
            "control_type_label": schedule.control_type_label,
            "scheduled_at": schedule.scheduled_at.isoformat() if schedule.scheduled_at else None,
            "pair_number": schedule.pair_number,
            "pair_label": schedule.pair_label,
            "room": schedule.room,
            "status": schedule.status,
            "status_label": schedule.get_status_display(),
        },
        "group": {
            "id": group.id,
            "code": group.code,
            "status": group.status,
            "status_label": group.get_status_display(),
            "capacity": group.capacity,
            "cycle_name": group.cycle.name,
            "subject_name": group.subject_snapshot.subject_name,
            "subject_code": group.subject_snapshot.subject_code,
            "lms_course_title": group.lms_course.title if group.lms_course else "",
        },
        "stats": {
            "total": len(entries_payload),
            "present": sum(1 for item in entries_payload if not item["is_absent"]),
            "absent": grad_absent,
            "graded": sum(1 for item in entries_payload if item["score"] is not None),
            "count_5": grad_5,
            "count_4": grad_4,
            "count_3": grad_3,
            "count_2": grad_2,
        },
        "entries": entries_payload,
    }


def _application_queryset_for_role(request, role):
    queryset = RetakeApplication.objects.select_related(
        "student_snapshot", "cycle"
    ).prefetch_related("items", "items__subject_snapshot").order_by("-updated_at")

    cycle_id = request.GET.get("cycle_id", "").strip()
    if cycle_id.isdigit():
        queryset = queryset.filter(cycle_id=int(cycle_id))
    else:
        active_cycle = RetakeCycle.objects.filter(status=RetakeCycleStatus.OPEN).first()
        if active_cycle:
            queryset = queryset.filter(cycle=active_cycle)

    if role == Role.RET_ACCOUNTING:
        queryset = queryset.filter(status=RetakeApplicationStatus.IN_REVIEW)
    elif role == Role.RET_SUPERVISOR:
        queryset = queryset.filter(status=RetakeApplicationStatus.PARTIALLY_APPROVED)
    elif role == Role.STUDENT:
        profile = getattr(request.user, "student_profile", None)
        student_id_number = getattr(profile, "student_id_number", "")
        queryset = queryset.filter(student_snapshot__student_id_number=student_id_number) if student_id_number else queryset.none()
    elif role == Role.RET_REGISTRATOR:
        from retake.utils.service_registrator_utils import get_service_registrator_faculties

        queryset = queryset.filter(created_by=request.user)
        faculties = get_service_registrator_faculties(request.user, request.session)
        if not faculties:
            queryset = queryset.none()
        else:
            queryset = queryset.filter(student_snapshot__faculty_name__in=faculties)

    query = request.GET.get("q", "").strip()
    if query:
        queryset = queryset.filter(
            Q(student_snapshot__full_name__icontains=query) |
            Q(student_snapshot__student_id_number__icontains=query)
        )

    status_filter = request.GET.get("status", "").strip()
    if status_filter:
        queryset = queryset.filter(status=status_filter)

    faculty_filter = request.GET.get("faculty", "").strip()
    if faculty_filter:
        queryset = queryset.filter(student_snapshot__faculty_name=faculty_filter)

    group_filter = request.GET.get("group", "").strip()
    if group_filter:
        queryset = queryset.filter(student_snapshot__group_name=group_filter)

    return queryset


@login_required
@require_GET
def teacher_groups_list(request):
    role = get_user_role(request.user, request.session)
    if role not in TEACHER_GROUP_ROLES:
        return JsonResponse({"error": "Teacher groups bo'limiga kirish huquqi yo'q."}, status=403)

    queryset = AssessmentSchedule.objects.select_related(
        "group",
        "group__cycle",
        "group__subject_snapshot",
        "group__teacher_profile",
        "group__lms_course",
        "teacher_profile",
        "exam_sheet",
    ).prefetch_related("group__memberships", "exam_sheet__entries").order_by("-scheduled_at")

    if role == Role.TEACHER:
        teacher_profile = getattr(request.user, "teacher_profile", None)
        if not teacher_profile:
            queryset = queryset.none()
        else:
            queryset = queryset.filter(Q(group__teacher_profile=teacher_profile) | Q(teacher_profile=teacher_profile))

    control_type = (request.GET.get("control_type") or "").strip()
    if control_type:
        queryset = queryset.filter(control_type=control_type)

    group_status = (request.GET.get("group_status") or "").strip()
    if group_status:
        queryset = queryset.filter(group__status=group_status)

    search = (request.GET.get("q") or "").strip()
    if search:
        queryset = queryset.filter(
            Q(group__code__icontains=search)
            | Q(group__subject_snapshot__subject_name__icontains=search)
            | Q(group__subject_snapshot__subject_code__icontains=search)
            | Q(group__cycle__name__icontains=search)
        )

    items = list(queryset[:100])
    return JsonResponse({
        "role": role,
        "summary": {
            "total": len(items),
            "open_sheets": sum(1 for item in items if getattr(item, "exam_sheet", None) and item.exam_sheet.status == ExamSheetStatus.OPEN),
            "locked_sheets": sum(1 for item in items if getattr(item, "exam_sheet", None) and item.exam_sheet.status == ExamSheetStatus.LOCKED),
            "active_groups": sum(1 for item in items if item.group.status == SubjectGroupStatus.ACTIVE),
        },
        "filters": {
            "control_types": [
                {"value": value, "label": label}
                for value, label in AssessmentSchedule.CONTROL_TYPE_LABELS.items()
            ],
            "group_statuses": [
                {"value": value, "label": label}
                for value, label in SubjectGroupStatus.choices
            ],
        },
        "items": [_serialize_teacher_assessment(item) for item in items],
    })


@login_required
@require_GET
def exam_sheet_detail(request, sheet_id):
    role = get_user_role(request.user, request.session)
    if role not in EXAM_SHEET_ACCESS_ROLES:
        return JsonResponse({"error": "Exam sheet bo'limiga kirish huquqi yo'q."}, status=403)

    queryset = ExamSheet.objects.select_related(
        "assessment_schedule",
        "assessment_schedule__group",
        "assessment_schedule__group__cycle",
        "assessment_schedule__group__subject_snapshot",
        "assessment_schedule__group__lms_course",
    ).prefetch_related("entries", "entries__student_snapshot")

    sheet = get_object_or_404(queryset, id=sheet_id)
    teacher_profile = getattr(request.user, "teacher_profile", None)
    if role == Role.TEACHER and teacher_profile:
        schedule = sheet.assessment_schedule
        if schedule.teacher_profile_id != teacher_profile.id and schedule.group.teacher_profile_id != teacher_profile.id:
          return JsonResponse({"error": "Bu exam sheet sizga tegishli emas."}, status=403)

    if role == Role.TEACHER and not teacher_profile:
        return JsonResponse({"error": "Teacher profile topilmadi."}, status=403)

    if not _serialize_exam_sheet(sheet, request.user)["sheet"]["config_active"]:
        return JsonResponse({"error": f"{sheet.assessment_schedule.control_type_label} hozirda nofaol holatda."}, status=400)

    return JsonResponse(_serialize_exam_sheet(sheet, request.user))


@login_required
@require_POST
def exam_sheet_save(request, sheet_id):
    role = get_user_role(request.user, request.session)
    if role not in EXAM_SHEET_ACCESS_ROLES:
        return JsonResponse({"error": "Exam sheet ni saqlash huquqi yo'q."}, status=403)

    sheet = get_object_or_404(
        ExamSheet.objects.select_related(
            "assessment_schedule",
            "assessment_schedule__group",
            "assessment_schedule__group__lms_course",
        ).prefetch_related("entries", "entries__student_snapshot"),
        id=sheet_id,
    )
    schedule = sheet.assessment_schedule
    group = schedule.group

    teacher_profile = getattr(request.user, "teacher_profile", None)
    if role == Role.TEACHER:
        if not teacher_profile:
            return JsonResponse({"error": "Teacher profile topilmadi."}, status=403)
        if schedule.teacher_profile_id != teacher_profile.id and group.teacher_profile_id != teacher_profile.id:
            return JsonResponse({"error": "Bu exam sheet sizga tegishli emas."}, status=403)

    payload = _json_body(request)
    action = (payload.get("action") or "save").strip()
    entries_payload = payload.get("entries") or []

    if sheet.status == ExamSheetStatus.LOCKED and role not in [Role.SUPER_ADMIN, Role.RET_DB_MANAGER]:
        return JsonResponse({"error": "Ushbu qaydnoma yopilgan."}, status=400)

    warnings = []
    with transaction.atomic():
        if action == "unlock":
            if role not in [Role.SUPER_ADMIN, Role.RET_DB_MANAGER]:
                return JsonResponse({"error": "Unlock qilish huquqi yo'q."}, status=403)
            old_status = sheet.status
            sheet.status = ExamSheetStatus.OPEN
            sheet.locked_at = None
            sheet.save(update_fields=["status", "locked_at"])
            WorkflowEvent.objects.create(
                entity_type="ExamSheet",
                object_id=sheet.id,
                action="unlock_sheet",
                from_status=old_status,
                to_status=ExamSheetStatus.OPEN,
                actor=request.user,
                comment="Qaydnoma SPA orqali ochildi.",
            )
        else:
            entries_map = {item.id: item for item in sheet.entries.all()}
            lms_course = group.lms_course
            published_sections_count = Section.objects.filter(course=lms_course, is_published=True).count() if lms_course else 0

            for item in entries_payload:
                entry_id = item.get("id")
                entry = entries_map.get(entry_id)
                if not entry:
                    continue

                is_absent = bool(item.get("is_absent"))
                score_raw = item.get("score")

                student_user = _get_user_from_snapshot(entry.student_snapshot) if lms_course else None
                completed_sections_count = (
                    SectionCompletion.objects.filter(student=student_user, section__course=lms_course).count()
                    if student_user and lms_course
                    else 0
                )
                if lms_course and score_raw not in (None, "",) and not is_absent and published_sections_count > 0 and completed_sections_count < published_sections_count:
                    warnings.append(f"{entry.student_snapshot.full_name} kursni tugatmagan. Baho saqlanmadi.")
                    continue

                try:
                    score = float(score_raw) if score_raw not in (None, "") and not is_absent else 0 if is_absent else None
                except (TypeError, ValueError):
                    score = None

                entry.score = score
                entry.is_absent = is_absent
                entry.entered_by = request.user
                entry.entered_at = timezone.now()
                entry.save(update_fields=["score", "is_absent", "entered_by", "entered_at"])

            if action == "submit":
                old_status = sheet.status
                if schedule.control_type == ControlType.FINAL:
                    sheet.status = ExamSheetStatus.LOCKED
                    sheet.locked_at = timezone.now()
                    sheet.submitted_at = timezone.now()
                else:
                    sheet.status = ExamSheetStatus.SUBMITTED
                    sheet.submitted_at = timezone.now()
                sheet.save(update_fields=["status", "locked_at", "submitted_at"])
                WorkflowEvent.objects.create(
                    entity_type="ExamSheet",
                    object_id=sheet.id,
                    action="lock_sheet",
                    from_status=old_status,
                    to_status=sheet.status,
                    actor=request.user,
                    comment="Qaydnoma SPA orqali yakunlandi.",
                )

    response = _serialize_exam_sheet(sheet, request.user)
    response["success"] = True
    response["warnings"] = warnings
    return JsonResponse(response)


@login_required
@require_GET
def dashboard_stats(request):
    role = get_user_role(request.user, request.session)
    if role not in ALLOWED_RETAKE_ROLES:
        return JsonResponse({"error": "Kirish huquqi yo'q."}, status=403)

    qs = RetakeApplication.objects.all()

    # Rol bo'yicha qo'shimcha filtr
    if role == Role.RET_REGISTRATOR:
        qs = qs.filter(created_by=request.user)
    elif role == Role.RET_ACCOUNTING:
        # Buxgalteriya faqat o'z vazifasiga tegishli arizalarni ko'radi
        qs = qs.filter(status__in=[
            RetakeApplicationStatus.IN_REVIEW,
            RetakeApplicationStatus.PARTIALLY_APPROVED,
            RetakeApplicationStatus.RETURNED,
        ])
    elif role == Role.RET_SUPERVISOR:
        qs = qs.filter(status__in=[
            RetakeApplicationStatus.PARTIALLY_APPROVED,
            RetakeApplicationStatus.APPROVED,
            RetakeApplicationStatus.RETURNED,
        ])

    total = qs.count()

    # Rol bo'yicha stats hisoblash
    if role == Role.RET_ACCOUNTING:
        stat1_count = qs.filter(status=RetakeApplicationStatus.IN_REVIEW).count()
        stat2_count = qs.filter(status=RetakeApplicationStatus.PARTIALLY_APPROVED).count()
        stat3_count = qs.filter(status=RetakeApplicationStatus.RETURNED).count()
        stat4_count = qs.filter(
            items__status=RetakeItemStatus.PAYMENT_REJECTED
        ).distinct().count()
        stats = {
            "total": total,
            "stat1": stat1_count,  "stat1_label": "Ko'rib chiqish kutilmoqda",
            "stat2": stat2_count,  "stat2_label": "Boshliq tasdig'ida",
            "stat3": stat3_count,  "stat3_label": "Qaytarilgan",
            "stat4": stat4_count,  "stat4_label": "To'lov rad etilgan",
        }
        recent_order = "-updated_at" if hasattr(RetakeApplication, "updated_at") else "-created_at"
    elif role == Role.RET_SUPERVISOR:
        stat1_count = qs.filter(status=RetakeApplicationStatus.PARTIALLY_APPROVED).count()
        stat2_count = qs.filter(status=RetakeApplicationStatus.APPROVED).count()
        stat3_count = qs.filter(status=RetakeApplicationStatus.RETURNED).count()
        stat4_count = qs.filter(status=RetakeApplicationStatus.COMPLETED).count()
        stats = {
            "total": total,
            "stat1": stat1_count,  "stat1_label": "Tasdiqlash kutilmoqda",
            "stat2": stat2_count,  "stat2_label": "Tasdiqlangan",
            "stat3": stat3_count,  "stat3_label": "Qaytarilgan",
            "stat4": stat4_count,  "stat4_label": "Yakunlangan",
        }
        recent_order = "-created_at"
    else:
        # RET_REGISTRATOR, RET_DB_MANAGER, SUPER_ADMIN va boshqalar
        stat1_count = qs.filter(
            items__status=RetakeItemStatus.SUBMITTED_TO_ACCOUNTING
        ).distinct().count()
        stat2_count = qs.filter(
            items__status=RetakeItemStatus.AWAITING_SUPERVISOR
        ).distinct().count()
        stat3_count = qs.filter(status=RetakeApplicationStatus.COMPLETED).count()
        stat4_count = qs.filter(
            items__status__in=[
                RetakeItemStatus.PAYMENT_REJECTED,
                RetakeItemStatus.SUPERVISOR_RETURNED,
            ]
        ).distinct().count()
        stats = {
            "total": total,
            "stat1": stat1_count,  "stat1_label": "To'lov kutilmoqda",
            "stat2": stat2_count,  "stat2_label": "Boshliq tasdig'ida",
            "stat3": stat3_count,  "stat3_label": "Yakunlangan",
            "stat4": stat4_count,  "stat4_label": "Qaytarilgan",
        }
        recent_order = "-created_at"

    recent_qs = qs.select_related("cycle").order_by(recent_order)[:10]
    recent = []
    for app in recent_qs:
        student = app.student_snapshot or {}
        recent.append({
            "id": app.id,
            "student_name": student.get("full_name", "") if isinstance(student, dict) else str(student),
            "cycle_name": app.cycle.name if app.cycle else "",
            "status": app.status,
            "status_label": app.get_status_display(),
            "created_at": app.created_at.isoformat(),
        })

    return JsonResponse({
        "stats": stats,
        "recent_applications": recent,
    })


@login_required
@require_GET
def cycles_list(request):
    role = get_user_role(request.user, request.session)
    if role not in CYCLE_VIEW_ROLES:
        return JsonResponse({"error": "Cycle bo'limiga kirish huquqi yo'q."}, status=403)

    items = list(RetakeCycle.objects.all().order_by("-created_at")[:100])
    return JsonResponse({
        "role": role,
        "permissions": {
            "can_manage": role in CYCLE_MANAGE_ROLES,
        },
        "statuses": [{"value": value, "label": label} for value, label in RetakeCycleStatus.choices],
        "items": [
            {
                **_serialize_cycle(item),
                "applications_count": item.applications.count(),
                "groups_count": item.groups.count(),
            }
            for item in items
        ],
    })


@login_required
@require_POST
def cycles_create(request):
    role = get_user_role(request.user, request.session)
    if role not in CYCLE_MANAGE_ROLES:
        return JsonResponse({"error": "Cycle yaratish huquqi yo'q."}, status=403)

    payload = _json_body(request)
    try:
        cycle = _parse_cycle_payload(payload)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    return JsonResponse({
        "success": True,
        "cycle": {
            **_serialize_cycle(cycle),
            "applications_count": cycle.applications.count(),
            "groups_count": cycle.groups.count(),
        },
    })


@login_required
@require_POST
def cycles_update(request, cycle_id):
    role = get_user_role(request.user, request.session)
    if role not in CYCLE_MANAGE_ROLES:
        return JsonResponse({"error": "Cycle tahrirlash huquqi yo'q."}, status=403)

    cycle = get_object_or_404(RetakeCycle, id=cycle_id)
    payload = _json_body(request)
    try:
        cycle = _parse_cycle_payload(payload, instance=cycle)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    return JsonResponse({
        "success": True,
        "cycle": {
            **_serialize_cycle(cycle),
            "applications_count": cycle.applications.count(),
            "groups_count": cycle.groups.count(),
        },
    })


@login_required
@require_GET
def groups_list(request):
    role = get_user_role(request.user, request.session)
    if role not in GROUP_MANAGE_ROLES:
        return JsonResponse({"error": "Groups bo'limiga kirish huquqi yo'q."}, status=403)

    from retake.utils.db_manager_utils import get_db_manager_faculties, filter_groups_by_faculty

    cycle_id = (request.GET.get("cycle_id") or "").strip()
    cycle = RetakeCycle.objects.filter(id=cycle_id).first() if cycle_id.isdigit() else RetakeCycle.objects.filter(status=RetakeCycleStatus.OPEN).first()
    groups_qs = (
        RetakeSubjectGroup.objects.filter(cycle=cycle).select_related("cycle", "subject_snapshot", "teacher_profile", "lms_course")
        .prefetch_related("memberships", "assessment_schedules", "class_schedules")
        if cycle
        else RetakeSubjectGroup.objects.none()
    )

    groups_qs = filter_groups_by_faculty(groups_qs, request.user, request.session)

    teachers = TeacherProfile.objects.all().order_by("full_name")

    pending_items_qs = RetakeApplicationItem.objects.filter(status=RetakeItemStatus.APPROVED_FOR_GROUPING)
    faculties = get_db_manager_faculties(request.user, request.session)
    if faculties is not None:
        pending_items_qs = pending_items_qs.filter(
            application__student_snapshot__faculty_name__in=faculties
        )
    pending_subjects = (
        pending_items_qs
        .values("subject_snapshot_id", "subject_snapshot__subject_name", "subject_snapshot__subject_code")
        .annotate(items_count=Count("id"))
        .order_by("subject_snapshot__subject_name")
    )

    assigned_faculties = faculties if faculties is not None else []

    return JsonResponse({
        "role": role,
        "selected_cycle": _serialize_cycle(cycle),
        "cycles": [_serialize_cycle(item) for item in RetakeCycle.objects.all().order_by("-created_at")[:50]],
        "groups": [_serialize_retake_group(group) for group in groups_qs.order_by("-created_at")[:100]],
        "teachers": [
            {"id": teacher.id, "full_name": teacher.full_name}
            for teacher in teachers
        ],
        "subject_statuses": [{"value": value, "label": label} for value, label in SubjectGroupStatus.choices],
        "pending_subjects": [
            {
                "subject_id": item["subject_snapshot_id"],
                "subject_name": item["subject_snapshot__subject_name"],
                "subject_code": item["subject_snapshot__subject_code"],
                "items_count": item["items_count"],
            }
            for item in pending_subjects
        ],
        "assigned_faculties": assigned_faculties,
    })


@login_required
@require_POST
def groups_create(request):
    role = get_user_role(request.user, request.session)
    if role not in GROUP_MANAGE_ROLES:
        return JsonResponse({"error": "Group yaratish huquqi yo'q."}, status=403)

    payload = _json_body(request)
    cycle = RetakeCycle.objects.filter(status=RetakeCycleStatus.OPEN).first()
    if not cycle:
        return JsonResponse({"error": "Faol retake cycle topilmadi."}, status=400)

    subject_id = payload.get("subject_id")
    code = (payload.get("code") or "").strip()
    teacher_id = payload.get("teacher_id")
    capacity = int(payload.get("capacity") or 0)

    if not code:
        return JsonResponse({"error": "Guruh kodi kiritilishi shart."}, status=400)
    if RetakeSubjectGroup.objects.filter(cycle=cycle, code=code).exists():
        return JsonResponse({"error": f"'{code}' kodli guruh allaqachon mavjud."}, status=400)

    subject = get_object_or_404(HemisSubjectSnapshot, id=subject_id)
    group = RetakeSubjectGroup.objects.create(
        cycle=cycle,
        subject_snapshot=subject,
        code=code,
        teacher_profile_id=teacher_id or None,
        capacity=capacity,
        created_by=request.user,
        status=SubjectGroupStatus.ACTIVE,
    )
    return JsonResponse({"success": True, "group": _serialize_retake_group(group)})


@login_required
@require_POST
def groups_update(request, group_id):
    role = get_user_role(request.user, request.session)
    if role not in GROUP_MANAGE_ROLES:
        return JsonResponse({"error": "Group tahrirlash huquqi yo'q."}, status=403)

    group = get_object_or_404(RetakeSubjectGroup.objects.select_related("cycle", "subject_snapshot", "teacher_profile", "lms_course"), id=group_id)
    payload = _json_body(request)

    group.teacher_profile_id = payload.get("teacher_id") or None
    group.capacity = int(payload.get("capacity") or group.capacity or 0)
    group.status = (payload.get("status") or group.status).strip()
    group.save()
    return JsonResponse({"success": True, "group": _serialize_retake_group(group)})


@login_required
@require_POST
def groups_delete(request, group_id):
    role = get_user_role(request.user, request.session)
    if role not in {Role.SUPER_ADMIN, Role.RET_DB_MANAGER}:
        return JsonResponse({"error": "Group o'chirish huquqi yo'q."}, status=403)

    group = get_object_or_404(RetakeSubjectGroup, id=group_id)
    for member in group.memberships.select_related("application_item").all():
        member.application_item.status = RetakeItemStatus.APPROVED_FOR_GROUPING
        member.application_item.save(update_fields=["status"])
    group.delete()
    return JsonResponse({"success": True})


@login_required
@require_GET
def schedules_list(request):
    role = get_user_role(request.user, request.session)
    if role not in SCHEDULE_MANAGE_ROLES:
        return JsonResponse({"error": "Schedules bo'limiga kirish huquqi yo'q."}, status=403)

    cycle_id = (request.GET.get("cycle_id") or "").strip()
    cycle = RetakeCycle.objects.filter(id=cycle_id).first() if cycle_id.isdigit() else RetakeCycle.objects.filter(status=RetakeCycleStatus.OPEN).first()
    groups = (
        RetakeSubjectGroup.objects.filter(cycle=cycle)
        .select_related("cycle", "subject_snapshot", "teacher_profile")
        .prefetch_related("class_schedules", "assessment_schedules")
        .order_by("-created_at")
        if cycle
        else RetakeSubjectGroup.objects.none()
    )
    teachers = TeacherProfile.objects.all().order_by("full_name")

    return JsonResponse({
        "role": role,
        "selected_cycle": _serialize_cycle(cycle),
        "cycles": [_serialize_cycle(item) for item in RetakeCycle.objects.all().order_by("-created_at")[:50]],
        "teachers": [{"id": teacher.id, "full_name": teacher.full_name} for teacher in teachers],
        "groups": [
            {
                **_serialize_retake_group(group),
                "class_schedules": [_serialize_class_schedule(item) for item in group.class_schedules.all().order_by("day_of_week", "start_time")],
                "assessments": [_serialize_assessment_schedule(item) for item in group.assessment_schedules.all().order_by("-scheduled_at")],
            }
            for group in groups[:100]
        ],
        "control_types": [
            {"value": value, "label": label}
            for value, label in AssessmentSchedule.CONTROL_TYPE_LABELS.items()
        ],
    })


@login_required
@require_POST
def schedules_create_class(request, group_id):
    role = get_user_role(request.user, request.session)
    if role not in SCHEDULE_MANAGE_ROLES:
        return JsonResponse({"error": "Class schedule yaratish huquqi yo'q."}, status=403)

    group = get_object_or_404(RetakeSubjectGroup, id=group_id)
    payload = _json_body(request)
    try:
        schedule = ClassSchedule.objects.create(
            group=group,
            day_of_week=int(payload.get("day_of_week") or 1),
            start_time=payload.get("start_time"),
            end_time=payload.get("end_time"),
            room=(payload.get("room") or "").strip(),
            start_date=payload.get("start_date"),
            end_date=payload.get("end_date"),
        )
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    return JsonResponse({"success": True, "item": _serialize_class_schedule(schedule)})


@login_required
@require_POST
def schedules_delete_class(request, schedule_id):
    role = get_user_role(request.user, request.session)
    if role not in SCHEDULE_MANAGE_ROLES:
        return JsonResponse({"error": "Class schedule o'chirish huquqi yo'q."}, status=403)

    schedule = get_object_or_404(ClassSchedule, id=schedule_id)
    schedule.delete()
    return JsonResponse({"success": True})


@login_required
@require_POST
def schedules_create_assessment(request, group_id):
    role = get_user_role(request.user, request.session)
    if role not in SCHEDULE_MANAGE_ROLES:
        return JsonResponse({"error": "Assessment yaratish huquqi yo'q."}, status=403)

    group = get_object_or_404(RetakeSubjectGroup, id=group_id)
    payload = _json_body(request)
    try:
        assessment = AssessmentSchedule.objects.create(
            group=group,
            student_group_name=(payload.get("student_group_name") or "").strip(),
            control_type=(payload.get("control_type") or "").strip(),
            scheduled_at=payload.get("scheduled_at"),
            pair_number=int(payload.get("pair_number")) if payload.get("pair_number") not in (None, "") else None,
            room=(payload.get("room") or "").strip(),
            teacher_profile_id=payload.get("teacher_id") or None,
            created_by=request.user,
            status=AssessmentScheduleStatus.OPEN,
        )
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    return JsonResponse({"success": True, "item": _serialize_assessment_schedule(assessment)})


@login_required
@require_POST
def schedules_delete_assessment(request, assessment_id):
    role = get_user_role(request.user, request.session)
    if role not in SCHEDULE_MANAGE_ROLES:
        return JsonResponse({"error": "Assessment o'chirish huquqi yo'q."}, status=403)

    assessment = get_object_or_404(AssessmentSchedule, id=assessment_id)
    assessment.delete()
    return JsonResponse({"success": True})


@login_required
@require_GET
def exam_calendar_view(request):
    role = get_user_role(request.user, request.session)
    if role not in EXAM_CALENDAR_ROLES:
        return JsonResponse({"error": "Exam calendar bo'limiga kirish huquqi yo'q."}, status=403)

    cycle_id = (request.GET.get("cycle_id") or "").strip()
    cycle = RetakeCycle.objects.filter(id=cycle_id).first() if cycle_id.isdigit() else RetakeCycle.objects.filter(status=RetakeCycleStatus.OPEN).first()

    today = date.today()
    year = int(request.GET.get("year", today.year))
    month = int(request.GET.get("month", today.month))
    group_id = (request.GET.get("group_id") or "").strip()

    cal = cal_module.Calendar(firstweekday=0)
    month_days = cal.monthdayscalendar(year, month)

    month_names = {
        1: "Yanvar", 2: "Fevral", 3: "Mart", 4: "Aprel",
        5: "May", 6: "Iyun", 7: "Iyul", 8: "Avgust",
        9: "Sentyabr", 10: "Oktyabr", 11: "Noyabr", 12: "Dekabr",
    }

    assessments = AssessmentSchedule.objects.filter(
        scheduled_at__year=year,
        scheduled_at__month=month,
        group__cycle=cycle,
    ).select_related("group__subject_snapshot", "teacher_profile") if cycle else AssessmentSchedule.objects.none()

    if group_id:
        assessments = assessments.filter(group_id=group_id)

    day_assessments = {}
    for item in assessments:
        day = item.scheduled_at.day
        if day not in day_assessments:
            day_assessments[day] = []
        day_assessments[day].append({
            "id": item.id,
            "group_id": item.group_id,
            "group_code": item.group.code,
            "subject_name": item.group.subject_snapshot.subject_name,
            "control_type": item.control_type,
            "control_type_label": item.control_type_label,
            "scheduled_at": item.scheduled_at.isoformat(),
            "pair_number": item.pair_number,
            "pair_label": item.pair_label,
            "room": item.room,
            "teacher_name": item.teacher_profile.full_name if item.teacher_profile else "",
        })

    groups = RetakeSubjectGroup.objects.filter(
        cycle=cycle, status=SubjectGroupStatus.ACTIVE
    ).select_related("subject_snapshot", "teacher_profile") if cycle else RetakeSubjectGroup.objects.none()

    teachers = TeacherProfile.objects.all().order_by("full_name")

    return JsonResponse({
        "role": role,
        "cycle": _serialize_cycle(cycle),
        "cycles": [_serialize_cycle(item) for item in RetakeCycle.objects.all().order_by("-created_at")[:50]],
        "year": year,
        "month": month,
        "month_name": month_names.get(month, ""),
        "month_days": month_days,
        "day_assessments": day_assessments,
        "groups": [
            {
                "id": group.id,
                "code": group.code,
                "subject_name": group.subject_snapshot.subject_name,
            }
            for group in groups
        ],
        "teachers": [{"id": teacher.id, "full_name": teacher.full_name} for teacher in teachers],
        "control_types": [
            {"value": value, "label": label}
            for value, label in AssessmentSchedule.CONTROL_TYPE_LABELS.items()
        ],
        "pair_times": {
            "1": "08:00",
            "2": "09:30",
            "3": "11:00",
            "4": "13:00",
            "5": "14:30",
            "6": "16:00",
        },
        "selected_group_id": int(group_id) if group_id.isdigit() else None,
    })


@login_required
@require_POST
def exam_calendar_save(request):
    role = get_user_role(request.user, request.session)
    if role not in EXAM_CALENDAR_ROLES:
        return JsonResponse({"error": "Exam calendar o'zgartirish huquqi yo'q."}, status=403)

    payload = _json_body(request)
    action = (payload.get("action") or "create").strip()

    pair_times = {
        "1": "08:00",
        "2": "09:30",
        "3": "11:00",
        "4": "13:00",
        "5": "14:30",
        "6": "16:00",
    }

    if action == "delete":
        assessment_id = payload.get("assessment_id")
        assessment = get_object_or_404(AssessmentSchedule, id=assessment_id)
        assessment.delete()
        return JsonResponse({"success": True})

    group_id = payload.get("group_id")
    control_type = payload.get("control_type")
    teacher_id = payload.get("teacher_id")
    pair_number = payload.get("pair_number")
    room = (payload.get("room") or "").strip()
    exam_date_str = payload.get("exam_date")

    if not group_id or not exam_date_str or not control_type:
        return JsonResponse({"error": "Guruh, sana va nazorat turi kiritilishi shart."}, status=400)

    group = get_object_or_404(RetakeSubjectGroup, id=group_id)
    time_str = pair_times.get(str(pair_number), "09:00")
    scheduled_at = dt.strptime(f"{exam_date_str} {time_str}", "%Y-%m-%d %H:%M")
    teacher_profile = TeacherProfile.objects.filter(id=teacher_id).first() if teacher_id else None

    if action == "edit" and payload.get("assessment_id"):
        assessment = get_object_or_404(AssessmentSchedule, id=payload.get("assessment_id"))
        assessment.group = group
        assessment.control_type = control_type
        assessment.scheduled_at = scheduled_at
        assessment.pair_number = int(pair_number) if pair_number else None
        assessment.room = room
        assessment.teacher_profile = teacher_profile
        assessment.save()
        return JsonResponse({"success": True})

    AssessmentSchedule.objects.create(
        group=group,
        control_type=control_type,
        scheduled_at=scheduled_at,
        pair_number=int(pair_number) if pair_number else None,
        room=room,
        teacher_profile=teacher_profile,
        created_by=request.user,
        status=AssessmentScheduleStatus.OPEN,
    )
    return JsonResponse({"success": True})


@login_required
@require_GET
def applications_list(request):
    role, error_response = _require_retake_access(request)
    if error_response:
        return error_response

    queryset = _application_queryset_for_role(request, role)
    cycle_id = request.GET.get("cycle_id", "").strip()
    selected_cycle = RetakeCycle.objects.filter(id=cycle_id).first() if cycle_id.isdigit() else RetakeCycle.objects.filter(status=RetakeCycleStatus.OPEN).first()

    applications = list(queryset[:50])
    summary_source = queryset

    return JsonResponse({
        "role": role,
        "selected_cycle": _serialize_cycle(selected_cycle),
        "cycles": [_serialize_cycle(cycle) for cycle in RetakeCycle.objects.all().order_by("-created_at")[:20]],
        "summary": {
            "total": summary_source.count(),
            "draft": summary_source.filter(status=RetakeApplicationStatus.DRAFT).count(),
            "in_review": summary_source.filter(status=RetakeApplicationStatus.IN_REVIEW).count(),
            "partially_approved": summary_source.filter(status=RetakeApplicationStatus.PARTIALLY_APPROVED).count(),
            "approved": summary_source.filter(status=RetakeApplicationStatus.APPROVED).count(),
            "completed": summary_source.filter(status=RetakeApplicationStatus.COMPLETED).count(),
            "returned": summary_source.filter(status=RetakeApplicationStatus.RETURNED).count(),
        },
        "filters": {
            "statuses": [
                {"value": value, "label": label}
                for value, label in RetakeApplicationStatus.choices
            ],
            "faculties": list(
                queryset.exclude(student_snapshot__faculty_name="")
                .values_list("student_snapshot__faculty_name", flat=True)
                .distinct()
                .order_by("student_snapshot__faculty_name")
            ),
            "groups": list(
                queryset.exclude(student_snapshot__group_name="")
                .values_list("student_snapshot__group_name", flat=True)
                .distinct()
                .order_by("student_snapshot__group_name")
            ),
        },
        "applications": [_serialize_application(application) for application in applications],
    })


@login_required
@require_GET
def application_detail(request, app_id):
    role, error_response = _require_retake_access(request)
    if error_response:
        return error_response

    queryset = _application_queryset_for_role(request, role)
    application = get_object_or_404(queryset, id=app_id)
    return JsonResponse({"application": _serialize_application_detail(application)})


APPLICATION_EDIT_ROLES = {
    Role.SUPER_ADMIN, Role.REGISTRATOR, Role.RET_REGISTRATOR,
}


@login_required
@require_POST
def application_update(request, app_id):
    """
    Ariza yangilash: declared_amount, notes, shartnoma/chek yuklash,
    va buxgalteriyaga jo'natish.

    multipart/form-data: declared_amount, notes, contract_file, receipt_file, action
    action = 'save' | 'submit_to_accounting'
    """
    role = get_user_role(request.user, request.session)
    if role not in APPLICATION_EDIT_ROLES:
        return JsonResponse({"error": "Ariza tahrirlash huquqi yo'q."}, status=403)

    application = get_object_or_404(_application_queryset_for_role(request, role), id=app_id)

    if application.status not in [RetakeApplicationStatus.DRAFT, RetakeApplicationStatus.RETURNED]:
        return JsonResponse({"error": "Bu ariza faqat qoralama yoki qaytarilgan holatda tahrirlash mumkin."}, status=400)

    action = (request.POST.get("action") or "save").strip()

    declared_amount_str = request.POST.get("declared_amount", "").strip()
    if declared_amount_str:
        try:
            application.declared_amount = Decimal(declared_amount_str.replace(",", "."))
        except Exception:
            return JsonResponse({"error": "Noto'g'ri summa formati."}, status=400)

    notes = request.POST.get("notes")
    if notes is not None:
        application.notes = notes

    if "contract_file" in request.FILES:
        application.contract_file = request.FILES["contract_file"]
        application.contract_original_name = request.FILES["contract_file"].name

    if "receipt_file" in request.FILES:
        application.receipt_file = request.FILES["receipt_file"]
        application.receipt_original_name = request.FILES["receipt_file"].name

    if action == "submit_to_accounting":
        if not application.contract_file:
            return JsonResponse({"error": "Shartnoma fayli yuklanishi shart."}, status=400)
        if not application.receipt_file:
            return JsonResponse({"error": "To'lov cheki yuklanishi shart."}, status=400)
        if not application.declared_amount or application.declared_amount <= 0:
            return JsonResponse({"error": "Shartnoma summasi kiritilishi shart."}, status=400)

        old_status = application.status
        application.status = RetakeApplicationStatus.IN_REVIEW
        application.submitted_at = timezone.now()
        application.save()
        application.items.all().update(status=RetakeItemStatus.SUBMITTED_TO_ACCOUNTING)
        _create_workflow_event(
            application, "submitted", old_status,
            RetakeApplicationStatus.IN_REVIEW, request.user,
            "SPA orqali buxgalteriyaga yuborildi.",
        )
    else:
        application.save()

    return JsonResponse({
        "success": True,
        "application": _serialize_application_detail(application),
    })


@login_required
@require_POST
def application_accounting_action(request, app_id):
    role, error_response = _require_retake_access(request)
    if error_response:
        return error_response
    if role not in ACCOUNTING_ROLES:
        return JsonResponse({"error": "Accounting action uchun huquq yo'q."}, status=403)

    queryset = _application_queryset_for_role(request, role)
    application = get_object_or_404(queryset, id=app_id)
    if application.status != RetakeApplicationStatus.IN_REVIEW:
        return JsonResponse({"error": "Bu ariza accounting ko'rigi bosqichida emas."}, status=400)

    action = (request.POST.get("action") or "").strip()
    comment = (request.POST.get("comment") or "").strip()
    old_status = application.status

    try:
        if action == "approve":
            accountant_amount = Decimal((request.POST.get("accountant_amount") or "0").replace(",", "."))
            if accountant_amount <= 0:
                return JsonResponse({"error": "Buxgalteriya summasi musbat bo'lishi kerak."}, status=400)

            application.accountant_amount = accountant_amount
            application.accountant_comment = comment
            application.status = RetakeApplicationStatus.PARTIALLY_APPROVED
            application.items.all().update(
                status=RetakeItemStatus.AWAITING_SUPERVISOR,
                payment_date=timezone.now().date(),
            )
            for item in application.items.all():
                PaymentReview.objects.create(
                    application_item=item,
                    status=PaymentReviewStatus.APPROVED,
                    checked_by=request.user,
                    comment=comment,
                )
            _create_workflow_event(application, "payment_verified", old_status, application.status, request.user, comment)
        elif action == "reject":
            application.accountant_comment = comment
            application.status = RetakeApplicationStatus.RETURNED
            application.items.all().update(status=RetakeItemStatus.PAYMENT_REJECTED)
            _create_workflow_event(application, "payment_rejected", old_status, application.status, request.user, comment)
        else:
            return JsonResponse({"error": "Noto'g'ri accounting action."}, status=400)

        application.save()
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    return JsonResponse({"success": True, "application": _serialize_application_detail(application)})


@login_required
@require_POST
def application_supervisor_action(request, app_id):
    role, error_response = _require_retake_access(request)
    if error_response:
        return error_response
    if role not in SUPERVISOR_ROLES:
        return JsonResponse({"error": "Supervisor action uchun huquq yo'q."}, status=403)

    queryset = _application_queryset_for_role(request, role)
    application = get_object_or_404(queryset, id=app_id)
    if application.status != RetakeApplicationStatus.PARTIALLY_APPROVED:
        return JsonResponse({"error": "Bu ariza supervisor tasdig'i bosqichida emas."}, status=400)

    action = (request.POST.get("action") or "").strip()
    comment = (request.POST.get("comment") or "").strip()
    old_status = application.status

    if action == "approve":
        application.status = RetakeApplicationStatus.APPROVED
        application.items.all().update(status=RetakeItemStatus.APPROVED_FOR_GROUPING)
        _create_workflow_event(application, "supervisor_approved", old_status, application.status, request.user, comment)
    elif action == "reject":
        application.status = RetakeApplicationStatus.RETURNED
        application.items.all().update(status=RetakeItemStatus.SUPERVISOR_RETURNED)
        _create_workflow_event(application, "supervisor_rejected", old_status, application.status, request.user, comment)
    else:
        return JsonResponse({"error": "Noto'g'ri supervisor action."}, status=400)

    application.save()
    return JsonResponse({"success": True, "application": _serialize_application_detail(application)})


@login_required
@require_GET
def search_students(request):
    role = get_user_role(request.user, request.session)
    if role not in SEARCH_STUDENT_ROLES:
        return JsonResponse({"error": "Talaba qidirish bo'limiga kirish huquqi yo'q."}, status=403)

    query = (request.GET.get("q") or "").strip()
    search_hemis = request.GET.get("hemis") == "1"
    students = []
    warning = None

    if query:
        clean_query = query[8:] if query.lower().startswith("student_") else query
        students = list(
            HemisStudentSnapshot.objects.filter(
                Q(full_name__icontains=clean_query)
                | Q(student_id_number__icontains=clean_query)
                | Q(pinfl__icontains=clean_query)
            ).order_by("full_name")[:50]
        )

        if (not students or search_hemis) and len(clean_query) >= 3:
            service = RetakeHemisSyncService()
            try:
                if clean_query.isdigit():
                    student = service.sync_student(student_id_number=clean_query, sync_debts=False)
                    if student:
                        students = [student]
            except Exception as exc:
                warning = f"HEMIS qidiruvida xatolik: {str(exc)}"

    if role == Role.RET_REGISTRATOR:
        from retake.utils.service_registrator_utils import get_service_registrator_faculties

        faculties = get_service_registrator_faculties(request.user, request.session)
        if not faculties:
            students = []
            if not warning:
                warning = "Sizga fakultet biriktirilmagan. Administrator orqali tayinlang."
        else:
            students = [s for s in students if (getattr(s, "faculty_name", "") or "").strip() in faculties]

    return JsonResponse({
        "query": query,
        "search_hemis": search_hemis,
        "warning": warning,
        "students": [_serialize_student_snapshot(student) for student in students],
    })


@login_required
@require_GET
def student_debts(request, student_id):
    role = get_user_role(request.user, request.session)
    if role not in SEARCH_STUDENT_ROLES:
        return JsonResponse({"error": "Talaba qarzdorliklari bo'limiga kirish huquqi yo'q."}, status=403)

    student = get_object_or_404(HemisStudentSnapshot, id=student_id)
    if role == Role.RET_REGISTRATOR:
        from retake.utils.service_registrator_utils import student_allowed_for_service_registrator

        if not student_allowed_for_service_registrator(student, request.user, request.session):
            return JsonResponse(
                {"error": "Bu talaba sizning biriktirilgan fakultetingizga tegishli emas."},
                status=403,
            )

    open_cycles = RetakeCycle.objects.filter(status=RetakeCycleStatus.OPEN).order_by("-created_at")

    selected_cycle_id = (request.GET.get("cycle_id") or "").strip()
    selected_cycle = None
    if selected_cycle_id.isdigit():
        selected_cycle = open_cycles.filter(id=int(selected_cycle_id)).first()
    if not selected_cycle and open_cycles:
        selected_cycle = open_cycles.first()

    warning = None
    if request.GET.get("sync") == "1":
        service = RetakeHemisSyncService()
        try:
            student, synced_rows, _source = service.sync_student_debts_for_snapshot(student)
            warning = f"Sinxronizatsiya yakunlandi. {len(synced_rows)} ta fan topildi."
        except Exception as exc:
            warning = f"Sinxronizatsiyada xatolik: {str(exc)}"

    debts = HemisStudentDebt.objects.filter(student_snapshot=student, is_active=True)
    item_qs = RetakeApplicationItem.objects.select_related("subject_snapshot").prefetch_related("documents")
    student_applications = (
        RetakeApplication.objects.filter(student_snapshot=student)
        .select_related("cycle", "student_snapshot")
        .prefetch_related(Prefetch("items", queryset=item_qs))
        .order_by("-created_at")
    )
    applied_debt_ids = list(
        RetakeApplicationItem.objects.filter(
            application__student_snapshot=student
        ).exclude(
            application__status=RetakeApplicationStatus.CANCELLED
        ).values_list("debt_snapshot_id", flat=True)
    )

    return JsonResponse({
        "student": _serialize_student_snapshot(student),
        "debts": [_serialize_student_debt(debt) for debt in debts],
        "open_cycles": [_serialize_cycle(cycle) for cycle in open_cycles],
        "selected_cycle": _serialize_cycle(selected_cycle),
        "applications": [_serialize_application_with_items_and_docs(app) for app in student_applications],
        "applied_debt_ids": applied_debt_ids,
        "warning": warning,
    })


@login_required
@require_POST
def create_application(request, student_id):
    role = get_user_role(request.user, request.session)
    if role not in SEARCH_STUDENT_ROLES:
        return JsonResponse({"error": "Ariza yaratish uchun huquq yo'q."}, status=403)

    payload = _json_body(request)
    cycle_id = payload.get("cycle_id")
    debt_ids = payload.get("debt_ids") or []

    if not cycle_id or not str(cycle_id).isdigit():
        return JsonResponse({"error": "Retake davrini tanlang."}, status=400)
    if not debt_ids:
        return JsonResponse({"error": "Kamida bitta fanni tanlang."}, status=400)

    student = get_object_or_404(HemisStudentSnapshot, id=student_id)
    if role == Role.RET_REGISTRATOR:
        from retake.utils.service_registrator_utils import student_allowed_for_service_registrator

        if not student_allowed_for_service_registrator(student, request.user, request.session):
            return JsonResponse(
                {"error": "Bu talaba sizning biriktirilgan fakultetingizga tegishli emas."},
                status=403,
            )

    cycle = get_object_or_404(RetakeCycle, id=int(cycle_id), status=RetakeCycleStatus.OPEN)

    clean_debt_ids = [int(item) for item in debt_ids if str(item).isdigit()]
    selected_debts = HemisStudentDebt.objects.filter(id__in=clean_debt_ids, student_snapshot=student)
    total_selected_credits = sum(Decimal(str(debt.subject_snapshot.credit or 0)) for debt in selected_debts)

    if total_selected_credits > Decimal(str(cycle.max_allowed_credits)):
        return JsonResponse({
            "error": (
                f"Tanlangan fanlar krediti ({total_selected_credits}) "
                f"ruxsat etilgan maksimal miqdordan ({cycle.max_allowed_credits}) oshib ketdi!"
            )
        }, status=400)

    with transaction.atomic():
        application, created = RetakeApplication.objects.get_or_create(
            cycle=cycle,
            student_snapshot=student,
            defaults={"created_by": request.user, "status": RetakeApplicationStatus.DRAFT},
        )

        if created:
            _create_workflow_event(application, "created", "", RetakeApplicationStatus.DRAFT, request.user)

        if application.status not in [RetakeApplicationStatus.DRAFT, RetakeApplicationStatus.RETURNED]:
            return JsonResponse({
                "error": "Bu ariza allaqachon jarayonga yuborilgan.",
                "application": _serialize_application_detail(application),
            }, status=400)

        for debt in selected_debts:
            control_type = "other"
            if debt.exam_type_label:
                label = debt.exam_type_label.lower()
                if "yakuniy" in label:
                    control_type = "final"
                elif "oraliq" in label:
                    control_type = "midterm"
                elif "joriy" in label:
                    control_type = "current"

            item_exists = RetakeApplicationItem.objects.filter(
                application=application,
                subject_snapshot=debt.subject_snapshot,
                required_control_type=control_type,
            ).exists()
            if not item_exists:
                RetakeApplicationItem.objects.create(
                    application=application,
                    subject_snapshot=debt.subject_snapshot,
                    debt_snapshot=debt,
                    required_control_type=control_type,
                    status=RetakeItemStatus.DRAFT,
                    amount=Decimal("0.00"),
                )

    return JsonResponse({"success": True, "application": _serialize_application_detail(application)})


@login_required
@require_GET
def sync_panel(request):
    role = get_user_role(request.user, request.session)
    if role not in SYNC_ROLES:
        return JsonResponse({"error": "Ushbu sahifaga faqat Super admin kira oladi."}, status=403)

    has_running = HemisSyncLog.objects.filter(status=HemisSyncStatus.RUNNING).exists()
    last_syncs = HemisSyncLog.objects.order_by("-started_at")[:20]

    db_stats = {
        "students": HemisStudentSnapshot.objects.count(),
        "teachers": TeacherProfile.objects.count(),
        "curriculums": HemisCurriculumSnapshot.objects.count(),
        "rooms": HemisRoomSnapshot.objects.count(),
    }

    return JsonResponse({
        "config_ok": _get_config_ok(),
        "has_running": has_running,
        "hemis_base_url": getattr(settings, "HEMIS_REST_BASE_URL", ""),
        "db_stats": db_stats,
        "last_syncs": [_serialize_sync_log(item) for item in last_syncs],
    })


@login_required
@require_POST
def sync_test_connection(request):
    role = get_user_role(request.user, request.session)
    if role not in SYNC_ROLES:
        return JsonResponse({"error": "Ruxsat yo'q. Faqat Super admin kirishishi mumkin."}, status=403)

    if not _get_config_ok():
        return JsonResponse({
            "success": False,
            "results": {"config": {"ok": False, "message": "HEMIS_BACKEND_API_TOKEN yoki HEMIS_REST_BASE_URL sozlanmagan."}},
        })

    service = HemisAdminSyncService()
    results = {}
    try:
        _rows, pagination = service.client.list_students(page=1, limit=1)
        results["students"] = {"ok": True, "message": f"{pagination.get('totalCount', '?')} ta talaba mavjud"}
    except Exception as exc:
        results["students"] = {"ok": False, "message": str(exc)}

    return JsonResponse({"success": all(item["ok"] for item in results.values()), "results": results})


@login_required
@require_POST
def sync_run(request):
    role = get_user_role(request.user, request.session)
    if role not in SYNC_ROLES:
        return JsonResponse({"error": "Sinxronlashni faqat Super admin boshqara oladi."}, status=403)

    if not _get_config_ok():
        return JsonResponse({
            "error": "HEMIS sozlamalari to'liq emas. HEMIS_BACKEND_API_TOKEN va HEMIS_REST_BASE_URL ni settings da o'rnating.",
        }, status=400)

    payload = _json_body(request)
    scope = (payload.get("scope") or "").strip()
    valid_scopes = {"all", "students", "teachers", "curriculums", "rooms"}
    if scope not in valid_scopes:
        return JsonResponse({"error": f"Noto'g'ri scope: '{scope}'."}, status=400)

    service = HemisAdminSyncService()
    user = request.user

    def sync_worker():
        try:
            if scope == "all":
                service.sync_all(initiated_by=user)
            elif scope == "students":
                service.sync_students(initiated_by=user)
            elif scope == "teachers":
                service.sync_teachers(initiated_by=user)
            elif scope == "curriculums":
                service.sync_curriculums(initiated_by=user)
            elif scope == "rooms":
                service.sync_rooms(initiated_by=user)
        except Exception:
            pass
        finally:
            close_old_connections()

    thread = threading.Thread(target=sync_worker)
    thread.daemon = True
    thread.start()

    scope_labels = {
        "all": "Barcha ma'lumotlar",
        "students": "Talabalar",
        "teachers": "O'qituvchilar",
        "curriculums": "O'quv rejalari",
        "rooms": "Xonalar",
    }

    return JsonResponse({
        "success": True,
        "message": f"'{scope_labels.get(scope, scope)}' sinxronlash jarayoni fonda boshlandi.",
    })


# ──────────────────────────────────────────────────────────────────
# Fan Guruhi Detail + HEMIS Guruhlar + Assessment yaratish
# ──────────────────────────────────────────────────────────────────

SUBJECT_GROUP_ROLES = {
    Role.SUPER_ADMIN, Role.REGISTRATOR, Role.RET_DB_MANAGER,
    Role.RET_REGISTRATOR, Role.TEACHER,
}

ASSESSMENT_CREATE_ROLES = {
    Role.SUPER_ADMIN, Role.REGISTRATOR, Role.RET_DB_MANAGER, Role.RET_REGISTRATOR,
}


def _create_assessment_and_sheet(group, student_group_name, control_type,
                                  scheduled_at_str, room, pair_number,
                                  teacher_id, created_by):
    """Helper: AssessmentSchedule + ExamSheet + ExamSheetEntry yaratadi."""
    from retake.models import RetakeGroupMembership

    if AssessmentSchedule.objects.filter(
        group=group, student_group_name=student_group_name, control_type=control_type
    ).exists():
        raise ValueError(
            f"'{student_group_name}' guruhi uchun '{control_type}' nazorati allaqachon mavjud."
        )

    scheduled_at = dt.fromisoformat(scheduled_at_str)
    teacher_profile = (
        TeacherProfile.objects.filter(id=teacher_id).first()
        if teacher_id else group.teacher_profile
    )

    assessment = AssessmentSchedule.objects.create(
        group=group,
        student_group_name=student_group_name,
        control_type=control_type,
        scheduled_at=scheduled_at,
        room=room or "",
        pair_number=int(pair_number) if pair_number else None,
        teacher_profile=teacher_profile,
        created_by=created_by,
        status=AssessmentScheduleStatus.OPEN,
    )

    year = scheduled_at.year
    last_sheet = ExamSheet.objects.filter(
        sheet_no__startswith=f"ES-{year}-"
    ).order_by('-sheet_no').first()
    if last_sheet:
        last_num = int(last_sheet.sheet_no.split('-')[-1])
        sheet_no = f"ES-{year}-{str(last_num + 1).zfill(4)}"
    else:
        sheet_no = f"ES-{year}-0001"

    exam_sheet = ExamSheet.objects.create(
        assessment_schedule=assessment,
        sheet_no=sheet_no,
        status=ExamSheetStatus.OPEN,
        opened_at=timezone.now(),
    )

    memberships_qs = group.memberships.select_related('student_snapshot')
    if student_group_name:
        memberships_qs = memberships_qs.filter(
            student_snapshot__group_name=student_group_name
        )
    if control_type and control_type != 'other':
        memberships_qs = memberships_qs.filter(required_control_type=control_type)

    entries_created = 0
    for membership in memberships_qs:
        ExamSheetEntry.objects.create(
            sheet=exam_sheet,
            group_membership=membership,
            student_snapshot=membership.student_snapshot,
        )
        entries_created += 1
        item = membership.application_item
        item.status = RetakeItemStatus.GRADE_ENTRY_OPEN
        item.save(update_fields=['status'])

    WorkflowEvent.objects.create(
        entity_type='ExamSheet',
        object_id=exam_sheet.id,
        action='created',
        from_status='',
        to_status=ExamSheetStatus.OPEN,
        actor=created_by,
        comment=(
            f"{student_group_name} guruhi uchun {assessment.control_type_label} "
            f"qaydnomasi yaratildi. {entries_created} ta talaba kiritildi."
        ),
    )

    return {
        'assessment_id': assessment.id,
        'exam_sheet': {
            'id': exam_sheet.id,
            'sheet_no': exam_sheet.sheet_no,
            'entries_count': entries_created,
        },
    }


@login_required
@require_GET
def subject_group_detail(request, group_id):
    """Fan guruhi to'liq ma'lumotlari."""
    role = get_user_role(request.user, request.session)
    if role not in SUBJECT_GROUP_ROLES:
        return JsonResponse({'error': 'Ruxsat yo\'q'}, status=403)

    group = get_object_or_404(
        RetakeSubjectGroup.objects.select_related(
            'subject_snapshot', 'teacher_profile', 'cycle', 'lms_course'
        ),
        id=group_id,
    )
    memberships = group.memberships.select_related(
        'student_snapshot', 'application_item'
    ).order_by('student_snapshot__group_name', 'student_snapshot__full_name')

    groups_dict = {}
    for m in memberships:
        g_name = m.student_snapshot.group_name or "Noma'lum"
        if g_name not in groups_dict:
            groups_dict[g_name] = {
                'group_name': g_name,
                'faculty_name': m.student_snapshot.faculty_name,
                'count': 0,
                'members': [],
                'control_types_needed': set(),
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

    for g in groups_dict.values():
        g['control_types_needed'] = list(g['control_types_needed'])

    assessments = group.assessment_schedules.select_related(
        'teacher_profile'
    ).prefetch_related('exam_sheet', 'exam_sheet__entries')
    assessments_data = [_serialize_assessment_schedule(a) for a in assessments]

    return JsonResponse({
        'group': {
            'id': group.id,
            'code': group.code,
            'subject_name': group.subject_snapshot.subject_name,
            'subject_code': group.subject_snapshot.subject_code,
            'semester_name': group.subject_snapshot.semester_name,
            'teacher': {
                'id': group.teacher_profile.id,
                'full_name': group.teacher_profile.full_name,
            } if group.teacher_profile else None,
            'status': group.status,
            'status_label': group.get_status_display(),
            'capacity': group.capacity,
            'total_members': memberships.count(),
            'lms_course_title': group.lms_course.title if group.lms_course else '',
        },
        'student_groups': list(groups_dict.values()),
        'assessments': assessments_data,
        'teachers': [
            {'id': t.id, 'full_name': t.full_name}
            for t in TeacherProfile.objects.all().order_by('full_name')
        ],
    })


@login_required
@require_GET
def group_student_groups(request, group_id):
    """Fan guruhidagi HEMIS guruhlar + har biri uchun nazorat holati."""
    role = get_user_role(request.user, request.session)
    if role not in SUBJECT_GROUP_ROLES:
        return JsonResponse({'error': 'Ruxsat yo\'q'}, status=403)

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
            }
        groups_info[g_name]['student_count'] += 1
        groups_info[g_name]['control_types_needed'].add(m.required_control_type)

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
            assessment_status[ct] = existing_map.get((g_name, ct))

        result.append({
            'group_name': g_name,
            'faculty_name': info['faculty_name'],
            'student_count': info['student_count'],
            'control_types_needed': control_types,
            'assessment_status': assessment_status,
            'all_scheduled': all(assessment_status.get(ct) for ct in control_types),
        })

    return JsonResponse({'student_groups': result})


@login_required
@require_POST
def create_assessment(request, group_id):
    """Bitta HEMIS guruh uchun nazorat + ExamSheet yaratish."""
    role = get_user_role(request.user, request.session)
    if role not in ASSESSMENT_CREATE_ROLES:
        return JsonResponse({'error': 'Ruxsat yo\'q'}, status=403)

    group = get_object_or_404(RetakeSubjectGroup, id=group_id)
    payload = _json_body(request)

    student_group_name = (payload.get('student_group_name') or '').strip()
    control_type = (payload.get('control_type') or '').strip()
    scheduled_at_str = (payload.get('scheduled_at') or '').strip()

    if not control_type or not scheduled_at_str:
        return JsonResponse({'error': 'Nazorat turi va sana kiritilishi shart'}, status=400)

    try:
        with transaction.atomic():
            result = _create_assessment_and_sheet(
                group=group,
                student_group_name=student_group_name,
                control_type=control_type,
                scheduled_at_str=scheduled_at_str,
                room=(payload.get('room') or '').strip(),
                pair_number=payload.get('pair_number'),
                teacher_id=payload.get('teacher_id'),
                created_by=request.user,
            )
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({
        'success': True,
        **result,
        'message': f"Nazorat jadvali va qaydnoma yaratildi. {result['exam_sheet']['entries_count']} ta talaba.",
    })


@login_required
@require_POST
def batch_create_assessments(request, group_id):
    """Barcha HEMIS guruhlar uchun bir turdagi nazorat yaratish."""
    role = get_user_role(request.user, request.session)
    if role not in ASSESSMENT_CREATE_ROLES:
        return JsonResponse({'error': 'Ruxsat yo\'q'}, status=403)

    group = get_object_or_404(RetakeSubjectGroup, id=group_id)
    payload = _json_body(request)
    control_type = (payload.get('control_type') or '').strip()
    schedules = payload.get('schedules') or []

    if not control_type or not schedules:
        return JsonResponse({'error': 'control_type va schedules kiritilishi shart'}, status=400)

    results = []
    errors = []

    with transaction.atomic():
        for sched in schedules:
            student_group_name = (sched.get('student_group_name') or '').strip()
            try:
                result = _create_assessment_and_sheet(
                    group=group,
                    student_group_name=student_group_name,
                    control_type=control_type,
                    scheduled_at_str=sched.get('scheduled_at', ''),
                    room=sched.get('room', ''),
                    pair_number=sched.get('pair_number'),
                    teacher_id=sched.get('teacher_id'),
                    created_by=request.user,
                )
                results.append(result)
            except Exception as e:
                errors.append({'student_group_name': student_group_name, 'error': str(e)})

    return JsonResponse({
        'created': len(results),
        'errors': errors,
        'results': results,
    })


# ──────────────────────────────────────────────────────────────────
# Teacher enrollment (LMS kursga biriktirish)
# ──────────────────────────────────────────────────────────────────

@login_required
def teacher_course_enrollment(request, group_id):
    """O'qituvchi o'z fan guruhiga talabalarni LMS kursiga biriktiradi."""
    from retake.utils.lms_integration_utils import sync_retake_group_to_lms
    from lms.models import Enrollment

    role = get_user_role(request.user, request.session)
    group = get_object_or_404(RetakeSubjectGroup.objects.select_related(
        'teacher_profile', 'subject_snapshot', 'lms_course', 'cycle'
    ), id=group_id)

    is_teacher = (
        role == Role.TEACHER
        and hasattr(request.user, 'teacher_profile')
        and group.teacher_profile == request.user.teacher_profile
    )
    is_admin = role in {Role.SUPER_ADMIN, Role.REGISTRATOR, Role.RET_DB_MANAGER}

    if not (is_teacher or is_admin):
        return JsonResponse({'error': 'Bu guruh uchun ruxsatingiz yo\'q'}, status=403)

    memberships = group.memberships.select_related('student_snapshot').all()

    hemis_groups = {}
    for m in memberships:
        gname = m.student_snapshot.group_name or "Noma'lum"
        if gname not in hemis_groups:
            hemis_groups[gname] = {
                'group_name': gname,
                'faculty_name': m.student_snapshot.faculty_name,
                'count': 0,
                'students': [],
            }
        hemis_groups[gname]['count'] += 1
        hemis_groups[gname]['students'].append({
            'snapshot_id': m.student_snapshot.id,
            'full_name': m.student_snapshot.full_name,
            'student_id': m.student_snapshot.student_id_number,
            'required_control_type': m.required_control_type,
        })

    enrolled_user_ids = set()
    if group.lms_course:
        enrolled_user_ids = set(
            Enrollment.objects.filter(course=group.lms_course)
            .values_list('student_id', flat=True)
        )

    for g in hemis_groups.values():
        enrolled_in_group = 0
        for s in g['students']:
            try:
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

    payload = _json_body(request)
    action = (payload.get('action') or 'enroll').strip()
    selected_hemis_groups = payload.get('hemis_groups')

    if action == 'create_course':
        if group.lms_course:
            return JsonResponse({
                'error': f"Kurs allaqachon mavjud: {group.lms_course.title}"
            }, status=400)

        result = sync_retake_group_to_lms(
            group,
            student_group_names=selected_hemis_groups,
            enrolled_by=request.user,
        )
        if result:
            return JsonResponse({
                'success': True,
                'action': 'created',
                'course_id': result['course'].id,
                'course_title': result['course'].title,
                'enrolled': result['enrolled'],
                'skipped': result['skipped'],
                'message': f"Kurs yaratildi. {result['enrolled']} ta talaba biriktirildi.",
            })
        return JsonResponse({'error': 'Kurs yaratishda xatolik'}, status=500)

    elif action == 'enroll':
        if not group.lms_course:
            return JsonResponse({
                'error': 'Avval kurs yaratilishi kerak'
            }, status=400)

        result = sync_retake_group_to_lms(
            group,
            student_group_names=selected_hemis_groups,
            enrolled_by=request.user,
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
                ),
            })
        return JsonResponse({'error': 'Biriktirish xatolik'}, status=500)

    return JsonResponse({'error': 'Noto\'g\'ri action'}, status=400)
