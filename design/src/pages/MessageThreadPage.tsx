import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileUp, LoaderCircle, Send } from 'lucide-react';
import { fetchThreadDetail, markThreadRead, sendThreadAttachment, sendThreadMessage } from '@/src/api/messages';
import { useAuth } from '@/src/features/auth/auth-context';
import { installMessageSoundUnlock, playMessageSound } from '@/src/lib/message-sounds';
import type { MessagesThreadDetailResponse } from '@/src/types';
import { cn } from '@/src/lib/utils';

function formatTime(value: string) {
  return new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export default function MessageThreadPage() {
  const params = useParams();
  const threadId = Number(params.threadId || 0);
  const { session, refreshSession } = useAuth();

  const [data, setData] = useState<MessagesThreadDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const seenMessageIdsRef = useRef<Set<number>>(new Set());

  const meId = session?.user?.id || 0;

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchThreadDetail(threadId, 80);
      seenMessageIdsRef.current = new Set(response.messages.map((message) => message.id));
      setData(response);
      // Mark read in background.
      void markThreadRead(threadId).then(() => refreshSession({ silent: true })).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat yuklanmadi.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!threadId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;
    installMessageSoundUnlock();
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/ws/messages/thread/${threadId}/`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      try {
        ws.send(JSON.stringify({ action: 'mark_read' }));
      } catch {
        // ignore
      }
    };
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === 'message.created' && payload.message) {
          const msg = payload.message;
          if (seenMessageIdsRef.current.has(msg.id)) {
            return;
          }
          seenMessageIdsRef.current.add(msg.id);
          setData((prev) => {
            if (!prev) return prev;
            return { ...prev, messages: [...prev.messages, msg] };
          });
          void playMessageSound(msg.sender_id === meId ? 'send' : 'receive');
          void markThreadRead(threadId).then(() => refreshSession({ silent: true })).catch(() => {});
        }
      } catch {
        // ignore
      }
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null;
    };
    return () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
    };
  }, [refreshSession, threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.messages.length]);

  const messages = useMemo(() => data?.messages || [], [data]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text && !file) return;
    setIsSending(true);
    setError(null);
    try {
      if (file) {
        const resp = await sendThreadAttachment(threadId, { body: text || undefined, file });
        seenMessageIdsRef.current.add(resp.message.id);
        setFile(null);
        setBody('');
        setData((prev) => (
          prev
            ? {
                ...prev,
                messages: [
                  ...prev.messages,
                  {
                    ...resp.message,
                    thread_id: threadId,
                  },
                ],
              }
            : prev
        ));
        await playMessageSound('send');
      } else {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'send', body: text }));
          setBody('');
        } else {
          const response = await sendThreadMessage(threadId, { body: text });
          seenMessageIdsRef.current.add(response.message.id);
          setData((prev) => (
            prev
              ? {
                  ...prev,
                  messages: [
                    ...prev.messages,
                    {
                      ...response.message,
                      thread_id: threadId,
                      attachment_url: null,
                      attachment_name: '',
                    },
                  ],
                }
              : prev
          ));
          setBody('');
          await playMessageSound('send');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yuborilmadi.');
    } finally {
      setIsSending(false);
    }
  }

  if (isLoading) {
    return (
      <div className="card flex min-h-[320px] items-center justify-center gap-3 p-8 text-text-secondary">
        <LoaderCircle className="animate-spin text-primary" size={20} />
        Chat yuklanmoqda...
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="card p-8">
        <p className="text-lg font-black text-text-primary">Chat yuklanmadi</p>
        <p className="mt-3 text-sm font-medium text-rose-500">{error || "Noma'lum xatolik."}</p>
        <Link to="/messages" className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold text-text-primary">
          <ArrowLeft size={16} />
          Orqaga
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="card p-8">
        <Link to="/messages" className="inline-flex items-center gap-2 text-sm font-bold text-text-secondary hover:text-text-primary">
          <ArrowLeft size={16} />
          Xabarlar
        </Link>
        <div className="mt-5 flex items-center gap-4">
          <img src={data.thread.other_user.avatar_url} alt={data.thread.other_user.full_name} className="h-14 w-14 rounded-3xl object-cover" />
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-text-primary">{data.thread.other_user.full_name}</p>
            <p className="mt-1 text-sm font-semibold text-text-secondary">@{data.thread.other_user.username}</p>
          </div>
          {data.thread.unread_count ? (
            <span className="ml-auto rounded-full bg-danger px-3 py-2 text-xs font-black text-white">{data.thread.unread_count} unread</span>
          ) : null}
        </div>
      </section>

      <section className="card flex min-h-[420px] flex-col p-0">
        <div className="flex-1 space-y-3 overflow-auto p-6">
          {messages.map((m) => {
            const mine = m.sender_id === meId;
            return (
              <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[80%] rounded-3xl px-5 py-4 text-sm font-semibold leading-7', mine ? 'bg-primary text-white' : 'bg-slate-100 text-text-primary')}>
                  {m.body ? <p className="whitespace-pre-wrap">{m.body}</p> : null}
                  {m.attachment_url ? (
                    <a
                      href={m.attachment_url}
                      className={cn('mt-3 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black underline', mine ? 'bg-white/10 text-white' : 'bg-white text-text-primary')}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FileUp size={16} />
                      {m.attachment_name || 'Fayl'}
                    </a>
                  ) : null}
                  <p className={cn('mt-2 text-[11px] font-black uppercase tracking-wide', mine ? 'text-white/80' : 'text-text-secondary')}>
                    {formatTime(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={(e) => void handleSend(e)} className="border-t border-border/60 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="flex-1 space-y-2">
              <span className="label-micro">Xabar</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                placeholder="Yozing..."
                className="w-full resize-none rounded-3xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-3xl border border-border bg-white px-5 py-4 text-sm font-black text-text-primary">
              <FileUp size={16} className="text-primary" />
              {file ? file.name : 'File'}
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setFile(f);
                }}
              />
            </label>
            <button
              type="submit"
              disabled={isSending}
              className="inline-flex items-center justify-center gap-2 rounded-3xl bg-primary px-6 py-4 text-sm font-black text-white disabled:opacity-70"
            >
              <Send size={16} />
              Yuborish
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
