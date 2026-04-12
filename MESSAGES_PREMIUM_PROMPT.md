# Xabarlar Tizimini Mukammal Qilish — Senior Fullstack Prompt

## Loyiha konteksti

**Stack:** Django 5 + Django Channels (WebSocket) + React 18 + TypeScript + Tailwind CSS v4  
**Mavjud holat:**
- `DirectThread` — 1:1 chat thread modeli
- `DirectMessage` — matn + fayl attachment  
- `DirectThreadConsumer` — WebSocket (send + mark_read)
- Frontend: `MessagesPage` (thread ro'yxati), `MessageThreadPage` (chat)
- Muammo: Ikkita alohida sahifa — Telegram/WhatsApp kabi **split-panel layout** yo'q

---

## MUAMMO TAHLILI

| Soha | Hozirgi holat | Kerak daraja |
|---|---|---|
| Layout | 2 ta alohida sahifa | Split-panel (sidecar) |
| Typing indicator | Yo'q | Real-time `...` animatsiya |
| O'qildi belgisi | Yo'q | ✓✓ (delivered/read ticks) |
| Xabar o'chirish | Yo'q | Soft delete + real-time |
| Emoji picker | Yo'q | Emoji panel |
| Xabarni quote/reply | Yo'q | Reply preview strip |
| Rasm preview | Yo'q | Lightbox gallery |
| Fayl preview | Yo'q | Yuborishdan oldin preview |
| Infinite scroll | Yo'q | Oldingi xabarlar yuklash |
| Sana ajratgich | Yo'q | "Bugun", "Kecha", sana |
| Xabar guruhlash | Yo'q | Ketma-ket xabarlar birlashadi |
| Online holat | Yo'q | Yashil nuqta |
| Xabar qidirish | Yo'q | Thread ichida search |
| Kontekst menyu | Yo'q | O'ng klik → amallar |

---

## 1-QISM — Backend: Model kengaytirish

### 1.1 `messaging/models.py` — `DirectMessage` yangilash

```python
class DirectMessage(models.Model):
    thread       = models.ForeignKey(DirectThread, on_delete=models.CASCADE, related_name="messages")
    sender       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="direct_messages_sent")
    body         = models.TextField()
    attachment   = models.FileField(upload_to="direct_messages/", null=True, blank=True)
    attachment_name = models.CharField(max_length=255, default="", blank=True)
    attachment_size = models.PositiveBigIntegerField(null=True, blank=True)   # NEW
    attachment_mime = models.CharField(max_length=128, blank=True, default="") # NEW

    # NEW: Reply/Quote
    reply_to     = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="replies"
    )

    # NEW: Soft delete
    is_deleted   = models.BooleanField(default=False)
    deleted_at   = models.DateTimeField(null=True, blank=True)

    # NEW: O'qildi (boshqa user tomonidan)
    is_read      = models.BooleanField(default=False)
    read_at      = models.DateTimeField(null=True, blank=True)

    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)          # NEW: tahrirlash uchun

    class Meta:
        indexes = [models.Index(fields=["thread", "-created_at"])]
        ordering = ["created_at"]


class MessageReaction(models.Model):
    """Xabarga emoji reaksiya."""
    message  = models.ForeignKey(DirectMessage, on_delete=models.CASCADE, related_name="reactions")
    user     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    emoji    = models.CharField(max_length=8)   # "👍", "❤️", "😂" ...
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("message", "user", "emoji")
```

### 1.2 `_serialize_message()` ni yangilash (`messaging/api_views.py`)

```python
def _serialize_message(message: DirectMessage) -> dict:
    attachment_url = None
    if getattr(message, "attachment", None) and not message.is_deleted:
        try:
            attachment_url = message.attachment.url
        except Exception:
            attachment_url = None

    reply_data = None
    if message.reply_to_id and not message.is_deleted:
        try:
            rt = message.reply_to
            reply_data = {
                "id": rt.id,
                "sender_id": rt.sender_id,
                "body": rt.body[:120] if not rt.is_deleted else "[o'chirildi]",
                "attachment_name": rt.attachment_name or "",
            }
        except Exception:
            reply_data = None

    reactions = {}
    for r in getattr(message, "_prefetched_reactions", message.reactions.all()):
        reactions[r.emoji] = reactions.get(r.emoji, 0) + 1

    return {
        "id": message.id,
        "thread_id": message.thread_id,
        "sender_id": message.sender_id,
        "body": "[o'chirildi]" if message.is_deleted else message.body,
        "is_deleted": message.is_deleted,
        "created_at": message.created_at.isoformat(),
        "updated_at": message.updated_at.isoformat(),
        "attachment_url": attachment_url,
        "attachment_name": message.attachment_name or "",
        "attachment_size": message.attachment_size,
        "attachment_mime": message.attachment_mime,
        "reply_to": reply_data,
        "is_read": message.is_read,
        "read_at": message.read_at.isoformat() if message.read_at else None,
        "reactions": reactions,
    }
```

### 1.3 Yangi API endpointlar (`messaging/api_views.py`)

```python
@require_POST
def message_delete(request, message_id: int):
    """Xabarni o'chirish (faqat yuboruvchi)."""
    deny = _require_auth(request)
    if deny: return deny

    msg = get_object_or_404(DirectMessage, id=message_id, sender=request.user)
    msg.is_deleted = True
    msg.deleted_at = timezone.now()
    msg.body = ""
    msg.attachment.delete(save=False)
    msg.save(update_fields=["is_deleted", "deleted_at", "body"])

    # Real-time broadcast
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"direct_thread_{msg.thread_id}",
        {"type": "message.deleted", "message_id": message_id},
    )
    return JsonResponse({"success": True})


@require_POST
def message_react(request, message_id: int):
    """Emoji reaksiya qo'shish yoki olib tashlash (toggle)."""
    deny = _require_auth(request)
    if deny: return deny

    payload = _json_body(request)
    emoji = (payload.get("emoji") or "").strip()
    if not emoji or len(emoji) > 8:
        return JsonResponse({"error": "emoji shart."}, status=400)

    msg = get_object_or_404(DirectMessage, id=message_id)
    if not _can_access_thread(msg.thread, request.user):
        return JsonResponse({"error": "Ruxsat yo'q."}, status=403)

    reaction, created = MessageReaction.objects.get_or_create(
        message=msg, user=request.user, emoji=emoji
    )
    if not created:
        reaction.delete()
        action = "removed"
    else:
        action = "added"

    # Reactions summary
    reactions = {}
    for r in MessageReaction.objects.filter(message=msg):
        reactions[r.emoji] = reactions.get(r.emoji, 0) + 1

    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"direct_thread_{msg.thread_id}",
        {"type": "message.reacted", "message_id": message_id, "reactions": reactions},
    )
    return JsonResponse({"success": True, "action": action, "reactions": reactions})


@require_GET
def thread_search(request, thread_id: int):
    """Thread ichida xabar qidirish."""
    deny = _require_auth(request)
    if deny: return deny

    thread = get_object_or_404(DirectThread, id=thread_id)
    if not _can_access_thread(thread, request.user):
        return JsonResponse({"error": "Ruxsat yo'q."}, status=403)

    q = (request.GET.get("q") or "").strip()
    if len(q) < 2:
        return JsonResponse({"items": []})

    messages = (
        DirectMessage.objects
        .filter(thread=thread, is_deleted=False, body__icontains=q)
        .select_related("sender")
        .order_by("-created_at")[:30]
    )
    return JsonResponse({"items": [_serialize_message(m) for m in messages]})
```

### 1.4 `messaging/api_urls.py` ga yangilarni qo'shish

```python
path("messages/<int:message_id>/delete/", api_views.message_delete, name="api_message_delete"),
path("messages/<int:message_id>/react/", api_views.message_react, name="api_message_react"),
path("threads/<int:thread_id>/search/", api_views.thread_search, name="api_thread_search"),
```

### 1.5 `messaging/consumers.py` — Typing va Read receipt

```python
class DirectThreadConsumer(AsyncJsonWebsocketConsumer):
    # ... mavjud connect/disconnect ...

    async def receive_json(self, content, **kwargs):
        action = content.get("action")
        if action == "send":        await self._handle_send(content); return
        if action == "mark_read":   await self._handle_mark_read(); return
        if action == "typing_start": await self._handle_typing(True); return
        if action == "typing_stop":  await self._handle_typing(False); return
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
                    rt = DirectMessage.objects.get(id=int(reply_to_id), thread=thread)
                    kwargs["reply_to"] = rt
                except (DirectMessage.DoesNotExist, ValueError):
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
            rt = await sync_to_async(lambda: msg.reply_to)()
            reply_data = {
                "id": rt.id,
                "sender_id": rt.sender_id,
                "body": rt.body[:120],
                "attachment_name": rt.attachment_name or "",
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
            last_read_field = "user1_last_read_at" if user.id == thread.user1_id else "user2_last_read_at"
            DirectThread.objects.filter(id=thread.id).update(**{last_read_field: now})
            # Mark messages as read
            DirectMessage.objects.filter(
                thread=thread,
                is_read=False,
                is_deleted=False,
            ).exclude(sender=user).update(is_read=True, read_at=now)

        await sync_to_async(_mark)()
        # Broadcast read receipt to other user
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "messages.read", "reader_id": user.id, "read_at": now.isoformat()},
        )
        await self.send_json({"type": "read.ok"})

    # Channel layer event handlers
    async def message_created(self, event):
        await self.send_json({"type": "message.created", "message": event["message"]})

    async def message_deleted(self, event):
        await self.send_json({"type": "message.deleted", "message_id": event["message_id"]})

    async def message_reacted(self, event):
        await self.send_json({
            "type": "message.reacted",
            "message_id": event["message_id"],
            "reactions": event["reactions"],
        })

    async def user_typing(self, event):
        # O'z typing eventini o'ziga qaytarma
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
```

### 1.6 Migration

```bash
python manage.py makemigrations messaging --name "messages_premium_features"
python manage.py migrate
```

---

## 2-QISM — TypeScript types yangilash (`design/src/types.ts`)

```typescript
export interface MessagesThreadMessage {
  id: number;
  thread_id: number;
  sender_id: number;
  body: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  attachment_url: string | null;
  attachment_name: string;
  attachment_size: number | null;
  attachment_mime: string;
  reply_to: {
    id: number;
    sender_id: number;
    body: string;
    attachment_name: string;
  } | null;
  is_read: boolean;
  read_at: string | null;
  reactions: Record<string, number>; // {"👍": 3, "❤️": 1}
}

// WebSocket event types
export type WsEvent =
  | { type: 'message.created'; message: MessagesThreadMessage }
  | { type: 'message.deleted'; message_id: number }
  | { type: 'message.reacted'; message_id: number; reactions: Record<string, number> }
  | { type: 'user.typing'; user_id: number; full_name: string; is_typing: boolean }
  | { type: 'messages.read'; reader_id: number; read_at: string }
  | { type: 'read.ok' }
  | { type: 'error'; error: string };
```

---

## 3-QISM — API funksiyalar (`design/src/api/messages.ts`)

```typescript
export function deleteMessage(messageId: number) {
  return apiRequest<{ success: boolean }>(
    `/api/messages/${messageId}/delete/`,
    { method: 'POST' }
  );
}

export function reactToMessage(messageId: number, emoji: string) {
  return apiRequest<{ success: boolean; action: string; reactions: Record<string, number> }>(
    `/api/messages/${messageId}/react/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    }
  );
}

