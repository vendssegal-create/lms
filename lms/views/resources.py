from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from lms.models import Course, Section, SectionResource, SectionResourceType
from users.utils.roles import Role, get_user_role, role_required
import json

@login_required
@role_required(Role.TEACHER, Role.SUPER_ADMIN, Role.ACADEMIC_BOARD)
def add_section_resource(request, section_id):
    section = get_object_or_404(Section, id=section_id)
    if section.course.teacher_id != request.user.id and not request.user.is_superuser:
        messages.error(request, "Bu bo'lim sizning kursingizga tegishli emas.")
        return redirect("lms:portal")
    if request.method == "POST":
        resource_type = request.POST.get("resource_type")
        title = (request.POST.get("title") or "").strip()
        if not title:
            messages.error(request, "Sarlavha kiritilishi shart.")
            return redirect("lms:course_detail", course_id=section.course_id)
        
        resource = SectionResource(
            section=section,
            title=title,
            resource_type=resource_type,
            order=section.resources.count()
        )
        
        if resource_type == SectionResourceType.FILE:
            uploaded_file = request.FILES.get("resource_file")
            if uploaded_file:
                resource.file = uploaded_file
                resource.original_filename = uploaded_file.name
        elif resource_type in [SectionResourceType.LINK, SectionResourceType.VIDEO]:
            resource.url = request.POST.get("url")
        elif resource_type == SectionResourceType.TEXT:
            resource.content = request.POST.get("content")
            
        resource.save()
        messages.success(request, "Resurs muvaffaqiyatli qo'shildi.")
        
        if request.headers.get("X-Requested-With") == "XMLHttpRequest":
            return JsonResponse({"success": True})
            
    return redirect('lms:course_detail', course_id=section.course.id)

@login_required
@role_required(Role.TEACHER, Role.SUPER_ADMIN, Role.ACADEMIC_BOARD)
def delete_resource(request, resource_id):
    resource = get_object_or_404(SectionResource, id=resource_id)
    course_id = resource.section.course.id
    if request.method == "POST":
        resource.delete()
        messages.success(request, "Resurs o'chirildi.")
    return redirect('lms:course_detail', course_id=course_id)

@login_required
@role_required(Role.TEACHER, Role.SUPER_ADMIN, Role.ACADEMIC_BOARD)
def reorder_resources(request, section_id):
    section = get_object_or_404(Section, id=section_id)
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            resource_ids = data.get("order", [])
            for idx, rid in enumerate(resource_ids):
                SectionResource.objects.filter(id=rid, section=section).update(order=idx)
            return JsonResponse({"success": True})
        except Exception as e:
            return JsonResponse({"success": False, "error": str(e)}, status=400)
    return JsonResponse({"success": False}, status=405)

@login_required
@role_required(Role.TEACHER, Role.SUPER_ADMIN, Role.ACADEMIC_BOARD)
def reorder_sections(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            section_ids = data.get("order", [])
            for idx, sid in enumerate(section_ids):
                Section.objects.filter(id=sid, course=course).update(order=idx + 1)
            return JsonResponse({"success": True})
        except Exception as e:
            return JsonResponse({"success": False, "error": str(e)}, status=400)
    return JsonResponse({"success": False}, status=405)

@login_required
@role_required(Role.TEACHER, Role.SUPER_ADMIN, Role.ACADEMIC_BOARD)
def rename_resource(request, resource_id):
    resource = get_object_or_404(SectionResource, id=resource_id)
    if request.method == "POST":
        new_title = request.POST.get("title", "").strip()
        if new_title:
            resource.title = new_title
            resource.save()
            messages.success(request, "Resurs nomi o'zgartirildi.")
    return redirect('lms:course_detail', course_id=resource.section.course.id)

@login_required
@role_required(Role.TEACHER, Role.SUPER_ADMIN, Role.ACADEMIC_BOARD)
def rename_section(request, section_id):
    section = get_object_or_404(Section, id=section_id)
    if request.method == "POST":
        new_title = request.POST.get("title", "").strip()
        if new_title:
            section.title = new_title
            section.save()
            messages.success(request, "Bo'lim nomi o'zgartirildi.")
    return redirect('lms:course_detail', course_id=section.course.id)

@login_required
@role_required(Role.TEACHER, Role.SUPER_ADMIN, Role.ACADEMIC_BOARD)
def delete_section(request, section_id):
    section = get_object_or_404(Section, id=section_id)
    course_id = section.course.id
    if request.method == "POST":
        section.delete()
        messages.success(request, "Bo'lim o'chirildi.")
    return redirect('lms:course_detail', course_id=course_id)

@login_required
def mark_section_complete_api(request, section_id):
    from lms.models import SectionCompletion
    section = get_object_or_404(Section, id=section_id)
    completion, created = SectionCompletion.objects.get_or_create(
        section=section,
        student=request.user
    )
    return JsonResponse({"success": True, "created": created})
