from __future__ import annotations

import json

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.utils import timezone

from lms.models import Notification

from .models import DirectMessage, DirectThread


class DirectThreadConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return

        thread_id_raw = self.scope.get("url_route", {}).get("kwargs", {}).get("thread_id")
        try:
            self.thread_id = int(thread_id_raw)
        except (TypeError, ValueError):
            await self.close(code=4400)
            return

        thread = await sync_to_async(
            lambda: DirectThread.objects.filter(id=self.thread_id).first()
        )()
        if not thread or user.id not in (thread.user1_id, thread.user2_id):
            await self.close(code=4403)
            return

        self.group_name = f"direct_thread_{self.thread_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        group = getattr(self, "group_name", None)
        if group:
            await self.channel_layer.group_discard(group, self.channel_name)

    async def receive_json(self, content, **kwargs):
        action = content.get("action")
        if action == "send":
            await self._handle_send(content)
            return
        if action == "mark_read":
            await self._handle_mark_read()
            return
        if action == "typing_start":
            await self._handle_typing(True)
            return
        if action == "typing_stop":
            await self._handle_typing(False)
            return
        await self.send_json({"type": "error", "error": "Unknown action"})

    async def _handle_typing(self, is_typing: bool):
        user = self.scope["user"]
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "user.typing",
                "user_id": user.id,
                "full_name": user.get_full_name() or user.username,
                "is_typing": is_typing,
            },
        )

    async def _handle_send(self, content: dict):
        user = self.scope["user"]
        body = (content.get("body") or "").strip()
        reply_to_id = content.get("reply_to_id")
        if not body:
            await self.send_json({"type": "error", "error": "Xabar matni bo'sh."})
            return

        def _create():
            thread = DirectThread.objects.get(id=self.thread_id)
            kwargs = {"thread": thread, "sender": user, "body": body[:4000]}
            if reply_to_id:
                try:
                    reply_to = DirectMessage.objects.get(id=int(reply_to_id), thread=thread)
                    kwargs["reply_to"] = reply_to
                except (DirectMessage.DoesNotExist, TypeError, ValueError):
                    pass
            msg = DirectMessage.objects.create(**kwargs)
            DirectThread.objects.filter(id=thread.id).update(updated_at=timezone.now())
            other_id = thread.user2_id if thread.user1_id == user.id else thread.user1_id
            Notification.objects.create(
                user_id=other_id,
                title="Yangi xabar",
                message=f"{user.get_full_name() or user.username}: {body[:120]}",
                link=f"/messages/{thread.id}",
            )
            return msg

        msg = await sync_to_async(_create)()

        reply_data = None
        if msg.reply_to_id:
            reply_to = await sync_to_async(lambda: msg.reply_to)()
            reply_data = {
                "id": reply_to.id,
                "sender_id": reply_to.sender_id,
                "body": reply_to.body[:120] if not reply_to.is_deleted else "[o'chirildi]",
                "attachment_name": reply_to.attachment_name or "",
            }

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "message.created",
                "message": {
                    "id": msg.id,
                    "thread_id": msg.thread_id,
                    "sender_id": msg.sender_id,
                    "body": msg.body,
                    "created_at": msg.created_at.isoformat(),
                    "updated_at": msg.created_at.isoformat(),
                    "attachment_url": None,
                    "attachment_name": "",
                    "attachment_size": None,
                    "attachment_mime": "",
                    "reply_to": reply_data,
                    "is_deleted": False,
                    "is_read": False,
                    "read_at": None,
                    "reactions": {},
                },
            },
        )

    async def _handle_mark_read(self):
        user = self.scope["user"]
        now = timezone.now()

        def _mark():
            thread = DirectThread.objects.get(id=self.thread_id)
            if user.id == thread.user1_id:
                DirectThread.objects.filter(id=thread.id).update(user1_last_read_at=now)
            elif user.id == thread.user2_id:
                DirectThread.objects.filter(id=thread.id).update(user2_last_read_at=now)
            DirectMessage.objects.filter(
                thread=thread,
                is_read=False,
                is_deleted=False,
            ).exclude(sender=user).update(is_read=True, read_at=now)

        await sync_to_async(_mark)()
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "messages.read", "reader_id": user.id, "read_at": now.isoformat()},
        )
        await self.send_json({"type": "read.ok"})

    async def message_created(self, event):
        await self.send_json({"type": "message.created", "message": event.get("message")})

    async def message_deleted(self, event):
        await self.send_json({"type": "message.deleted", "message_id": event["message_id"]})

    async def message_reacted(self, event):
        await self.send_json({
            "type": "message.reacted",
            "message_id": event["message_id"],
            "reactions": event["reactions"],
        })

    async def user_typing(self, event):
        if event["user_id"] == self.scope["user"].id:
            return
        await self.send_json({
            "type": "user.typing",
            "user_id": event["user_id"],
            "full_name": event["full_name"],
            "is_typing": event["is_typing"],
        })

    async def messages_read(self, event):
        await self.send_json({
            "type": "messages.read",
            "reader_id": event["reader_id"],
            "read_at": event["read_at"],
        })
