from django.db import transaction
from lms.models import Course, Enrollment
from retake.models import RetakeCourseEnrollmentLog
import logging

logger = logging.getLogger(__name__)


def sync_retake_group_to_lms(group, student_group_names=None, enrolled_by=None):
    """
    Synchronizes a RetakeSubjectGroup with the LMS Module.

    Args:
        group: RetakeSubjectGroup instance
        student_group_names: list | None
            - None -> barcha fan guruhi a'zolari biriktiriladi
            - ['MT-21-1', 'KI-22-3'] -> faqat shu HEMIS guruhlar biriktiriladi
        enrolled_by: User instance (kim biriktirdi)

    Returns:
        dict: {'course': Course, 'enrolled': int, 'already_enrolled': int, 'skipped': int}
    """
    if not group.teacher_profile:
        logger.warning(f"Group {group.id} has no teacher, skipping LMS sync")
        return None

    try:
        with transaction.atomic():
            teacher_user = group.teacher_profile.user

            course = group.lms_course
            if not course:
                course = Course.objects.create(
                    title=f"{group.subject_snapshot.subject_name} (Qayta o'qish: {group.code})",
                    description=(
                        f"Qayta o'qish davri: {group.cycle.name}.\n"
                        f"Fan: {group.subject_snapshot.subject_name} "
                        f"({group.subject_snapshot.semester_name}).\n"
                        f"Guruh kodi: {group.code}."
                    ),
                    teacher=teacher_user,
                    is_active=True
                )
                group.lms_course = course
                group.save(update_fields=['lms_course'])
                logger.info(f"Created LMS course {course.id} for retake group {group.id}")
            else:
                if course.teacher_id != teacher_user.id:
                    course.teacher = teacher_user
                    course.save(update_fields=['teacher'])

            memberships_qs = group.memberships.select_related('student_snapshot')
            if student_group_names is not None:
                memberships_qs = memberships_qs.filter(
                    student_snapshot__group_name__in=student_group_names
                )

            existing_enrollment_ids = set(
                Enrollment.objects.filter(course=course)
                .values_list('student_id', flat=True)
            )

            enrolled_count = 0
            already_count = 0
            skipped_count = 0
            enrollments_to_create = []
            logs_to_create = []

            for membership in memberships_qs:
                snapshot = membership.student_snapshot

                student_user = None
                try:
                    student_profile = snapshot.student_profile
                    student_user = student_profile.user
                except Exception:
                    skipped_count += 1
                    logger.warning(f"No user found for student snapshot {snapshot.id}")
                    continue

                if student_user.id in existing_enrollment_ids:
                    already_count += 1
                    continue

                enrollments_to_create.append(
                    Enrollment(student=student_user, course=course)
                )
                logs_to_create.append(
                    RetakeCourseEnrollmentLog(
                        group=group,
                        lms_course=course,
                        student_snapshot=snapshot,
                        hemis_student_group=snapshot.group_name or "",
                        enrolled_by=enrolled_by
                    )
                )
                enrolled_count += 1

            if enrollments_to_create:
                Enrollment.objects.bulk_create(enrollments_to_create, ignore_conflicts=True)
                RetakeCourseEnrollmentLog.objects.bulk_create(logs_to_create, ignore_conflicts=True)

            logger.info(
                f"Group {group.id} sync: enrolled={enrolled_count}, "
                f"already={already_count}, skipped={skipped_count}"
            )

            return {
                'course': course,
                'enrolled': enrolled_count,
                'already_enrolled': already_count,
                'skipped': skipped_count
            }

    except Exception as e:
        logger.error(f"Error syncing retake group {group.id} to LMS: {str(e)}", exc_info=True)
        return None
