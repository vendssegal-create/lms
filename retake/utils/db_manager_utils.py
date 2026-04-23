from retake.constants import DB_MANAGER_ALL_FACULTIES_SENTINEL
from retake.models import DBManagerFacultyAssignment
from users.utils.roles import Role, get_user_role


def get_db_manager_faculties(user, session=None):
    """
    DB Manager uchun tayinlangan fakultetlar ro'yxatini qaytaradi.
    Super Admin / Registrator bo'lsa — None (hammasi ko'rinadi).
    MB menejerda DB_MANAGER_ALL_FACULTIES_SENTINEL biriktirilgan bo'lsa — None (barcha fakultetlar).
    """
    role = get_user_role(user, session)

    if role in [Role.SUPER_ADMIN, Role.REGISTRATOR]:
        return None

    if role == Role.RET_DB_MANAGER:
        assigned = list(
            DBManagerFacultyAssignment.objects.filter(db_manager_user=user).values_list(
                "faculty_name", flat=True
            )
        )
        if DB_MANAGER_ALL_FACULTIES_SENTINEL in assigned:
            return None
        return [n for n in assigned if n != DB_MANAGER_ALL_FACULTIES_SENTINEL]

    return []


def db_manager_may_access_faculties(user, faculty_names, session=None):
    """
    RET_DB_MANAGER uchun: guruh/varaqadagi talaba fakultetlari ro'yxati bilan mos keladimi.
    faculty_names — talaba snapshotlarining faculty_name qiymatlari (takrorlanishi mumkin).
    """
    faculties = get_db_manager_faculties(user, session)
    if faculties is None:
        return True
    if not faculties:
        return False
    return bool(set(faculties).intersection(set(faculty_names or [])))


def filter_memberships_by_faculty(queryset, user, session=None):
    """RetakeGroupMembership queryset ni DB Manager uchun filtrlaydi."""
    faculties = get_db_manager_faculties(user, session)
    if faculties is None:
        return queryset
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
