"""
HEMIS REST javoblaridan lokal modellarga xavfsiz maydon chiqarish.

student-list, student-info, employee-list, auditorium-list formatlari biroz farq qilishi
mumkin — shuning uchun qiymatlar ixtiyoriy tekshiriladi.
"""
from __future__ import annotations

from typing import Any

from hemis.utils.helpers import nested_code, nested_name


def _as_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, dict):
        return nested_name(value)
    return str(value).strip()


def _as_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _first_non_empty_str(payload: dict, *keys: str) -> str:
    for key in keys:
        v = payload.get(key)
        if v is None or v == "":
            continue
        if isinstance(v, dict):
            t = nested_name(v)
            if t:
                return t
        else:
            s = str(v).strip()
            if s:
                return s
    return ""


def populate_hemis_student_snapshot(snapshot, payload: dict) -> None:
    """HemisStudentSnapshot maydonlarini to‘ldirish (list yoki student-info)."""
    if not payload.get("id"):
        return

    # NOTE: Some endpoints (e.g. student-info) may not include faculty/group/semester.
    # Do NOT overwrite existing snapshot fields with empty strings.

    student_id_number = str(payload.get("student_id_number") or "").strip()
    if student_id_number:
        snapshot.student_id_number = student_id_number

    pinfl = str(
        payload.get("pinfl")
        or payload.get("hash")
        or payload.get("pinfl_hash")
        or ""
    ).strip()
    if pinfl:
        snapshot.pinfl = pinfl

    full_name = str(payload.get("full_name") or "").strip()
    if full_name:
        snapshot.full_name = full_name

    short_name = str(payload.get("short_name") or "").strip()
    if short_name:
        snapshot.short_name = short_name

    dept = payload.get("department") or payload.get("faculty")
    faculty_name = _as_text(dept)
    if faculty_name:
        snapshot.faculty_name = faculty_name

    spec = payload.get("specialty") or payload.get("speciality")
    specialty_name = _as_text(spec)
    if specialty_name:
        snapshot.specialty_name = specialty_name

    grp = payload.get("group")
    group_name = _as_text(grp)
    if group_name:
        snapshot.group_name = group_name

    sem = payload.get("semester")
    semester_code = nested_code(sem) if isinstance(sem, dict) else str(sem or "").strip()
    semester_name = nested_name(sem) if isinstance(sem, dict) else str(sem or "").strip()
    if semester_code:
        snapshot.semester_code = semester_code
    if semester_name:
        snapshot.semester_name = semester_name

    cur = payload.get("_curriculum")
    if cur is None and isinstance(payload.get("curriculum"), dict):
        cur = payload["curriculum"].get("id")
    snapshot.curriculum_id = _as_int(cur)

    email = _first_non_empty_str(payload, "email", "mail", "student_email")
    if email:
        snapshot.email = email

    phone = _first_non_empty_str(payload, "phone", "mobile", "phone_number", "telephone")
    if phone:
        snapshot.phone = phone

    snapshot.raw_payload = payload


def populate_hemis_room_snapshot(snapshot, payload: dict) -> None:
    """HemisRoomSnapshot — auditorium-list qatori."""
    hemis_id = payload.get("id")
    if not hemis_id:
        return

    snapshot.name = str(payload.get("name") or "").strip()
    snapshot.code = str(payload.get("code") or "").strip()

    bld = payload.get("building")
    snapshot.building_name = nested_name(bld) if isinstance(bld, dict) else str(bld or "").strip()
    snapshot.building_code = nested_code(bld) if isinstance(bld, dict) else ""

    cap = payload.get("capacity")
    try:
        snapshot.capacity = int(cap) if cap not in (None, "") else 0
    except (TypeError, ValueError):
        snapshot.capacity = 0

    snapshot.room_type = nested_name(payload.get("auditoriumType"))
    floor = payload.get("floor") or payload.get("floor_number") or payload.get("floorNumber")
    snapshot.floor = str(floor).strip() if floor not in (None, "") else ""

    snapshot.raw_payload = payload


def populate_teacher_profile_from_employee(user, profile, payload: dict) -> None:
    """TeacherProfile + User — employee-list qatori (type=teacher)."""
    hemis_id = str(payload.get("id") or "").strip()
    if not hemis_id:
        return

    profile.full_name = str(payload.get("full_name") or payload.get("name") or "").strip()
    profile.hemis_id = hemis_id

    uuid_val = payload.get("uuid") or payload.get("employee_uuid")
    if uuid_val and not profile.hemis_uuid:
        profile.hemis_uuid = str(uuid_val).strip()

    dept = payload.get("department") or payload.get("structural_division")
    profile.department = _as_text(dept)

    pos = payload.get("position") or payload.get("employee_position") or payload.get("staffPosition")
    profile.hemis_position = _as_text(pos)

    phone = _first_non_empty_str(payload, "phone", "mobile", "phone_number")
    if phone:
        profile.phone = phone[:20]
        if not getattr(user, "phone", ""):
            user.phone = phone[:20]

    email = _first_non_empty_str(payload, "email", "mail")
    if email and not user.email:
        user.email = email[:254]

    profile.profile_payload = payload if isinstance(payload, dict) else {}
