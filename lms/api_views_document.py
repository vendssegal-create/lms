"""
Document editor API views for certificate template DOCX load/save/version
and generic resource file loading.
"""
import json
import mimetypes
from django.http import JsonResponse, HttpResponse, FileResponse
from django.views.decorators.http import require_GET, require_POST
from django.core.files.base import ContentFile
from django.utils import timezone

from .models import CertificateTemplate, CertificateTemplateVersion, SectionResource


def _can_manage_template(request, template):
    """Check if the user can manage this certificate template."""
    if not request.user.is_authenticated:
        return False
    if request.user.is_superuser or request.user.is_staff:
        return True
    if template.course and hasattr(template.course, 'teacher'):
        return template.course.teacher == request.user
    return False


@require_GET
def template_docx_load(request, template_id):
    """Return the raw docx bytes for the given certificate template."""
    try:
        template = CertificateTemplate.objects.get(pk=template_id)
    except CertificateTemplate.DoesNotExist:
        return JsonResponse({'error': 'Shablon topilmadi'}, status=404)

    if not _can_manage_template(request, template):
        return JsonResponse({'error': 'Ruxsat berilmagan'}, status=403)

    if not template.docx_file:
        from .services.certificate_service import ensure_default_certificate_docx_on_disk
        from django.conf import settings
        default_path = ensure_default_certificate_docx_on_disk()
        if default_path and default_path.is_file():
            return FileResponse(
                open(default_path, 'rb'),
                content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                as_attachment=False,
            )
        return JsonResponse({'error': 'DOCX fayl topilmadi'}, status=404)

    return FileResponse(
        template.docx_file.open('rb'),
        content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        as_attachment=False,
    )


@require_POST
def template_docx_save(request, template_id):
    """Save edited docx bytes, create a version of the old one, invalidate PDF cache."""
    try:
        template = CertificateTemplate.objects.get(pk=template_id)
    except CertificateTemplate.DoesNotExist:
        return JsonResponse({'error': 'Shablon topilmadi'}, status=404)

    if not _can_manage_template(request, template):
        return JsonResponse({'error': 'Ruxsat berilmagan'}, status=403)

    docx_file = request.FILES.get('docx_file')
    if not docx_file:
        return JsonResponse({'error': 'docx_file talab qilinadi'}, status=400)

    version_id = None
    if template.docx_file:
        last_version = (
            CertificateTemplateVersion.objects
            .filter(template=template)
            .order_by('-version_number')
            .first()
        )
        next_num = (last_version.version_number + 1) if last_version else 1
        ver = CertificateTemplateVersion.objects.create(
            template=template,
            docx_file=template.docx_file,
            version_number=next_num,
            created_by=request.user if request.user.is_authenticated else None,
            note=request.POST.get('note', ''),
        )
        version_id = ver.id

    template.docx_file.save(
        docx_file.name or 'certificate_template.docx',
        ContentFile(docx_file.read()),
        save=False,
    )
    template.updated_at = timezone.now()
    template.save(update_fields=['docx_file', 'updated_at'])

    try:
        from .services.certificate_service import schedule_certificate_pdf_warm
        if template.course:
            schedule_certificate_pdf_warm(template.course)
    except Exception:
        pass

    return JsonResponse({
        'success': True,
        'version_id': version_id,
        'updated_at': template.updated_at.isoformat(),
    })


@require_GET
def template_versions_list(request, template_id):
    """List all versions of a certificate template."""
    try:
        template = CertificateTemplate.objects.get(pk=template_id)
    except CertificateTemplate.DoesNotExist:
        return JsonResponse({'error': 'Shablon topilmadi'}, status=404)

    if not _can_manage_template(request, template):
        return JsonResponse({'error': 'Ruxsat berilmagan'}, status=403)

    versions = CertificateTemplateVersion.objects.filter(template=template).select_related('created_by')
    data = [
        {
            'id': v.id,
            'version_number': v.version_number,
            'created_by_name': (
                v.created_by.get_full_name() or v.created_by.username
                if v.created_by else '—'
            ),
            'created_at': v.created_at.isoformat(),
            'note': v.note,
        }
        for v in versions
    ]
    return JsonResponse(data, safe=False)


@require_POST
def template_version_restore(request, template_id, version_id):
    """Restore a previous version of the template's docx file."""
    try:
        template = CertificateTemplate.objects.get(pk=template_id)
    except CertificateTemplate.DoesNotExist:
        return JsonResponse({'error': 'Shablon topilmadi'}, status=404)

    if not _can_manage_template(request, template):
        return JsonResponse({'error': 'Ruxsat berilmagan'}, status=403)

    try:
        version = CertificateTemplateVersion.objects.get(pk=version_id, template=template)
    except CertificateTemplateVersion.DoesNotExist:
        return JsonResponse({'error': 'Versiya topilmadi'}, status=404)

    if template.docx_file:
        last_version = (
            CertificateTemplateVersion.objects
            .filter(template=template)
            .order_by('-version_number')
            .first()
        )
        next_num = (last_version.version_number + 1) if last_version else 1
        CertificateTemplateVersion.objects.create(
            template=template,
            docx_file=template.docx_file,
            version_number=next_num,
            created_by=request.user if request.user.is_authenticated else None,
            note=f'Versiya {version.version_number} tiklanishidan oldin saqlangan',
        )

    content = version.docx_file.read()
    template.docx_file.save('certificate_template.docx', ContentFile(content), save=False)
    template.updated_at = timezone.now()
    template.save(update_fields=['docx_file', 'updated_at'])

    try:
        from .services.certificate_service import schedule_certificate_pdf_warm
        if template.course:
            schedule_certificate_pdf_warm(template.course)
    except Exception:
        pass

    return JsonResponse({'success': True})


@require_GET
def resource_file_load(request, resource_id):
    """Return the raw bytes of a section resource file for in-browser viewing."""
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Avtorizatsiya talab qilinadi'}, status=401)

    try:
        resource = SectionResource.objects.select_related('section__course').get(pk=resource_id)
    except SectionResource.DoesNotExist:
        return JsonResponse({'error': 'Resurs topilmadi'}, status=404)

    course = resource.section.course
    is_teacher = (
        request.user.is_superuser
        or request.user.is_staff
        or (hasattr(course, 'teacher') and course.teacher == request.user)
    )

    if not is_teacher and not resource.is_visible:
        return JsonResponse({'error': 'Resurs mavjud emas'}, status=404)

    if not resource.file:
        return JsonResponse({'error': 'Fayl topilmadi'}, status=404)

    content_type = resource.mime_type or mimetypes.guess_type(resource.file.name)[0] or 'application/octet-stream'
    response = FileResponse(resource.file.open('rb'), content_type=content_type)
    response['Content-Disposition'] = f'inline; filename="{resource.original_filename or resource.file.name}"'
    return response
