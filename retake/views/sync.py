from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.conf import settings
from django.utils import timezone
from hemis.models import HemisSyncLog, HemisStudentSnapshot, HemisCurriculumSnapshot, HemisRoomSnapshot
from users.models import TeacherProfile
from hemis.services import HemisAdminSyncService
from users.utils.roles import Role, get_user_role

def _get_config_ok():
    """HEMIS sozlamalari to'liq o'rnatilganligini tekshiradi."""
    token = getattr(settings, 'HEMIS_BACKEND_API_TOKEN', '').strip()
    base_url = getattr(settings, 'HEMIS_REST_BASE_URL', '').strip()
    return bool(token and base_url)

@login_required
def sync_panel(request):
    role = get_user_role(request.user, request.session)
    if role != Role.SUPER_ADMIN:
        messages.error(request, "Ushbu sahifaga faqat Super admin kira oladi.")
        return redirect('retake:retake_dashboard')

    has_running = HemisSyncLog.objects.filter(status='running').exists()
    last_syncs = HemisSyncLog.objects.order_by('-started_at')[:20]

    db_stats = {
        "students": HemisStudentSnapshot.objects.count(),
        "teachers": TeacherProfile.objects.count(),
        "curriculums": HemisCurriculumSnapshot.objects.count(),
        "rooms": HemisRoomSnapshot.objects.count(),
    }

    return render(request, "retake/sync_panel.html", {
        "last_syncs": last_syncs,
        "db_stats": db_stats,
        "config_ok": _get_config_ok(),
        "has_running": has_running,
        "hemis_base_url": getattr(settings, 'HEMIS_REST_BASE_URL', ''),
    })

@login_required
def test_connection(request):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)

    role = get_user_role(request.user, request.session)
    if role != Role.SUPER_ADMIN:
        return JsonResponse({"error": "Ruxsat yo'q. Faqat Super admin kirishishi mumkin."}, status=403)

    if not _get_config_ok():
        return JsonResponse({
            "success": False,
            "results": {"config": {"ok": False, "message": "HEMIS_BACKEND_API_TOKEN yoki HEMIS_REST_BASE_URL sozlanmagan."}}
        })

    service = HemisAdminSyncService()
    results = {}
    try:
        rows, pagination = service.client.list_students(page=1, limit=1)
        results["students"] = {"ok": True, "message": f"{pagination.get('totalCount', '?')} ta talaba mavjud"}
    except Exception as e:
        results["students"] = {"ok": False, "message": str(e)}

    return JsonResponse({"success": all(r["ok"] for r in results.values()), "results": results})

import threading
from django.db import close_old_connections

@login_required
def run_sync(request):
    if request.method != "POST":
        return redirect('retake:retake_sync_panel')

    role = get_user_role(request.user, request.session)
    if role != Role.SUPER_ADMIN:
        messages.error(request, "Sinxronlashni faqat Super admin boshqara oladi.")
        return redirect('retake:retake_dashboard')

    if not _get_config_ok():
        messages.error(request, "HEMIS sozlamalari to'liq emas. HEMIS_BACKEND_API_TOKEN va HEMIS_REST_BASE_URL ni settings da o'rnating.")
        return redirect('retake:retake_sync_panel')

    scope = request.POST.get("scope", "").strip()
    valid_scopes = {"all", "students", "teachers", "curriculums", "rooms"}
    if scope not in valid_scopes:
        messages.error(request, f"Noto'g'ri scope: '{scope}'.")
        return redirect('retake:retake_sync_panel')

    service = HemisAdminSyncService()
    user = request.user

    def sync_worker():
        try:
            if scope == "all":
                service.sync_all(initiated_by=user)
            elif scope == "students":
                service.sync_students(initiated_by=user)
            elif scope == "teachers":
                service.sync_teachers(initiated_by=user)
            elif scope == "curriculums":
                service.sync_curriculums(initiated_by=user)
            elif scope == "rooms":
                service.sync_rooms(initiated_by=user)
        except Exception:
            # Errors are logged by the service in HemisSyncLog
            pass
        finally:
            close_old_connections()

    thread = threading.Thread(target=sync_worker)
    thread.daemon = True
    thread.start()

    scope_labels = {
        "all": "Barcha ma'lumotlar",
        "students": "Talabalar",
        "teachers": "O'qituvchilar",
        "curriculums": "O'quv rejalari",
        "rooms": "Xonalar",
    }
    messages.info(request, f"'{scope_labels.get(scope, scope)}' sinxronlash jarayoni fonda boshlandi. Sahifa avtomatik yangilanib boradi.")
    return redirect('retake:retake_sync_panel')
