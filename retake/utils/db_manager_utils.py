from retake.models import DBManagerFacultyAssignment
from users.utils.roles import Role, get_user_role


def get_db_manager_faculties(user, session=None):
    """
    DB Manager uchun tayinlangan fakultetlar ro'yxatini qaytaradi.
    Super Admin / Registrator bo'lsa — None (hammasi ko'rinadi).
    """
    role = get_user_role(user, session)

    if role in [Role.SUPER_ADMIN, Role.REGISTRATOR]:
        return None

    if role == Role.RET_DB_MANAGER:
        assigned = DBManagerFacultyAssignment.objects.filter(
            db_manager_user=user
        ).values_list('faculty_name', flat=True)
        return list(assigned)

    return []


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
