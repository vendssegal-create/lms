from django.core.management.base import BaseCommand

from hemis.models import HemisStudentSnapshot
from users.models import StudentProfile


class Command(BaseCommand):
    help = "Mavjud StudentProfile larni HemisStudentSnapshot bilan bog'lash"

    def handle(self, *args, **kwargs):
        verbosity = int(kwargs.get("verbosity", 1) or 1)
        profiles = StudentProfile.objects.filter(hemis_snapshot__isnull=True)
        linked = 0
        not_found = 0

        for profile in profiles:
            snapshot = None

            # hemis_student_id orqali
            if profile.hemis_student_id:
                snapshot = HemisStudentSnapshot.objects.filter(
                    hemis_student_id=profile.hemis_student_id
                ).first()

            # student_id_number orqali
            if not snapshot and profile.student_id_number:
                snapshot = HemisStudentSnapshot.objects.filter(
                    student_id_number=profile.student_id_number
                ).first()

            if snapshot:
                profile.hemis_snapshot = snapshot
                profile.save(update_fields=["hemis_snapshot"])
                linked += 1
                if verbosity >= 2:
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"  Bog'landi: {profile.full_name} -> {snapshot.hemis_student_id}"
                        )
                    )
            else:
                not_found += 1
                if verbosity >= 2:
                    self.stdout.write(
                        self.style.WARNING(
                            f"  Topilmadi: {profile.full_name} ({profile.student_id_number})"
                        )
                    )

        self.stdout.write(
            self.style.SUCCESS(f"\nNatija: {linked} bog'landi, {not_found} topilmadi.")
        )

