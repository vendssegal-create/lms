from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from hemis.models import HemisStudentSnapshot
    from users.models import User


def get_snapshot_for_user(user: "User") -> "HemisStudentSnapshot | None":
    """
    Login qilgan User uchun HemisStudentSnapshot ni topadi.
    Ustunlik tartibi:
      1. StudentProfile.hemis_snapshot (to'g'ridan-to'g'ri FK)
      2. StudentProfile.hemis_student_id bo'yicha
      3. StudentProfile.student_id_number bo'yicha
    Agar 2 yoki 3-usul bilan topilsa, FK ham yangilanadi (kesh).
    """
    from hemis.models import HemisStudentSnapshot

    if not hasattr(user, 'student_profile'):
        return None

    profile = user.student_profile

    # 1-usul: to'g'ridan-to'g'ri FK
    if profile.hemis_snapshot_id:
        try:
            return profile.hemis_snapshot
        except HemisStudentSnapshot.DoesNotExist:
            profile.hemis_snapshot = None
            profile.save(update_fields=['hemis_snapshot'])

    # 2-usul: hemis_student_id bo'yicha
    if profile.hemis_student_id:
        snapshot = HemisStudentSnapshot.objects.filter(
            hemis_student_id=profile.hemis_student_id
        ).first()
        if snapshot:
            profile.hemis_snapshot = snapshot
            profile.save(update_fields=['hemis_snapshot'])
            return snapshot

    # 3-usul: student_id_number bo'yicha (login username)
    if profile.student_id_number:
        snapshot = HemisStudentSnapshot.objects.filter(
            student_id_number=profile.student_id_number
        ).first()
        if snapshot:
            profile.hemis_snapshot = snapshot
            if snapshot.hemis_student_id:
                profile.hemis_student_id = snapshot.hemis_student_id
            profile.save(update_fields=['hemis_snapshot', 'hemis_student_id'])
            return snapshot

    return None
