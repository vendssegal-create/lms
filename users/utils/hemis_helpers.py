from __future__ import annotations

from hemis.models import HemisStudentSnapshot


def get_snapshot_for_user(user) -> HemisStudentSnapshot | None:
    """
    Login qilgan User uchun HemisStudentSnapshot ni topadi.
    Ustunlik tartibi:
      1. StudentProfile.hemis_snapshot (to'g'ridan-to'g'ri FK)
      2. StudentProfile.hemis_student_id bo'yicha
      3. StudentProfile.student_id_number bo'yicha
    """
    if not hasattr(user, "student_profile"):
        return None

    profile = user.student_profile

    # 1-usul: to'g'ridan-to'g'ri FK
    if profile.hemis_snapshot_id:
        return profile.hemis_snapshot

    # 2-usul: hemis_student_id
    if profile.hemis_student_id:
        snapshot = HemisStudentSnapshot.objects.filter(hemis_student_id=profile.hemis_student_id).first()
        if snapshot:
            # FK ni ham yangilash
            profile.hemis_snapshot = snapshot
            profile.save(update_fields=["hemis_snapshot"])
            return snapshot

    # 3-usul: student_id_number
    if profile.student_id_number:
        snapshot = HemisStudentSnapshot.objects.filter(student_id_number=profile.student_id_number).first()
        if snapshot:
            profile.hemis_snapshot = snapshot
            profile.save(update_fields=["hemis_snapshot"])
            return snapshot

    return None

