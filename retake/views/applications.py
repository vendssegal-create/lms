from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.db.models import Q
from decimal import Decimal
from django.utils import timezone
from ..models import (
    RetakeCycle, RetakeApplication, RetakeApplicationItem, 
    RetakeCycleStatus, RetakeApplicationStatus, RetakeItemStatus,
    WorkflowEvent, PaymentReview, PaymentReviewStatus
)
from hemis.models import HemisStudentSnapshot, HemisStudentDebt
from hemis.services import RetakeHemisSyncService
from users.utils.roles import Role, get_user_role, role_required

def log_workflow_event(application, action, from_status, to_status, actor, comment=""):
    WorkflowEvent.objects.create(
        entity_type="retake_application",
        object_id=application.id,
        action=action,
        from_status=from_status,
        to_status=to_status,
        actor=actor,
        comment=comment
    )

@login_required
def search_student(request):
    # ... (existing code remains same)
    role = get_user_role(request.user, request.session)
    if role not in [Role.SUPER_ADMIN, Role.REGISTRATOR, Role.RET_REGISTRATOR]:
        return redirect('lms:portal')
        
    query = request.GET.get("q", "").strip()
    search_hemis = request.GET.get("hemis") == "1"
    students = []
    
    if query:
        clean_query = query[8:] if query.lower().startswith("student_") else query
        students = HemisStudentSnapshot.objects.filter(
            Q(full_name__icontains=clean_query) |
            Q(student_id_number__icontains=clean_query) |
            Q(pinfl__icontains=clean_query)
        ).order_by('full_name')

        if (not students or search_hemis) and len(clean_query) >= 3:
            service = RetakeHemisSyncService()
            try:
                # Basic sync for a single student by ID number
                if clean_query.isdigit():
                    student = service.sync_student(student_id_number=clean_query, sync_debts=False)
                    if student:
                        students = [student]
            except Exception as e:
                messages.warning(request, f"HEMIS qidiruvida xatolik: {str(e)}")

    return render(request, "retake/search_student.html", {"students": students, "query": query, "search_hemis": search_hemis})

@login_required
def student_debts(request, student_id):
    # ... (existing code remains same)
    student = get_object_or_404(HemisStudentSnapshot, id=student_id)
    open_cycles = RetakeCycle.objects.filter(status=RetakeCycleStatus.OPEN)
    
    if not open_cycles:
        messages.warning(request, "Hozirda hech qanday faol qayta topshirish davri (Cycle) mavjud emas. Ariza yaratish uchun avval davrni 'OCHIQ' holatiga o'tkazing.")
    
    selected_cycle_id = request.GET.get("cycle_id")
    cycle = None
    if selected_cycle_id:
        cycle = RetakeCycle.objects.filter(id=selected_cycle_id, status=RetakeCycleStatus.OPEN).first()
    
    if not cycle and open_cycles:
        cycle = open_cycles.first()

    if request.GET.get("sync") == "1":
        service = RetakeHemisSyncService()
        try:
            student, synced_rows, source = service.sync_student_debts_for_snapshot(student)
            messages.success(request, f"Sinxronizatsiya yakunlandi. {len(synced_rows)} ta fan topildi.")
        except Exception as e:
            messages.warning(request, f"Sinxronizatsiyada xatolik: {str(e)}")

    debts = HemisStudentDebt.objects.filter(student_snapshot=student, is_active=True)
    
    # Get existing applications
    student_applications = RetakeApplication.objects.filter(student_snapshot=student).order_by('-created_at')
    
    # Get debt IDs that are already in active (non-cancelled) applications
    applied_debt_ids = RetakeApplicationItem.objects.filter(
        application__student_snapshot=student
    ).exclude(
        application__status=RetakeApplicationStatus.CANCELLED
    ).values_list('debt_snapshot_id', flat=True)

    return render(request, "retake/student_debts.html", {
        "student": student, 
        "debts": debts, 
        "cycle": cycle, 
        "open_cycles": open_cycles,
        "student_applications": student_applications,
        "applied_debt_ids": applied_debt_ids,
    })