export function searchThreadMessages(threadId: number, query: string) {
  return apiRequest<{ items: MessagesThreadMessage[] }>(
    `/api/messages/threads/${threadId}/search/?q=${encodeURIComponent(query)}`
  );
}
```

---

## 4-QISM — Frontend: To'liq qayta qurilgan layout

### 4.1 Arxitektura

```
/messages          → MessagesLayout (split panel)
├── ThreadSidebar  → Thread ro'yxati (chap, 320px)
└── ChatArea       → Aktiv chat (o'ng, flex-1)
    ├── ChatHeader
    ├── MessageList  (infinite scroll + date separators)
    └── ChatInput    (typing indicator, emoji, reply, file)
```

### 4.2 `design/src/pages/MessagesPage.tsx` — To'liq qayta yozing

```tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchThreads, fetchThreadDetail, markThreadRead } from '@/src/api/messages';
import { ThreadSidebar } from '@/src/components/messages/ThreadSidebar';
import { ChatArea } from '@/src/components/messages/ChatArea';
import type { MessagesThreadListItem, MessagesThreadMessage } from '@/src/types';
import { useAuth } from '@/src/features/auth/auth-context';

export default function MessagesPage() {
  const { threadId } = useParams<{ threadId?: string }>();
  const activeThreadId = threadId ? Number(threadId) : null;
  const navigate = useNavigate();
  const { session, refreshSession } = useAuth();

  const [threads, setThreads] = useState<MessagesThreadListItem[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [messages, setMessages] = useState<MessagesThreadMessage[]>([]);
  const [activeThread, setActiveThread] = useState<MessagesThreadListItem | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [isMobileListOpen, setIsMobileListOpen] = useState(!activeThreadId);

  const meId = session?.user?.id || 0;

  // Threads yuklash
  useEffect(() => {
    setThreadsLoading(true);
    fetchThreads()
      .then(r => setThreads(r.items))
      .finally(() => setThreadsLoading(false));
  }, []);

  // Aktiv thread o'zgarganda xabarlarni yuklash
  useEffect(() => {
    if (!activeThreadId) return;
    setMessagesLoading(true);
    const found = threads.find(t => t.id === activeThreadId) || null;
    setActiveThread(found);
    fetchThreadDetail(activeThreadId, 80)
      .then(r => {
        setMessages(r.messages);
        void markThreadRead(activeThreadId)
          .then(() => refreshSession({ silent: true }))
          .catch(() => {});
      })
      .finally(() => setMessagesLoading(false));
  }, [activeThreadId]);

  function selectThread(threadId: number) {
    navigate(`/messages/${threadId}`);
    setIsMobileListOpen(false);
  }

  function handleNewMessage(msg: MessagesThreadMessage) {
    setMessages(prev => {
      if (prev.some(m => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    // Thread ro'yxatini yangilash
    setThreads(prev => prev.map(t =>
      t.id === msg.thread_id
        ? { ...t, last_message: msg, updated_at: msg.created_at }
        : t
    ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
  }

  function handleMessageDeleted(messageId: number) {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, is_deleted: true, body: "[o'chirildi]" } : m
    ));
  }

  function handleReaction(messageId: number, reactions: Record<string, number>) {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, reactions } : m
    ));
  }

  function handleMessagesRead(readerId: number, readAt: string) {
    if (readerId === meId) return;
    setMessages(prev => prev.map(m =>
      m.sender_id === meId && !m.is_read
        ? { ...m, is_read: true, read_at: readAt }
        : m
    ));
  }

  return (
    <div className="flex h-[calc(100vh-96px)] overflow-hidden rounded-[32px] border border-border bg-white shadow-premium">
      {/* LEFT: Thread sidebar */}
      <ThreadSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        loading={threadsLoading}
        meId={meId}
        onSelect={selectThread}
        isMobileOpen={isMobileListOpen}
        onMobileClose={() => setIsMobileListOpen(false)}
      />

      {/* RIGHT: Chat area */}
      {activeThreadId && activeThread ? (
        <ChatArea
          threadId={activeThreadId}
          otherUser={activeThread.other_user}
          messages={messages}
          loading={messagesLoading}
          meId={meId}
          onNewMessage={handleNewMessage}
          onMessageDeleted={handleMessageDeleted}
          onReaction={handleReaction}
          onMessagesRead={handleMessagesRead}
          onBackToList={() => setIsMobileListOpen(true)}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center p-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-primary/10">
            <MessageCircle size={36} className="text-primary/60" />
          </div>
          <h3 className="text-xl font-black text-text-primary">Suhbat tanlang</h3>
          <p className="text-sm text-text-secondary max-w-xs">
            Chap paneldan mavjud suhbatni tanlang yoki yangi suhbat boshlang.
          </p>
        </div>
      )}
    </div>
  );
}
```

### 4.3 `design/src/components/messages/ThreadSidebar.tsx` — Thread ro'yxati

```tsx
import { Search, MessageSquarePlus, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/src/lib/utils';
import type { MessagesThreadListItem } from '@/src/types';
import { NewThreadModal } from './NewThreadModal';

interface Props {
  threads: MessagesThreadListItem[];
  activeThreadId: number | null;
  loading: boolean;
  meId: number;
  onSelect: (id: number) => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

function formatRelativeTime(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Hozir';
  if (m < 60) return `${m} daq`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} soat`;
  return new Intl.DateTimeFormat('uz-UZ', { day: 'numeric', month: 'short' }).format(new Date(value));
}

export function ThreadSidebar({ threads, activeThreadId, loading, meId, onSelect, isMobileOpen, onMobileClose }: Props) {
  const [search, setSearch] = useState('');
  const [newThreadOpen, setNewThreadOpen] = useState(false);

  const filtered = threads.filter(t =>
    t.other_user.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <aside className={cn(
        'flex h-full w-full flex-col border-r border-border bg-slate-50/50 transition-all lg:w-80 lg:min-w-[320px] lg:max-w-[320px]',
        'absolute inset-0 z-10 lg:relative lg:z-auto',
        isMobileOpen ? 'flex' : 'hidden lg:flex',
      )}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-black text-text-primary">Xabarlar</h2>
          <button
            onClick={() => setNewThreadOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-white shadow-xl shadow-primary/20 hover:bg-primary-hover transition-colors"
            title="Yangi suhbat"
          >
            <MessageSquarePlus size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border/60">
          <div className="flex items-center gap-2 rounded-2xl bg-white border border-border px-4 py-2.5">
            <Search size={15} className="text-text-muted flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Qidirish..."
              className="flex-1 bg-transparent text-sm font-medium text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoaderCircle size={20} className="animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-bold text-text-muted">Suhbat topilmadi</p>
            </div>
          ) : (
            filtered.map(thread => {
              const isActive = thread.id === activeThreadId;
              const hasUnread = thread.unread_count > 0;
              const lastMsg = thread.last_message;
              const isMine = lastMsg?.sender_id === meId;

              return (
                <button
                  key={thread.id}
                  onClick={() => onSelect(thread.id)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white',
                    isActive ? 'bg-primary/8 border-r-2 border-primary' : '',
                  )}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={thread.other_user.avatar_url}
                      alt={thread.other_user.full_name}
                      className="h-12 w-12 rounded-2xl object-cover"
                    />
                    {/* Online dot (agar online status bo'lsa) */}
                    <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-success" />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={cn('truncate text-sm font-black', hasUnread ? 'text-text-primary' : 'text-text-secondary')}>
                        {thread.other_user.full_name}
                      </p>
                      <span className="flex-shrink-0 text-[10px] font-bold text-text-muted">
                        {formatRelativeTime(thread.updated_at)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-medium text-text-muted">
                        {lastMsg
                          ? `${isMine ? 'Siz: ' : ''}${lastMsg.is_deleted ? "[o'chirildi]" : lastMsg.body || `📎 ${lastMsg.attachment_name}`}`
                          : 'Hozircha xabar yo\'q'}
                      </p>
                      {hasUnread && (
                        <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-black text-white">
                          {thread.unread_count > 99 ? '99+' : thread.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <NewThreadModal open={newThreadOpen} onClose={() => setNewThreadOpen(false)} onStart={onSelect} />
    </>
  );
}
```

### 4.4 `design/src/components/messages/ChatArea.tsx` — Asosiy chat

```tsx
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowDown, Paperclip, Send, Search, Smile, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { deleteMessage, reactToMessage, sendThreadAttachment, sendThreadMessage } from '@/src/api/messages';
import { installMessageSoundUnlock, playMessageSound } from '@/src/lib/message-sounds';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { EmojiPicker } from './EmojiPicker';
import type { MessagesThreadMessage, MessagesThreadUser, WsEvent } from '@/src/types';

interface Props {
  threadId: number;
  otherUser: MessagesThreadUser;
  messages: MessagesThreadMessage[];
  loading: boolean;
  meId: number;
  onNewMessage: (msg: MessagesThreadMessage) => void;
  onMessageDeleted: (id: number) => void;
  onReaction: (id: number, reactions: Record<string, number>) => void;
  onMessagesRead: (readerId: number, readAt: string) => void;
  onBackToList: () => void;
}

export function ChatArea({
  threadId, otherUser, messages, loading, meId,
  onNewMessage, onMessageDeleted, onReaction, onMessagesRead, onBackToList,
}: Props) {
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);    // boshqa user yozyapti
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [replyTo, setReplyTo] = useState<MessagesThreadMessage | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const seenIds = useRef(new Set<number>());

  // WebSocket
  useEffect(() => {
    installMessageSoundUnlock();
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${location.host}/ws/messages/thread/${threadId}/`);
    wsRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ action: 'mark_read' }));

    ws.onmessage = (event) => {
      try {
        const data: WsEvent = JSON.parse(event.data);
        if (data.type === 'message.created') {
          if (seenIds.current.has(data.message.id)) return;
          seenIds.current.add(data.message.id);
          onNewMessage(data.message);
          void playMessageSound(data.message.sender_id === meId ? 'send' : 'receive');
          ws.send(JSON.stringify({ action: 'mark_read' }));
        }
        if (data.type === 'message.deleted') onMessageDeleted(data.message_id);
        if (data.type === 'message.reacted') onReaction(data.message_id, data.reactions);
        if (data.type === 'user.typing') setIsTyping(data.is_typing && data.user_id !== meId);
        if (data.type === 'messages.read') onMessagesRead(data.reader_id, data.read_at);
      } catch {}
    };

    return () => { try { ws.close(); } catch {} };
  }, [threadId]);

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Scroll button visibility
  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distanceFromBottom > 300);
  }

  // Typing indicator gönder
  function sendTyping(typing: boolean) {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: typing ? 'typing_start' : 'typing_stop' }));
    }
  }

  function handleBodyChange(val: string) {
    setBody(val);
    sendTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => sendTyping(false), 2000);
  }

  function handleFileChange(f: File | null) {
    setFile(f);
    if (f && f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setFilePreview(null);
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text && !file) return;
    setIsSending(true);
    try {
      if (file) {
        const resp = await sendThreadAttachment(threadId, { body: text || undefined, file, reply_to_id: replyTo?.id });
        seenIds.current.add(resp.message.id);
        onNewMessage({ ...resp.message, thread_id: threadId });
        await playMessageSound('send');
        setFile(null);
        setFilePreview(null);
      } else {
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            action: 'send',
            body: text,
            reply_to_id: replyTo?.id || null,
          }));
        } else {
          const resp = await sendThreadMessage(threadId, { body: text });
          seenIds.current.add(resp.message.id);
          onNewMessage({ ...resp.message, thread_id: threadId, attachment_url: null, attachment_name: '', attachment_size: null, attachment_mime: '', is_deleted: false, is_read: false, read_at: null, reactions: {}, reply_to: null, updated_at: resp.message.created_at });
          await playMessageSound('send');
        }
      }
      setBody('');
      setReplyTo(null);
      sendTyping(false);
    } catch {}
    finally { setIsSending(false); }
  }

  // Xabarlarni sanat ajratichilar bilan guruhlash
  const groupedMessages = useMemo(() => {
    const result: Array<{ type: 'date'; date: string } | { type: 'message'; msg: MessagesThreadMessage }> = [];
    let lastDate = '';
    for (const msg of messages) {
      const dateStr = new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'long' }).format(new Date(msg.created_at));
      if (dateStr !== lastDate) {
        result.push({ type: 'date', date: dateStr });
        lastDate = dateStr;
      }
      result.push({ type: 'message', msg });
    }
    return result;
  }, [messages]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* HEADER */}
      <div className="flex flex-shrink-0 items-center gap-4 border-b border-border bg-white px-5 py-4">
        <button onClick={onBackToList} className="lg:hidden text-text-secondary hover:text-text-primary">
          <ArrowLeft size={20} />
        </button>
        <img src={otherUser.avatar_url} alt={otherUser.full_name} className="h-11 w-11 rounded-2xl object-cover" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-text-primary truncate">{otherUser.full_name}</p>
          <p className="text-xs text-text-muted">@{otherUser.username}</p>
        </div>
        <button
          onClick={() => setShowSearch(v => !v)}
          className={cn('rounded-2xl border border-border p-2.5 transition-colors', showSearch ? 'bg-primary text-white border-primary' : 'text-text-secondary hover:bg-slate-50')}
        >
          <Search size={17} />
        </button>
      </div>

      {/* SEARCH BAR */}
      {showSearch && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 bg-slate-50">
          <Search size={15} className="text-text-muted" />
          <input
            autoFocus
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Xabarlardan qidirish..."
            className="flex-1 bg-transparent text-sm font-medium text-text-primary outline-none placeholder:text-text-muted"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-text-muted hover:text-text-primary">
              <X size={15} />
            </button>
          )}
        </div>
      )}

      {/* MESSAGE LIST */}
      <div
        ref={listRef}
        onScroll={onScroll}
        className="relative flex-1 overflow-y-auto p-5 space-y-1 bg-slate-50/30"
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <LoaderCircle size={24} className="animate-spin text-primary" />
          </div>
        ) : (
          groupedMessages.map((item, idx) => {
            if (item.type === 'date') {
              return (
                <div key={`date-${idx}`} className="flex items-center gap-3 py-4">
                  <div className="h-px flex-1 bg-border/60" />
                  <span className="rounded-full border border-border bg-white px-4 py-1 text-[10px] font-bold text-text-muted">
                    {item.date}
                  </span>
                  <div className="h-px flex-1 bg-border/60" />
                </div>
              );
            }
            const msg = item.msg;
            const isMine = msg.sender_id === meId;
            const prevItem = groupedMessages[idx - 1];
            const prevMsg = prevItem?.type === 'message' ? prevItem.msg : null;
            const isGrouped = prevMsg?.sender_id === msg.sender_id &&
              new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 120000;

            // Search filter
            if (searchQuery && !msg.body.toLowerCase().includes(searchQuery.toLowerCase())) return null;

            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                isMine={isMine}
                isGrouped={isGrouped}
                meId={meId}
                onReply={setReplyTo}
                onDelete={async () => {
                  await deleteMessage(msg.id);
                  onMessageDeleted(msg.id);
                }}
                onReact={async (emoji) => {
                  const resp = await reactToMessage(msg.id, emoji);
                  onReaction(msg.id, resp.reactions);
                }}
              />
            );
          })
        )}

        {/* Typing indicator */}
        {isTyping && <TypingIndicator name={otherUser.full_name} />}

        <div ref={bottomRef} />

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <button
            onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="fixed bottom-28 right-8 flex h-11 w-11 items-center justify-center rounded-full bg-white border border-border shadow-xl text-text-secondary hover:text-primary transition-colors z-10"
          >
            <ArrowDown size={18} />
          </button>
        )}
      </div>

      {/* REPLY PREVIEW */}
      {replyTo && (
        <div className="flex items-center gap-3 border-t border-border bg-primary/5 px-5 py-3">
          <div className="h-10 w-1 rounded-full bg-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-primary">Javob berilmoqda</p>
            <p className="truncate text-xs text-text-secondary">
              {replyTo.is_deleted ? "[o'chirildi]" : replyTo.body || `📎 ${replyTo.attachment_name}`}
            </p>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        </div>
      )}

      {/* FILE PREVIEW */}
      {file && (
        <div className="flex items-center gap-3 border-t border-border bg-white px-5 py-3">
          {filePreview ? (
            <img src={filePreview} alt="preview" className="h-12 w-12 rounded-xl object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Paperclip size={20} className="text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-bold text-text-primary">{file.name}</p>
            <p className="text-xs text-text-muted">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button onClick={() => { setFile(null); setFilePreview(null); }} className="text-text-muted hover:text-danger">
            <X size={16} />
          </button>
        </div>
      )}

      {/* INPUT AREA */}
      <form onSubmit={handleSend} className="flex items-end gap-3 border-t border-border bg-white px-4 py-4">
        {/* File upload */}
        <label className="flex-shrink-0 cursor-pointer rounded-2xl border border-border p-3 text-text-secondary hover:border-primary/40 hover:text-primary transition-colors">
          <Paperclip size={18} />
          <input type="file" className="hidden" onChange={e => handleFileChange(e.target.files?.[0] || null)} />
        </label>

        {/* Emoji picker toggle */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowEmoji(v => !v)}
            className="rounded-2xl border border-border p-3 text-text-secondary hover:border-primary/40 hover:text-primary transition-colors"
          >
            <Smile size={18} />
          </button>
          {showEmoji && (
            <div className="absolute bottom-14 left-0 z-20">
              <EmojiPicker onSelect={(emoji) => { setBody(b => b + emoji); setShowEmoji(false); }} onClose={() => setShowEmoji(false)} />
            </div>
          )}
        </div>

        {/* Text input */}
        <textarea
          value={body}
          onChange={e => handleBodyChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend(e as unknown as FormEvent);
            }
          }}
          placeholder="Xabar yozing... (Enter = yuborish, Shift+Enter = yangi qator)"
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-medium text-text-primary outline-none placeholder:text-text-muted focus:border-primary/40 focus:ring-2 focus:ring-primary/10 max-h-32"
          style={{ height: 'auto' }}
          onInput={e => {
            const el = e.target as HTMLTextAreaElement;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 128) + 'px';
          }}
        />

        {/* Send button */}
        <button
          type="submit"
          disabled={isSending || (!body.trim() && !file)}
          className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors"
        >
          {isSending
            ? <LoaderCircle size={18} className="animate-spin" />
            : <Send size={18} />
          }
        </button>
      </form>
    </div>
  );
}
```

### 4.5 `design/src/components/messages/MessageBubble.tsx` — Xabar pufagi

```tsx
import { useState, useRef } from 'react';
import { Check, CheckCheck, Reply, Trash2, MoreHorizontal, Paperclip, Image } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { MessagesThreadMessage } from '@/src/types';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

