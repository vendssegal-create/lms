from __future__ import annotations

from django.conf import settings
from django.db import models


class DirectThread(models.Model):
    """
    Minimal 1:1 chat thread.

    We keep the participant pair as (user1, user2) with a unique constraint.
    Creation code must ensure user1_id < user2_id for stable uniqueness.
    """

    user1 = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="direct_threads_as_user1",
    )
    user2 = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="direct_threads_as_user2",
    )

    user1_last_read_at = models.DateTimeField(null=True, blank=True)
    user2_last_read_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user1", "user2"], name="uniq_direct_thread_pair"),
        ]

    def __str__(self) -> str:
        return f"DirectThread({self.user1_id}, {self.user2_id})"


class DirectMessage(models.Model):
    thread = models.ForeignKey(DirectThread, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="direct_messages_sent",
    )
    body = models.TextField()
    attachment = models.FileField(upload_to="direct_messages/", null=True, blank=True)
    attachment_name = models.CharField(max_length=255, default="", blank=True)
    attachment_size = models.PositiveBigIntegerField(null=True, blank=True)
    attachment_mime = models.CharField(max_length=128, blank=True, default="")
    reply_to = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="replies",
    )
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["thread", "-created_at"]),
        ]
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"DirectMessage({self.thread_id}, {self.sender_id}, {self.created_at})"


class MessageReaction(models.Model):
    message = models.ForeignKey(DirectMessage, on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    emoji = models.CharField(max_length=8)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("message", "user", "emoji")
