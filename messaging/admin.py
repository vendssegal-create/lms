from django.contrib import admin

from .models import DirectMessage, DirectThread


@admin.register(DirectThread)
class DirectThreadAdmin(admin.ModelAdmin):
    list_display = ("id", "user1", "user2", "updated_at", "created_at")
    search_fields = ("user1__username", "user2__username")


@admin.register(DirectMessage)
class DirectMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "thread", "sender", "created_at")
    search_fields = ("body", "sender__username")
    list_filter = ("created_at",)

