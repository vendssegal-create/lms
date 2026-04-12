from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver

from lms.models import Enrollment
from lms.services.notification_service import notify_course_enrolled


@receiver(post_save, sender=Enrollment)
def on_enrollment_created(sender, instance: Enrollment, created: bool, **kwargs):
    if created:
        notify_course_enrolled(instance)

