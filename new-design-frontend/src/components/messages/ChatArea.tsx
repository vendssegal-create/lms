import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, LoaderCircle, Paperclip, Search, Send, Smile, X } from 'lucide-react';
import { deleteMessage, reactToMessage, sendThreadAttachment, sendThreadMessage } from '@/src/api/messages';
import { installMessageSoundUnlock, playMessageSound } from '@/src/lib/message-sounds';
import { cn } from '@/src/lib/utils';
import type { MessagesThreadMessage, MessagesThreadUser, WsEvent } from '@/src/types';
import { EmojiPicker } from './EmojiPicker';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';

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

export function ChatArea({ threadId, otherUser, messages, loading, meId, onNewMessage, onMessageDeleted, onReaction, onMessagesRead, onBackToList }: Props) {
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [replyTo, setReplyTo] = useState<MessagesThreadMessage | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const seenIds = useRef(new Set<number>());

  useEffect(() => {
    installMessageSoundUnlock();
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/messages/thread/${threadId}/`);
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
  }, [threadId, meId, onMessageDeleted, onMessagesRead, onNewMessage, onReaction]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  function sendTyping(typing: boolean) {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action: typing ? 'typing_start' : 'typing_stop' }));
  }

  function handleBodyChange(value: string) {
    setBody(value);
    sendTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => sendTyping(false), 2000);
  }

  function onScroll() {
    const element = listRef.current;
    if (!element) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    setShowScrollBtn(distanceFromBottom > 300);
  }

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    if (nextFile && nextFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => setFilePreview((event.target?.result as string) || null);
      reader.readAsDataURL(nextFile);
    } else {
      setFilePreview(null);
    }
  }

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text && !file) return;
    setIsSending(true);
    try {
      if (file) {
        const response = await sendThreadAttachment(threadId, { body: text || undefined, file, reply_to_id: replyTo?.id });
        seenIds.current.add(response.message.id);
        onNewMessage(response.message);
      } else {
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'send', body: text, reply_to_id: replyTo?.id || null }));
        } else {
          const response = await sendThreadMessage(threadId, { body: text, reply_to_id: replyTo?.id || null });
          seenIds.current.add(response.message.id);
          onNewMessage(response.message);
        }
      }
      setBody('');
      setReplyTo(null);
      setFile(null);
      setFilePreview(null);
      sendTyping(false);
    } finally {
      setIsSending(false);
    }
  }

  const groupedMessages = useMemo(() => {
    const result: Array<{ type: 'date'; date: string } | { type: 'message'; msg: MessagesThreadMessage }> = [];
    let lastDate = '';
    for (const message of messages) {
      const dateStr = new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'long' }).format(new Date(message.created_at));
      if (dateStr !== lastDate) {
        result.push({ type: 'date', date: dateStr });
        lastDate = dateStr;
      }
      result.push({ type: 'message', msg: message });
    }
    return result;
  }, [messages]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-4 border-b border-border bg-white px-5 py-4">
        <button onClick={onBackToList} className="text-text-secondary hover:text-text-primary lg:hidden"><ArrowLeft size={20} /></button>
        <img src={otherUser.avatar_url} alt={otherUser.full_name} className="h-11 w-11 rounded-2xl object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-text-primary">{otherUser.full_name}</p>
          <p className="text-xs text-text-muted">@{otherUser.username}</p>
        </div>
        <button onClick={() => setShowSearch((v) => !v)} className={cn('rounded-2xl border border-border p-2.5 transition-colors', showSearch ? 'border-primary bg-primary text-white' : 'text-text-secondary hover:bg-slate-50')}><Search size={17} /></button>
      </div>
      {showSearch && (
        <div className="flex items-center gap-2 border-b border-border bg-slate-50 px-4 py-2">
          <Search size={15} className="text-text-muted" />
          <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Xabarlardan qidirish..." className="flex-1 bg-transparent text-sm font-medium text-text-primary outline-none" />
        </div>
      )}
      <div ref={listRef} onScroll={onScroll} className="relative flex-1 space-y-1 overflow-y-auto bg-slate-50/30 p-5">
        {loading ? <div className="flex justify-center py-12"><LoaderCircle size={24} className="animate-spin text-primary" /></div> : groupedMessages.map((item, index) => {
          if (item.type === 'date') return <div key={`date-${index}`} className="py-3 text-center text-[10px] font-bold text-text-muted">{item.date}</div>;
          const message = item.msg;
          if (searchQuery && !message.body.toLowerCase().includes(searchQuery.toLowerCase())) return null;
          const prev = groupedMessages[index - 1];
          const prevMsg = prev?.type === 'message' ? prev.msg : null;
          const isGrouped = !!prevMsg && prevMsg.sender_id === message.sender_id && new Date(message.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 120000;
          return (
            <MessageBubble
              key={message.id}
              message={message}
              isMine={message.sender_id === meId}
              isGrouped={isGrouped}
              meId={meId}
              onReply={setReplyTo}
              onDelete={async () => {
                await deleteMessage(message.id);
                onMessageDeleted(message.id);
              }}
              onReact={async (emoji) => {
                const response = await reactToMessage(message.id, emoji);
                onReaction(message.id, response.reactions);
              }}
            />
          );
        })}
        {isTyping && <TypingIndicator name={otherUser.full_name} />}
        <div ref={bottomRef} />
        {showScrollBtn && <button onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })} className="fixed bottom-28 right-8 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white shadow-xl"><ArrowDown size={18} /></button>}
      </div>
      {replyTo && (
        <div className="flex items-center gap-3 border-t border-border bg-primary/5 px-5 py-3">
          <div className="h-10 w-1 shrink-0 rounded-full bg-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-primary">Javob berilmoqda</p>
            <p className="truncate text-xs text-text-secondary">{replyTo.is_deleted ? "[o'chirildi]" : replyTo.body || `📎 ${replyTo.attachment_name}`}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
        </div>
      )}
      {file && (
        <div className="flex items-center gap-3 border-t border-border bg-white px-5 py-3">
          {filePreview ? <img src={filePreview} alt="preview" className="h-12 w-12 rounded-xl object-cover" /> : <Paperclip size={20} className="text-primary" />}
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-text-primary">{file.name}</p></div>
          <button onClick={() => { setFile(null); setFilePreview(null); }}><X size={16} /></button>
        </div>
      )}
      <form onSubmit={(event) => void handleSend(event)} className="flex items-end gap-3 border-t border-border bg-white px-4 py-4">
        <label className="cursor-pointer rounded-2xl border border-border p-3 text-text-secondary"><Paperclip size={18} /><input type="file" className="hidden" onChange={(event) => handleFileChange(event.target.files?.[0] || null)} /></label>
        <div className="relative">
          <button type="button" onClick={() => setShowEmoji((v) => !v)} className="rounded-2xl border border-border p-3 text-text-secondary"><Smile size={18} /></button>
          {showEmoji && <div className="absolute bottom-14 left-0 z-20"><EmojiPicker onSelect={(emoji) => { setBody((prev) => prev + emoji); setShowEmoji(false); }} onClose={() => setShowEmoji(false)} /></div>}
        </div>
        <textarea value={body} onChange={(event) => handleBodyChange(event.target.value)} rows={1} className="max-h-32 flex-1 resize-none rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-medium text-text-primary outline-none" />
        <button type="submit" disabled={isSending || (!body.trim() && !file)} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white disabled:opacity-50">
          {isSending ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </form>
    </div>
  );
}