@login_required
def create_application(request, student_id):
    # ... (existing code remains same)
    if request.method != "POST" :
        return redirect('retake:student_debts', student_id=student_id)
        
    student = get_object_or_404(HemisStudentSnapshot, id=student_id)
    cycle_id = request.POST.get("cycle_id")
    cycle = get_object_or_404(RetakeCycle, id=cycle_id, status=RetakeCycleStatus.OPEN)
    
    debt_ids = request.POST.getlist("debt_ids")
    if not debt_ids:
        messages.error(request, "Kamida bitta fanni tanlang.")
        return redirect('retake:student_debts', student_id=student.id)

    # Calculate total credits
    selected_debts = HemisStudentDebt.objects.filter(id__in=debt_ids, student_snapshot=student)
    total_selected_credits = sum(Decimal(str(d.subject_snapshot.credit or 0)) for d in selected_debts)
    
    if total_selected_credits > Decimal(str(cycle.max_allowed_credits)):
        messages.error(request, f"Tanlangan fanlar krediti ({total_selected_credits}) ruxsat etilgan maksimal miqdordan ({cycle.max_allowed_credits}) oshib ketdi!")
        return redirect('retake:student_debts', student_id=student.id)

    application, created = RetakeApplication.objects.get_or_create(
        cycle=cycle, 
        student_snapshot=student,
        defaults={'created_by': request.user, 'status': RetakeApplicationStatus.DRAFT}
    )
    
    if created:
        log_workflow_event(application, "created", "", RetakeApplicationStatus.DRAFT, actor=request.user)
    
    if application.status not in [RetakeApplicationStatus.DRAFT, RetakeApplicationStatus.RETURNED]:
        messages.warning(request, "Bu ariza allaqachon jarayonga yuborilgan.")
        return redirect('retake:application_detail', app_id=application.id)

    for debt in selected_debts:
        # Map exam_type_label to a shorter control_type if needed, or use 'other'
        control_type = "other"
        if debt.exam_type_label:
            if "yakuniy" in debt.exam_type_label.lower(): control_type = "final"
            elif "oraliq" in debt.exam_type_label.lower(): control_type = "midterm"
            elif "joriy" in debt.exam_type_label.lower(): control_type = "current"

        item_exists = RetakeApplicationItem.objects.filter(
            application=application, 
            subject_snapshot=debt.subject_snapshot, 
            required_control_type=control_type
        ).exists()
        
        if not item_exists:
            RetakeApplicationItem.objects.create(
                application=application,
                subject_snapshot=debt.subject_snapshot,
                debt_snapshot=debt,
                required_control_type=control_type,
                status=RetakeItemStatus.DRAFT,
                amount=Decimal("0.00")
            )

    messages.success(request, "Ariza yaratildi yoki yangilandi.")
    return redirect('retake:application_detail', app_id=application.id)

@login_required
def application_list(request):
    role = get_user_role(request.user, request.session)
    
    # Cycle filter - allow selecting any cycle, default to open
    cycles = RetakeCycle.objects.all().order_by('-created_at')
    cycle_id = request.GET.get('cycle_id', '').strip()
    if cycle_id:
        cycle = RetakeCycle.objects.filter(id=cycle_id).first()
    else:
        cycle = RetakeCycle.objects.filter(status=RetakeCycleStatus.OPEN).first()
    
    queryset = RetakeApplication.objects.select_related('student_snapshot').prefetch_related('items').order_by('-created_at')
    
    if cycle:
        queryset = queryset.filter(cycle=cycle)
        
    # Filter list based on role if needed, or show all for admins
    if role == Role.RET_ACCOUNTING:
        queryset = queryset.filter(status=RetakeApplicationStatus.IN_REVIEW)
    elif role == Role.RET_SUPERVISOR:
        queryset = queryset.filter(status=RetakeApplicationStatus.PARTIALLY_APPROVED)
    elif role == Role.STUDENT:
        queryset = queryset.filter(student_snapshot__hemis_student_id=request.user.student_profile.hemis_id if hasattr(request.user, 'student_profile') else 0)
    
    # Search filter
    q = request.GET.get('q', '').strip()
    if q:
        queryset = queryset.filter(
            Q(student_snapshot__full_name__icontains=q) |
            Q(student_snapshot__student_id_number__icontains=q)
        )
    
    # Status filter
    status_filter = request.GET.get('status', '').strip()
    if status_filter:
        queryset = queryset.filter(status=status_filter)
    
    # Faculty filter
    faculty_filter = request.GET.get('faculty', '').strip()
    if faculty_filter:
        queryset = queryset.filter(student_snapshot__faculty_name=faculty_filter)
    
    # Group filter
    group_filter = request.GET.get('group', '').strip()
    if group_filter:
        queryset = queryset.filter(student_snapshot__group_name=group_filter)
    
    # Get distinct faculties and groups for filter dropdowns
    faculties = HemisStudentSnapshot.objects.values_list('faculty_name', flat=True).exclude(faculty_name='').distinct().order_by('faculty_name')
    groups = HemisStudentSnapshot.objects.values_list('group_name', flat=True).exclude(group_name='').distinct().order_by('group_name')
    
    context = {
        "applications": queryset,
        "cycle": cycle,
        "role": role,
        "cycles": cycles,
        "faculties": faculties,
        "groups": groups,
    }
    return render(request, "retake/application_list.html", context)

