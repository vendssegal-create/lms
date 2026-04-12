from celery import shared_task
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
import math
from lms.models import Course
from lms.services.certificate_service import issue_certificate, warm_certificate_pdf
from lms.models import Assignment, Enrollment, AssignmentStudentDeadline, Test
from lms.services.notification_service import notify_deadline_warning, notify_deadline_warning_generic
import logging

logger = logging.getLogger(__name__)

@shared_task(name="lms.tasks.generate_certificate_async")
def generate_certificate_async(user_id, course_id):
    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
        course = Course.objects.get(id=course_id)
        cert, message = issue_certificate(user, course, queue_pdf_warm=False)
        if cert:
            ok, err = warm_certificate_pdf(user, course)
            if ok:
                logger.info("Certificate PDF warmed for user %s course %s", user_id, course_id)
            elif err:
                logger.warning(
                    "Certificate PDF warm failed for user %s course %s: %s",
                    user_id,
                    course_id,
                    err,
                )
        else:
            logger.warning(f"Failed to issue certificate for user {user_id}: {message}")
    except (User.DoesNotExist, Course.DoesNotExist) as e:
        logger.error(f"Error in generate_certificate_async: {str(e)}")
    except Exception as e:
        logger.critical(f"Unexpected error in background certificate task: {str(e)}")


@shared_task(name="lms.check_approaching_deadlines")
def check_approaching_deadlines():
    now = timezone.now()
    threshold = now + timedelta(days=3)

    assignments = (
        Assignment.objects
        .filter(is_active=True, deadline__gte=now, deadline__lte=threshold)
        .select_related("course")
    )

    for assignment in assignments:
        enrollments = Enrollment.objects.filter(course=assignment.course).select_related("student")
        for enrollment in enrollments:
            try:
                custom = AssignmentStudentDeadline.objects.get(student=enrollment.student, assignment=assignment)
                deadline = custom.deadline
                if deadline < now:
                    continue
            except AssignmentStudentDeadline.DoesNotExist:
                deadline = assignment.deadline

            days_left = max(0, math.ceil((deadline - now).total_seconds() / 86400))
            notify_deadline_warning(enrollment.student, assignment, days_left, deadline)

    tests = (
        Test.objects
        .filter(is_active=True, end_datetime__gte=now, end_datetime__lte=threshold)
        .select_related("course")
    )
    for test in tests:
        enrollments = Enrollment.objects.filter(course=test.course).select_related("student")
        for enrollment in enrollments:
            days_left = max(0, math.ceil((test.end_datetime - now).total_seconds() / 86400))
            notify_deadline_warning_generic(
                user=enrollment.student,
                resource_type="test",
                resource_id=test.id,
                resource_title=test.name,
                course_id=test.course_id,
                deadline=test.end_datetime,
                days_left=days_left,
                link=f"/tests/{test.id}",
            )

    return f"Checked {assignments.count()} assignments and {tests.count()} tests"
