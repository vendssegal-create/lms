import json
import requests
from django.utils import timezone
from django.http import HttpResponse, JsonResponse
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404
from django.conf import settings
from urllib.parse import urlparse
from lms.models import TestAttempt, ProctorLog, Test

@login_required
def proctor_log(request):
    """
    Handle proctoring violation logs from the frontend.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
        
    try:
        data = json.loads(request.body)
        attempt_id = data.get("attempt_id")
        event_type = data.get("event")
        details = data.get("details", {})
        
        student_profile = getattr(request.user, 'student_profile', None)
        if not student_profile:
             return JsonResponse({"error": "Student profile not found"}, status=403)
             
        attempt = get_object_or_404(TestAttempt, id=attempt_id, student=student_profile)
        
        # Log the event
        ProctorLog.objects.create(
            attempt=attempt,
            test=attempt.test,
            event_type=event_type,
            details=details
        )
        
        # Check for auto-submit due to too many tab switches
        violations = ProctorLog.objects.filter(
            attempt=attempt, 
            event_type__in=['tab_switch', 'fullscreen_exit']
        ).count()
        
        auto_submit = False
        if violations >= attempt.test.max_tab_switches:
            auto_submit = True
            if not attempt.is_completed:
                attempt.is_completed = True
                attempt.finished_at = timezone.now()
                attempt.save()
            
        return JsonResponse({"status": "success", "auto_submit": auto_submit})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@login_required
def verify_face_success(request, test_id):
    """
    Mark face verification as successful in the session.
    """
    request.session[f"face_verified_{test_id}"] = True
    return JsonResponse({"success": True})

@login_required
def proxy_image(request):
    """
    Proxy image from external URL to bypass CORS.
    Used for HEMIS profile pictures in Face ID / Proctoring.
    """
    url = request.GET.get("url", "").strip()
    if not url:
        return HttpResponse(status=400)
        
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return HttpResponse(status=400)
        
    try:
        response = requests.get(url, timeout=10, stream=True)
        if response.status_code == 200:
            content_type = response.headers.get('Content-Type', 'image/jpeg')
            return HttpResponse(response.content, content_type=content_type)
        return HttpResponse(status=response.status_code)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