@login_required
def application_detail(request, app_id):
    application = get_object_or_404(RetakeApplication, id=app_id)
    role = get_user_role(request.user, request.session)
    
    can_edit = application.status in [RetakeApplicationStatus.DRAFT, RetakeApplicationStatus.RETURNED]
    can_account_review = (role in [Role.RET_ACCOUNTING, Role.SUPER_ADMIN]) and application.status == RetakeApplicationStatus.IN_REVIEW
    can_supervisor_review = (role in [Role.RET_SUPERVISOR, Role.SUPER_ADMIN]) and application.status == RetakeApplicationStatus.PARTIALLY_APPROVED
    
    if request.method == "POST":
        action = request.POST.get("action")
        try:
            if can_edit:
                # Update fields
                application.declared_amount = Decimal(request.POST.get("declared_amount", "0").replace(",", "."))
                application.notes = request.POST.get("notes", "")
                
                # File uploads
                if "contract_file" in request.FILES:
                    application.contract_file = request.FILES["contract_file"]
                    application.contract_original_name = request.FILES["contract_file"].name
                if "receipt_file" in request.FILES:
                    application.receipt_file = request.FILES["receipt_file"]
                    application.receipt_original_name = request.FILES["receipt_file"].name
                    
                if action == "submit_to_accounting":
                    if not application.contract_file or not application.receipt_file:
                        messages.error(request, "Shartnoma va to'lov cheki yuklanishi shart.")
                    else:
                        old_status = application.status
                        application.status = RetakeApplicationStatus.IN_REVIEW
                        application.submitted_at = timezone.now()
                        application.items.all().update(status=RetakeItemStatus.SUBMITTED_TO_ACCOUNTING)
                        log_workflow_event(application, "submitted", old_status, application.status, actor=request.user)
                        messages.success(request, "Ariza buxgalteriyaga yuborildi.")
                else:
                    messages.success(request, "O'zgarishlar saqlandi.")
                application.save()

            elif action in ["verify_payment", "reject_payment"] and can_account_review:
                acc_amount = Decimal(request.POST.get("accountant_amount", "0").replace(",", "."))
                comment = request.POST.get("comment", "")
                old_status = application.status
                
                if action == "verify_payment":
                    if acc_amount <= 0:
                        raise ValueError("Buxgalteriya summasi kiritilishi kerak.")
                    application.accountant_amount = acc_amount
                    application.accountant_comment = comment
                    application.status = RetakeApplicationStatus.PARTIALLY_APPROVED
                    application.items.all().update(status=RetakeItemStatus.AWAITING_SUPERVISOR, payment_date=timezone.now().date())
                    
                    # Create payment reviews for items
                    for item in application.items.all():
                        PaymentReview.objects.create(
                            application_item=item,
                            status=PaymentReviewStatus.APPROVED,
                            checked_by=request.user,
                            comment=comment
                        )
                    log_workflow_event(application, "payment_verified", old_status, application.status, actor=request.user, comment=comment)
                    messages.success(request, "To'lov tasdiqlandi. Ariza rahbar tasdig'iga yuborildi.")
                else:
                    application.status = RetakeApplicationStatus.RETURNED
                    application.items.all().update(status=RetakeItemStatus.PAYMENT_REJECTED)
                    log_workflow_event(application, "payment_rejected", old_status, application.status, actor=request.user, comment=comment)
                    messages.warning(request, "Ariza to'lov rad etilganligi sababli qaytarildi.")
                application.save()

            elif action in ["supervisor_approve", "supervisor_reject"] and can_supervisor_review:
                comment = request.POST.get("comment", "")
                old_status = application.status
                if action == "supervisor_approve":
                    application.status = RetakeApplicationStatus.APPROVED
                    application.items.all().update(status=RetakeItemStatus.APPROVED_FOR_GROUPING)
                    log_workflow_event(application, "supervisor_approved", old_status, application.status, actor=request.user, comment=comment)
                    messages.success(request, "Ariza to'liq tasdiqlandi.")
                else:
                    application.status = RetakeApplicationStatus.RETURNED
                    application.items.all().update(status=RetakeItemStatus.SUPERVISOR_RETURNED)
                    log_workflow_event(application, "supervisor_rejected", old_status, application.status, actor=request.user, comment=comment)
                    messages.warning(request, "Ariza rahbar tomonidan qaytarildi.")
                application.save()

        except Exception as e:
            messages.error(request, f"Xatolik: {str(e)}")
            
        return redirect('retake:application_detail', app_id=application.id)
        
    return render(request, "retake/application_detail.html", {
        "application": application,
        "can_edit_submission": can_edit,
        "can_account_review": can_account_review,
        "can_supervisor_review": can_supervisor_review,
        "role": role,
        "workflow_events": WorkflowEvent.objects.filter(entity_type="retake_application", object_id=application.id).order_by('-created_at')
    })
