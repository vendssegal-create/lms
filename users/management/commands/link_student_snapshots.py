from django.core.management.base import BaseCommand
from users.models import StudentProfile
from hemis.models import HemisStudentSnapshot


class Command(BaseCommand):
    help = "Mavjud StudentProfile larni HemisStudentSnapshot bilan bog'lash"

    def handle(self, *args, **kwargs):
        profiles = StudentProfile.objects.filter(hemis_snapshot__isnull=True)
        total = profiles.count()
        self.stdout.write(f"Tekshirilmoqda: {total} ta profil\n")

        linked = 0
        not_found = 0

        for profile in profiles:
            snapshot = None

            if profile.hemis_student_id:
                snapshot = HemisStudentSnapshot.objects.filter(
                    hemis_student_id=profile.hemis_student_id
                ).first()

            if not snapshot and profile.student_id_number:
                snapshot = HemisStudentSnapshot.objects.filter(
                    student_id_number=profile.student_id_number
                ).first()

            if snapshot:
                profile.hemis_snapshot = snapshot
                if snapshot.hemis_student_id and not profile.hemis_student_id:
                    profile.hemis_student_id = snapshot.hemis_student_id
                profile.save(update_fields=['hemis_snapshot', 'hemis_student_id'])
                linked += 1
                self.stdout.write(
                    self.style.SUCCESS(f"  ✓ {profile.full_name} → snapshot #{snapshot.id}")
                )
            else:
                not_found += 1
                self.stdout.write(
                    self.style.WARNING(f"  ✗ {profile.full_name} ({profile.student_id_number}) — snapshot topilmadi")
                )

        self.stdout.write(
            self.style.SUCCESS(f"\nNatija: {linked} bog'landi, {not_found} topilmadi.")
        )
