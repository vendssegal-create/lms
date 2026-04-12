from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from ..models import RetakeAssessmentConfig, ExamSheetTemplate, ExamSheet
from users.utils.roles import Role, get_user_role
from django.template import Template, Context

@login_required
def assessment_control(request):
    role = get_user_role(request.user, request.session)
    if role != Role.SUPER_ADMIN:
        return redirect('retake:retake_dashboard')
        
    configs = RetakeAssessmentConfig.objects.all()
    sheets = ExamSheet.objects.all().order_by('-created_at')[:50] # Last 50 sheets
    
    if request.method == "POST":
        if "update_config" in request.POST:
            config_id = request.POST.get("config_id")
            config = get_object_or_404(RetakeAssessmentConfig, id=config_id)
            config.max_score = request.POST.get("max_score")
            config.is_active = "is_active" in request.POST
            config.save()
            messages.success(request, f"{config.control_type.upper()} sozlamalari yangilandi.")
        
        elif "toggle_sheet" in request.POST:
            sheet_id = request.POST.get("sheet_id")
            sheet = get_object_or_404(ExamSheet, id=sheet_id)
            from ..models import ExamSheetStatus
            if sheet.status == ExamSheetStatus.LOCKED:
                sheet.status = ExamSheetStatus.OPEN
            else:
                sheet.status = ExamSheetStatus.LOCKED
            sheet.save()
            messages.success(request, f"#{sheet.sheet_no} holati o'zgartirildi.")
            
        return redirect('retake:retake_admin_assessment_control')

    return render(request, "retake/admin_assessment_control.html", {
        "configs": configs,
        "sheets": sheets
    })

@login_required
def template_editor(request):
    role = get_user_role(request.user, request.session)
    if role != Role.SUPER_ADMIN:
        return redirect('retake:retake_dashboard')
        
    template = ExamSheetTemplate.objects.filter(is_active=True).first()
    if not template:
        # Create a default one if none exists based on my previous hardcoded one
        default_html = """
<div class="h-1-shakl">1-shakl</div>
<div class="f-univ-name">[[UNIVERSITY_NAME]]</div>
<div class="f-doc-title">QAYTA TOPSHIRISHNI BAHOLASH QAYDNOMASI № {{ sheet_no }}</div>
<div class="f-meta-row"><strong>Fakultet:</strong> {{ faculty }}, <strong>Guruh:</strong> {{ group_code }}</div>
<div class="f-meta-row"><strong>Fan:</strong> {{ subject_name }}</div>
<div class="f-meta-row"><strong>Sana:</strong> {{ date }}</div>
[[STUDENT_TABLE]]
<div class="f-footer-stats">[[STATS_SUMMARY]]</div>
        """
        template = ExamSheetTemplate.objects.create(
            name="Standart Qaydnoma",
            html_content=default_html,
            is_active=True
        )

    if request.method == "POST":
        template.html_content = request.POST.get("html_content")
        template.css_content = request.POST.get("css_content")
        template.save()
        messages.success(request, "Qaydnoma shabloni muvaffaqiyatli saqlandi.")
        return redirect('retake:retake_admin_template_editor')

    return render(request, "retake/admin_template_editor.html", {
        "template": template
    })