function formatTime(value: string) {
  return new Intl.DateTimeFormat('uz-UZ', { timeStyle: 'short' }).format(new Date(value));
}

interface Props {
  message: MessagesThreadMessage;
  isMine: boolean;
  isGrouped: boolean;
  meId: number;
  onReply: (msg: MessagesThreadMessage) => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
}

export function MessageBubble({ message: msg, isMine, isGrouped, meId, onReply, onDelete, onReact }: Props) {
  const [showActions, setShowActions] = useState(false);
  const [showQuickReact, setShowQuickReact] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const isImage = msg.attachment_mime?.startsWith('image/');

  return (
    <div
      className={cn('flex group', isMine ? 'justify-end' : 'justify-start', isGrouped ? 'mt-0.5' : 'mt-3')}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowQuickReact(false); }}
    >
      <div className={cn('relative max-w-[70%] md:max-w-[60%]')}>
        {/* Reply preview */}
        {msg.reply_to && !msg.is_deleted && (
          <div className={cn(
            'mb-1 rounded-2xl border-l-4 px-3 py-2 text-xs',
            isMine ? 'border-white/40 bg-white/10 text-white/80' : 'border-primary/40 bg-primary/5 text-text-secondary',
          )}>
            <p className="font-black">{msg.reply_to.sender_id === meId ? 'Siz' : 'U'}</p>
            <p className="truncate">{msg.reply_to.body || `📎 ${msg.reply_to.attachment_name}`}</p>
          </div>
        )}

        {/* Bubble */}
        <div className={cn(
          'relative rounded-3xl px-4 py-3 text-sm font-medium leading-relaxed',
          isMine ? 'bg-primary text-white rounded-br-lg' : 'bg-white text-text-primary border border-border rounded-bl-lg',
          msg.is_deleted ? 'opacity-60 italic' : '',
        )}>
          {/* Body */}
          {msg.body && !msg.is_deleted && (
            <p className="whitespace-pre-wrap break-words">{msg.body}</p>
          )}
          {msg.is_deleted && (
            <p className="text-xs italic opacity-70">[o'chirildi]</p>
          )}

          {/* Attachment */}
          {msg.attachment_url && !msg.is_deleted && (
            isImage ? (
              <button onClick={() => setLightboxUrl(msg.attachment_url)}>
                <img
                  src={msg.attachment_url}
                  alt={msg.attachment_name}
                  className="mt-2 max-h-60 w-full rounded-2xl object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
                />
              </button>
            ) : (
              <a
                href={msg.attachment_url}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  'mt-2 flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-bold',
                  isMine ? 'bg-white/15 text-white' : 'bg-slate-100 text-text-primary',
                )}
              >
                <Paperclip size={14} />
                <span className="truncate">{msg.attachment_name}</span>
                {msg.attachment_size && (
                  <span className="ml-auto opacity-70">
                    {(msg.attachment_size / 1024).toFixed(0)} KB
                  </span>
                )}
              </a>
            )
          )}

          {/* Time + Read receipt */}
          <div className={cn('mt-1 flex items-center justify-end gap-1.5', isMine ? 'text-white/60' : 'text-text-muted')}>
            <span className="text-[10px] font-bold">{formatTime(msg.created_at)}</span>
            {isMine && !msg.is_deleted && (
              msg.is_read
                ? <CheckCheck size={13} className="text-sky-300" />
                : <Check size={13} />
            )}
          </div>
        </div>

        {/* Reactions */}
        {Object.keys(msg.reactions || {}).length > 0 && (
          <div className={cn('mt-1 flex flex-wrap gap-1', isMine ? 'justify-end' : 'justify-start')}>
            {Object.entries(msg.reactions).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className="flex items-center gap-1 rounded-full border border-border bg-white px-2 py-0.5 text-xs font-bold shadow-sm hover:bg-slate-50 transition-colors"
              >
                <span>{emoji}</span>
                <span className="text-text-secondary">{count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Hover actions */}
        {showActions && !msg.is_deleted && (
          <div className={cn(
            'absolute top-0 flex items-center gap-1 rounded-2xl border border-border bg-white p-1 shadow-xl z-10',
            isMine ? '-left-32' : '-right-32',
          )}>
            {/* Quick reactions */}
            {QUICK_REACTIONS.map(emoji => (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-base hover:bg-slate-100 transition-colors"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
            <div className="mx-1 h-6 w-px bg-border" />
            <button
              onClick={() => onReply(msg)}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-text-secondary hover:bg-slate-100 hover:text-primary transition-colors"
              title="Javob berish"
            >
              <Reply size={15} />
            </button>
            {isMine && (
              <button
                onClick={onDelete}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-text-secondary hover:bg-danger/10 hover:text-danger transition-colors"
                title="O'chirish"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Image lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="preview"
            className="max-h-[90vh] max-w-[90vw] rounded-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
```

### 4.6 `design/src/components/messages/TypingIndicator.tsx`

```tsx
export function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="flex items-end gap-2 mt-3">
      <div className="flex items-center gap-1.5 rounded-3xl rounded-bl-lg border border-border bg-white px-4 py-3 shadow-sm">
        <span className="text-xs font-semibold text-text-muted">{name} yozyapti</span>
        <div className="flex items-center gap-0.5 ml-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce"
              style={{ animationDelay: `${i * 0.15}s`, animationDuration: '1s' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 4.7 `design/src/components/messages/EmojiPicker.tsx` — Oddiy emoji panel

```tsx
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const EMOJI_GROUPS = {
  'Tez': ['👍','❤️','😂','😮','😢','🔥','🎉','👏','🙏','💯'],
  'Yuzlar': ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','😉','😌','😍','🥰','😘'],
  'Ishlar': ['📚','📖','✏️','📝','💡','🎯','⏰','📅','✅','❌','⚡','🔑','💪','🚀'],
  'Belgilar': ['✓','✗','★','☆','♥','♦','♣','♠','→','←','↑','↓','⬆️','⬇️','➡️','⬅️'],
};

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [onClose]);

  return (
    <div ref={ref} className="w-72 rounded-[24px] border border-border bg-white shadow-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black text-text-muted uppercase tracking-wider">Emoji tanlash</p>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary">
          <X size={15} />
        </button>
      </div>
      {Object.entries(EMOJI_GROUPS).map(([group, emojis]) => (
        <div key={group}>
          <p className="mb-2 text-[10px] font-bold text-text-muted uppercase tracking-wider">{group}</p>
          <div className="flex flex-wrap gap-1">
            {emojis.map(emoji => (
              <button
                key={emoji}
                onClick={() => onSelect(emoji)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-lg hover:bg-slate-100 transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 4.8 `design/src/components/messages/NewThreadModal.tsx`

```tsx
import { useState } from 'react';
import { X, Search, MessageSquarePlus, LoaderCircle } from 'lucide-react';
import { searchUsers, startThread } from '@/src/api/messages';
import { cn } from '@/src/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  onStart: (threadId: number) => void;
}

export function NewThreadModal({ open, onClose, onStart }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: number; username: string; full_name: string; avatar_url: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  function handleQuery(val: string) {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (val.trim().length < 2) { setResults([]); return; }
    timerRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const resp = await searchUsers(val);
        setResults(resp.items);
      } finally { setLoading(false); }
    }, 250);
  }

  async function handleStart(userId: number) {
    setStarting(true);
    setError(null);
    try {
      const resp = await startThread({ user_id: userId });
      onStart(resp.thread.id);
      onClose();
      setQuery('');
      setResults([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suhbat boshlanmadi.');
    } finally { setStarting(false); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-[28px] border border-border bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <h3 className="text-lg font-black text-text-primary">Yangi suhbat boshlash</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-slate-50 px-4 py-3">
            <Search size={16} className="text-text-muted" />
            <input
              autoFocus
              value={query}
              onChange={e => handleQuery(e.target.value)}
              placeholder="Ism, username yoki talaba ID..."
              className="flex-1 bg-transparent text-sm font-medium text-text-primary outline-none placeholder:text-text-muted"
            />
            {loading && <LoaderCircle size={14} className="animate-spin text-text-muted" />}
          </div>

          {error && <p className="mt-3 text-xs font-bold text-danger">{error}</p>}

          <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
            {results.length === 0 && query.trim().length >= 2 && !loading && (
              <p className="py-6 text-center text-sm text-text-muted">Foydalanuvchi topilmadi</p>
            )}
            {results.map(u => (
              <div key={u.id} className="flex items-center gap-3 rounded-2xl border border-border p-3 hover:bg-slate-50 transition-colors">
                <img src={u.avatar_url} alt={u.full_name} className="h-10 w-10 rounded-2xl object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-text-primary truncate">{u.full_name}</p>
                  <p className="text-xs text-text-muted">@{u.username}</p>
                </div>
                <button
                  onClick={() => handleStart(u.id)}
                  disabled={starting}
                  className="flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2 text-xs font-black text-white disabled:opacity-60 hover:bg-primary-hover transition-colors"
                >
                  <MessageSquarePlus size={14} />
                  Chat
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 5-QISM — Router yangilash

`design/src/app/router.tsx` da:

```tsx
// Eski yo'llarni yangilariga yo'naltirish:
<Route path="/messages" element={<MessagesPage />} />
<Route path="/messages/:threadId" element={<MessagesPage />} />
```

---

## 6-QISM — Tekshirish ro'yxati (QA Checklist)

### Layout
- [ ] Split-panel: thread sidebar (320px) + chat area (flex-1)
- [ ] Mobil: faqat bittasi ko'rinadi (back tugmasi ishlaydi)
- [ ] `h-[calc(100vh-96px)]` — header balandligi ayirilgan

### Real-time
- [ ] WebSocket qayta ulanadi (reconnect)
- [ ] Typing indicator `...` animatsiya ko'rinadi
- [ ] Xabar yuborilganda boshqa tomonda darhol paydo bo'ladi
- [ ] O'qildi belgisi (✓✓ ko'k) boshqa user o'qiganda o'zgaradi

### Xabar funksiyalari
- [ ] Reply: xabar ustiga hover → Reply tugmasi → preview strip
- [ ] Delete: "O'chirildi" ko'rinadi, fayl yo'q qilinadi
- [ ] Emoji reaksiya: hover → 6 ta tezkor emoji → toggle
- [ ] Rasm attachment: thumbnail ko'rinadi, bossa lightbox ochiladi
- [ ] Fayl attachment: nom + hajm, yuklab olish havolasi

### Input
- [ ] Enter = yuborish, Shift+Enter = yangi qator
- [ ] Textarea yuqoriga kengayadi (max 5 qator)
- [ ] Fayl tanlanganda preview strip chiqadi
- [ ] Emoji picker ochiladi va emoji inputga qo'shiladi
- [ ] Yuborilgandan keyin textarea tozalanadi

### Qidiruv
- [ ] Thread header'dagi qidiruv tugmasi panel ochadi
- [ ] Yozganda xabarlar filterlanadi

### Xabarlar ko'rinishi
- [ ] Sana ajratichilar (Bugun, Kecha, to'liq sana)
- [ ] Ketma-ket xabarlar guruhlashadi (margin kichrayadi)
- [ ] O'z xabarlar o'ngda (primary), boshqilarniki chapda (white)
- [ ] Vaqt va read receipt har xabarda ko'rinadi

### Migration
- [ ] `python manage.py makemigrations messaging` muvaffaqiyatli
- [ ] `python manage.py migrate` xatosiz
