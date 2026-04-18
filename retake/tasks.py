"""
Retake Celery vazifalari.
"""
import logging

from celery import shared_task
from django.db import close_old_connections

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def sync_hemis_data_task(self, scope: str = "all", actor_id=None):
    """
    HEMIS ma'lumotlarini sinxronlash — Celery orqali.

    scope: "all" | "students" | "teachers" | "curriculums" | "rooms"
    """
    try:
        close_old_connections()
        from hemis.services import HemisAdminSyncService
        from django.contrib.auth import get_user_model

        User = get_user_model()
        actor = None
        if actor_id:
            actor = User.objects.filter(id=actor_id).first()

        service = HemisAdminSyncService()
        logger.info(f"HEMIS sync boshlandi: scope={scope}, actor={actor_id}")

        if scope == "all":
            service.sync_all(initiated_by=actor)
        elif scope == "students":
            service.sync_students(initiated_by=actor)
        elif scope == "teachers":
            service.sync_teachers(initiated_by=actor)
        elif scope == "curriculums":
            service.sync_curriculums(initiated_by=actor)
        elif scope == "rooms":
            service.sync_rooms(initiated_by=actor)
        else:
            logger.warning(f"Noma'lum scope: {scope}")
            return {"ok": False, "error": f"Noma'lum scope: {scope}"}

        logger.info(f"HEMIS sync yakunlandi: scope={scope}")
        return {"ok": True, "scope": scope}

    except Exception as exc:
        logger.error(f"HEMIS sync xatosi (scope={scope}): {exc}")
        raise self.retry(exc=exc)
