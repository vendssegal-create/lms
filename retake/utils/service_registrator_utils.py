"""Xizmat ko'rsatish registratori (RET_REGISTRATOR) uchun fakultet filtrlari."""

from retake.models import ServiceRegistratorFacultyAssignment
from users.utils.roles import Role, get_user_role


def get_service_registrator_faculties(user, session=None):
    """
    RET_REGISTRATOR uchun tayinlangan fakultetlar.
    Bo'sh ro'yxat — biriktirish yo'q (hech qanday talaba qidiruv/yaratish mumkin emas).
    """
    role = get_user_role(user, session)
    if role != Role.RET_REGISTRATOR:
        return None
    return list(
        ServiceRegistratorFacultyAssignment.objects.filter(
            service_registrator_user=user,
        ).values_list("faculty_name", flat=True),
    )


def student_allowed_for_service_registrator(student_snapshot, user, session=None) -> bool:
    faculties = get_service_registrator_faculties(user, session)
    if faculties is None:
        return True
    if not faculties:
        return False
    name = (getattr(student_snapshot, "faculty_name", None) or "").strip()
    return name in faculties
