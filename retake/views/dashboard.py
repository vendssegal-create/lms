from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.db.models import Count, Q
from ..models import (
    RetakeCycle, RetakeApplication, RetakeApplicationItem, 
    RetakeGroupMembership, RetakeCycleStatus, RetakeApplicationStatus,
    RetakeItemStatus
)
from users.utils.roles import Role, get_user_role

@login_required
def retake_dashboard(request):
    role = get_user_role(request.user, request.session)
    if role not in [Role.SUPER_ADMIN, Role.REGISTRATOR, Role.RET_REGISTRATOR, Role.RET_ACCOUNTING, Role.RET_SUPERVISOR, Role.RET_DB_MANAGER]:
        return redirect('lms:portal')
        
    active_cycle = RetakeCycle.objects.filter(status=RetakeCycleStatus.OPEN).first()

    # Kanban buckets
    new_apps = RetakeApplication.objects.filter(
        status__in=[RetakeApplicationStatus.DRAFT, RetakeApplicationStatus.RETURNED]
    ).order_by('-created_at')[:20]

    in_progress_apps = RetakeApplication.objects.filter(
        status__in=[
            RetakeApplicationStatus.IN_REVIEW,
            RetakeApplicationStatus.PARTIALLY_APPROVED,
            RetakeApplicationStatus.APPROVED,
        ]
    ).order_by('-updated_at')[:20]

    done_apps = RetakeApplication.objects.filter(
        status__in=[
            RetakeApplicationStatus.COMPLETED,
            RetakeApplicationStatus.CANCELLED,
        ]
    ).order_by('-updated_at')[:10]

    # Subjects needing groups (for DB Manager)
    subjects_needing_groups = []
    if active_cycle and role in [Role.RET_DB_MANAGER, Role.SUPER_ADMIN]:
        # Improved query to match Flask behavior
        from hemis.models import HemisSubjectSnapshot
        subjects_needing_groups = RetakeApplicationItem.objects.filter(
            application__cycle=active_cycle,
            status=RetakeItemStatus.APPROVED_FOR_GROUPING
        ).values(
            'subject_snapshot__id', 
            'subject_snapshot__subject_name'
        ).annotate(
            student_count=Count('id')
        ).order_by('-student_count')

    context = {
        "active_cycle": active_cycle,
        "total_applications": RetakeApplication.objects.count(),
        "pending_payments": RetakeApplicationItem.objects.filter(status=RetakeItemStatus.SUBMITTED_TO_ACCOUNTING).count(),
        "pending_supervisor": RetakeApplicationItem.objects.filter(status=RetakeItemStatus.AWAITING_SUPERVISOR).count(),
        "grouped_students": RetakeGroupMembership.objects.count(),
        "new_apps": new_apps,
        "in_progress_apps": in_progress_apps,
        "done_apps": done_apps,
        "subjects_needing_groups": subjects_needing_groups,
    }
    return render(request, "retake/dashboard.html", context)
