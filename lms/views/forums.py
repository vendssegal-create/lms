from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from lms.models import Course, Section, ForumTopic, ForumPost, Notification
from users.utils.roles import Role, get_user_role, role_required

@login_required
def course_forum(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    topics = ForumTopic.objects.filter(course=course).select_related('author').order_by('-created_at')
    return render(request, "lms/forum_list.html", {
        "course": course,
        "topics": topics
    })

@login_required
def forum_topic_detail(request, topic_id):
    topic = get_object_or_404(ForumTopic, id=topic_id)
    replies = ForumPost.objects.filter(topic=topic).select_related('author').order_by('created_at')
    return render(request, "lms/forum_topic.html", {
        "topic": topic,
        "replies": replies
    })

@login_required
def create_forum_topic(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    if request.method == "POST":
        title = request.POST.get("title").strip()
        content = request.POST.get("content").strip()
        section_id = request.POST.get("section_id")
        
        topic = ForumTopic.objects.create(
            course=course,
            section_id=section_id if section_id else None,
            author=request.user,
            title=title,
            content=content
        )
        
        # Notify the teacher
        Notification.objects.create(
            user=course.teacher,
            title="Yangi forum mavzusi",
            message=f"{request.user.get_full_name()} '{course.title}' kursida yangi mavzu ochdi: '{title}'",
            link=f"/lms/forum/topic/{topic.id}/"
        )
        
        messages.success(request, "Yangi mavzu muvaffaqiyatli ochildi.")
        return redirect('lms:forum_topic_detail', topic_id=topic.id)
        
    return render(request, "lms/forum_new_topic.html", {"course": course})

@login_required
def post_forum_reply(request, topic_id):
    topic = get_object_or_404(ForumTopic, id=topic_id)
    if request.method == "POST":
        content = request.POST.get("content").strip()
        if not content:
            messages.error(request, "Xabar matni bo'sh bo'lishi mumkin emas.")
            return redirect('lms:forum_topic_detail', topic_id=topic.id)
            
        post = ForumPost.objects.create(
            topic=topic,
            author=request.user,
            content=content
        )
        
        # Notify topic author
        if topic.author != request.user:
            Notification.objects.create(
                user=topic.author,
                title="Mavzungizga yangi javob",
                message=f"{request.user.get_full_name()} sizning '{topic.title}' mavzungizga javob qoldirdi.",
                link=f"/lms/forum/topic/{topic.id}/"
            )
            
        # Notify the teacher (if they are not the one replying or the author)
        if topic.course.teacher != request.user and topic.course.teacher != topic.author:
            Notification.objects.create(
                user=topic.course.teacher,
                title="Forumda yangi faollik",
                message=f"'{topic.course.title}' kurasidagi '{topic.title}' mavzusida yangi xabar qoldirildi.",
                link=f"/lms/forum/topic/{topic.id}/"
            )
            
        messages.success(request, "Javobingiz qoldirildi.")
    return redirect('lms:forum_topic_detail', topic_id=topic.id)
