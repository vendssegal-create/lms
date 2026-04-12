from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from decimal import Decimal
from ..models import RetakeCycle, RetakeCycleStatus
from users.utils.roles import Role, get_user_role

@login_required
def cycle_list(request):
    role = get_user_role(request.user, request.session)
    if role not in [Role.SUPER_ADMIN, Role.RET_SUPERVISOR, Role.REGISTRATOR]:
        return redirect('lms:portal')
        
    cycles = RetakeCycle.objects.all().order_by('-created_at')
    return render(request, "retake/cycle_list.html", {"cycles": cycles})

@login_required
def cycle_create(request):
    role = get_user_role(request.user, request.session)
    if role not in [Role.SUPER_ADMIN, Role.RET_SUPERVISOR]:
        messages.error(request, "Davr yaratish uchun faqat Registrator boshlig'i yoki Super admin huquqiga ega.")
        return redirect('retake:retake_cycle_list')

    if request.method == "POST":
        try:
            name = request.POST.get("name", "").strip()
            academic_year = request.POST.get("academic_year", "").strip()
            starts_at = request.POST.get("starts_at")
            ends_at = request.POST.get("ends_at")
            max_credits = Decimal(request.POST.get("max_allowed_credits", "15.00").replace(",", "."))

            cycle = RetakeCycle.objects.create(
                name=name,
                academic_year=academic_year,
                starts_at=starts_at if starts_at else None,
                ends_at=ends_at if ends_at else None,
                max_allowed_credits=max_credits,
                status=RetakeCycleStatus.DRAFT
            )
            messages.success(request, f"Davr '{cycle.name}' yaratildi. Arizalarni qabul qilish uchun holatni 'OCHIQ' qiling.")
            return redirect('retake:retake_cycle_list')
        except Exception as e:
            messages.error(request, f"Xatolik: {str(e)}")

    return render(request, "retake/cycle_form.html", {"cycle": None})

@login_required
def cycle_edit(request, cycle_id):
    role = get_user_role(request.user, request.session)
    if role not in [Role.SUPER_ADMIN, Role.RET_SUPERVISOR]:
        messages.error(request, "Davrni tahrirlash huquqingiz yo'q.")
        return redirect('retake:retake_cycle_list')

    cycle = get_object_or_404(RetakeCycle, id=cycle_id)

    if request.method == "POST":
        try:
            cycle.name = request.POST.get("name", "").strip()
            cycle.academic_year = request.POST.get("academic_year", "").strip()
            cycle.starts_at = request.POST.get("starts_at") or None
            cycle.ends_at = request.POST.get("ends_at") or None
            cycle.max_allowed_credits = Decimal(request.POST.get("max_allowed_credits", "15.00").replace(",", "."))
            cycle.status = request.POST.get("status", cycle.status)
            cycle.save()
            messages.success(request, f"Davr '{cycle.name}' muvaffaqiyatli yangilandi.")
            return redirect('retake:retake_cycle_list')
        except Exception as e:
            messages.error(request, f"Xatolik: {str(e)}")

    return render(request, "retake/cycle_form.html", {"cycle": cycle})
