from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from lms.models import Course, Notification, CourseFeedback
from django.db.models import Avg

@login_required
def api_notifications(request):
    notifications = Notification.objects.filter(user=request.user).order_by('-created_at')[:5]
    unread_count = Notification.objects.filter(user=request.user, is_read=False).count()
    return JsonResponse({
        "unread_count": unread_count,
        "notifications": [{
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "link": n.link,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat()
        } for n in notifications]
    })

@login_required
def api_notif_read(request, notif_id):
    if request.method == "POST":
        notif = get_object_or_404(Notification, id=notif_id, user=request.user)
        notif.is_read = True
        notif.save()
        return JsonResponse({"success": True})
    return JsonResponse({"success": False}, status=405)

@login_required
def notifications_view(request):
    notifications = Notification.objects.filter(user=request.user).order_by('-created_at')
    # Mark all as read
    Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
    return render(request, "lms/notifications.html", {"notifications": notifications})

@login_required
def submit_feedback(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    if request.method == "POST":
        rating = int(request.POST.get("rating", 5))
        comment = request.POST.get("comment", "")
        
        feedback, created = CourseFeedback.objects.get_or_create(
            course=course, 
            student=request.user
        )
        feedback.rating = rating
        feedback.comment = comment
        feedback.save()
        
        messages.success(request, "Fikringiz uchun rahmat!")
    return redirect('lms:student_course_detail', course_id=course.id)

@login_required
def view_course_feedback(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    feedbacks = CourseFeedback.objects.filter(course=course).order_by('-created_at')
    avg_rating = feedbacks.aggregate(Avg('rating'))['rating__avg'] or 0
    return render(request, "lms/course_feedback.html", {
        "course": course,
        "feedbacks": feedbacks,
        "avg_rating": round(avg_rating, 1)
    })
