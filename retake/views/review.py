from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from django.db import models
from decimal import Decimal
from ..models import (
    RetakeCycle, RetakeApplication, RetakeApplicationItem, 
    RetakeCycleStatus, RetakeApplicationStatus, RetakeItemStatus,
    WorkflowEvent, PaymentReview, PaymentReviewStatus
)
from users.utils.roles import Role, get_user_role
from .applications import log_workflow_event

@login_required
def accounting_list(request):
    role = get_user_role(request.user, request.session)
    if role not in [Role.SUPER_ADMIN, Role.RET_ACCOUNTING, Role.REGISTRATOR]:
        return redirect('lms:portal')
        
    cycle = RetakeCycle.objects.filter(status=RetakeCycleStatus.OPEN).first()
    if cycle:
        applications = RetakeApplication.objects.filter(
            cycle=cycle, 
            status=RetakeApplicationStatus.IN_REVIEW
        ).select_related('student_snapshot').prefetch_related('items')
        
        # Search Filter
        query = request.GET.get('q', '').strip()
        if query:
            applications = applications.filter(
                models.Q(student_snapshot__full_name__icontains=query) |
                models.Q(student_snapshot__student_id_number__icontains=query)
            )
        
        applications = applications.order_by('-submitted_at')
    else:
        applications = []
    
    return render(request, "retake/pending_list.html", {"applications": applications, "cycle": cycle, "role": role})

@login_required
def verify_payment(request, app_id):
    if request.method != "POST":
        return redirect('retake:retake_accounting_list')
        
    role = get_user_role(request.user, request.session)
    if role not in [Role.SUPER_ADMIN, Role.RET_ACCOUNTING]:
        messages.error(request, "To'lovni tasdiqlash uchun huquqingiz yo'q.")
        return redirect('retake:retake_accounting_list')

    application = get_object_or_404(RetakeApplication, id=app_id)
    action = request.POST.get("action")
    comment = request.POST.get("comment", "").strip()

    try:
        old_status = application.status
        if action == "approve":
            app_amount = Decimal(request.POST.get("accountant_amount", "0").replace(",", "."))
            if app_amount <= 0:
                raise ValueError("Buxgalteriya summasi kiritilishi kerak.")
                
            application.accountant_amount = app_amount
            application.accountant_comment = comment
            application.status = RetakeApplicationStatus.PARTIALLY_APPROVED
            application.items.all().update(
                status=RetakeItemStatus.AWAITING_SUPERVISOR, 
                payment_date=timezone.now().date()
            )
            
            # Create payment reviews for items
            for item in application.items.all():
                PaymentReview.objects.create(
                    application_item=item,
                    status=PaymentReviewStatus.APPROVED,
                    checked_by=request.user,
                    comment=comment
                )
            
            log_workflow_event(application, "payment_verified", old_status, application.status, actor=request.user, comment=comment)
            messages.success(request, f"{application.student_snapshot.full_name} to'lovi tasdiqlandi.")
        elif action == "reject":
            application.status = RetakeApplicationStatus.RETURNED
            application.accountant_comment = comment
            application.items.all().update(status=RetakeItemStatus.PAYMENT_REJECTED)
            
            log_workflow_event(application, "payment_rejected", old_status, application.status, actor=request.user, comment=comment)
            messages.warning(request, "Ariza qaytarildi.")
        
        application.save()
    except Exception as e:
        messages.error(request, f"Xatolik: {str(e)}")

    return redirect('retake:retake_accounting_list')

@login_required
def supervisor_list(request):
    role = get_user_role(request.user, request.session)
    if role not in [Role.SUPER_ADMIN, Role.RET_SUPERVISOR, Role.REGISTRATOR]:
        return redirect('lms:portal')
        
    cycle = RetakeCycle.objects.filter(status=RetakeCycleStatus.OPEN).first()
    if cycle:
        applications = RetakeApplication.objects.filter(
            cycle=cycle, 
            status=RetakeApplicationStatus.PARTIALLY_APPROVED
        ).select_related('student_snapshot').prefetch_related('items')
        
        # Search Filter
        query = request.GET.get('q', '').strip()
        if query:
            applications = applications.filter(
                models.Q(student_snapshot__full_name__icontains=query) |
                models.Q(student_snapshot__student_id_number__icontains=query)
            )
            
        applications = applications.order_by('-updated_at')
    else:
        applications = []
    
    return render(request, "retake/approval_list.html", {"applications": applications, "cycle": cycle, "role": role})

@login_required
def supervisor_approve(request, app_id):
    if request.method != "POST":
        return redirect('retake:retake_supervisor_list')
        
    role = get_user_role(request.user, request.session)
    if role not in [Role.SUPER_ADMIN, Role.RET_SUPERVISOR]:
        messages.error(request, "Rahbar tasdig'i uchun huquqingiz yo'q.")
        return redirect('retake:retake_supervisor_list')

    application = get_object_or_404(RetakeApplication, id=app_id)
    action = request.POST.get("action")
    comment = request.POST.get("comment", "").strip()

    old_status = application.status
    if action == "approve":
        application.status = RetakeApplicationStatus.APPROVED
        application.items.all().update(status=RetakeItemStatus.APPROVED_FOR_GROUPING)
        log_workflow_event(application, "supervisor_approved", old_status, application.status, actor=request.user, comment=comment)
        messages.success(request, f"{application.student_snapshot.full_name} arizasi tasdiqlandi.")
    else:
        application.status = RetakeApplicationStatus.RETURNED
        application.items.all().update(status=RetakeItemStatus.SUPERVISOR_RETURNED)
        log_workflow_event(application, "supervisor_rejected", old_status, application.status, actor=request.user, comment=comment)
        messages.warning(request, "Ariza rahbar tomonidan qaytarildi.")

    application.save()
    return redirect('retake:retake_supervisor_list')
