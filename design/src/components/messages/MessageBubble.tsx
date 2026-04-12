import { Check, CheckCheck, Paperclip, Reply, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/src/lib/utils';
import type { MessagesThreadMessage } from '@/src/types';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

function formatTime(value: string) {
  return new Intl.DateTimeFormat('uz-UZ', { timeStyle: 'short' }).format(new Date(value));
}

interface Props {
  key?: string | number;
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const isImage = msg.attachment_mime?.startsWith('image/');

  return (
    <div
      className={cn('group flex', isMine ? 'justify-end' : 'justify-start', isGrouped ? 'mt-0.5' : 'mt-3')}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="relative max-w-[70%] md:max-w-[60%]">
        {msg.reply_to && !msg.is_deleted && (
          <div className={cn('mb-1 rounded-2xl border-l-4 px-3 py-2 text-xs', isMine ? 'border-white/40 bg-white/10 text-white/80' : 'border-primary/40 bg-primary/5 text-text-secondary')}>
            <p className="font-black">{msg.reply_to.sender_id === meId ? 'Siz' : 'U'}</p>
            <p className="truncate">{msg.reply_to.body || `📎 ${msg.reply_to.attachment_name}`}</p>
          </div>
        )}
        <div className={cn('relative rounded-3xl px-4 py-3 text-sm font-medium leading-relaxed', isMine ? 'rounded-br-lg bg-primary text-white' : 'rounded-bl-lg border border-border bg-white text-text-primary', msg.is_deleted ? 'italic opacity-60' : '')}>
          {msg.body && !msg.is_deleted && <p className="whitespace-pre-wrap break-words">{msg.body}</p>}
          {msg.is_deleted && <p className="text-xs italic opacity-70">[o&apos;chirildi]</p>}
          {msg.attachment_url && !msg.is_deleted && (
            isImage ? (
              <button onClick={() => setLightboxUrl(msg.attachment_url)}>
                <img src={msg.attachment_url} alt={msg.attachment_name} className="mt-2 max-h-60 w-full cursor-zoom-in rounded-2xl object-cover transition-opacity hover:opacity-90" />
              </button>
            ) : (
              <a href={msg.attachment_url} target="_blank" rel="noreferrer" className={cn('mt-2 flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-bold', isMine ? 'bg-white/15 text-white' : 'bg-slate-100 text-text-primary')}>
                <Paperclip size={14} />
                <span className="truncate">{msg.attachment_name}</span>
              </a>
            )
          )}
          <div className={cn('mt-1 flex items-center justify-end gap-1.5', isMine ? 'text-white/60' : 'text-text-muted')}>
            <span className="text-[10px] font-bold">{formatTime(msg.created_at)}</span>
            {isMine && !msg.is_deleted && (msg.is_read ? <CheckCheck size={13} className="text-sky-300" /> : <Check size={13} />)}
          </div>
        </div>
        {Object.keys(msg.reactions || {}).length > 0 && (
          <div className={cn('mt-1 flex flex-wrap gap-1', isMine ? 'justify-end' : 'justify-start')}>
            {Object.entries(msg.reactions).map(([emoji, count]) => (
              <button key={emoji} onClick={() => onReact(emoji)} className="flex items-center gap-1 rounded-full border border-border bg-white px-2 py-0.5 text-xs font-bold shadow-sm">
                <span>{emoji}</span>
                <span className="text-text-secondary">{count}</span>
              </button>
            ))}
          </div>
        )}
        {showActions && !msg.is_deleted && (
          <div className={cn('absolute top-0 z-10 flex items-center gap-1 rounded-2xl border border-border bg-white p-1 shadow-xl', isMine ? '-left-32' : '-right-32')}>
            {QUICK_REACTIONS.map((emoji) => (
              <button key={emoji} onClick={() => onReact(emoji)} className="flex h-8 w-8 items-center justify-center rounded-xl text-base hover:bg-slate-100">{emoji}</button>
            ))}
            <button onClick={() => onReply(msg)} className="flex h-8 w-8 items-center justify-center rounded-xl text-text-secondary hover:bg-slate-100 hover:text-primary"><Reply size={15} /></button>
            {isMine && <button onClick={onDelete} className="flex h-8 w-8 items-center justify-center rounded-xl text-text-secondary hover:bg-danger/10 hover:text-danger"><Trash2 size={15} /></button>}
          </div>
        )}
      </div>
      {lightboxUrl && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="preview" className="max-h-[90vh] max-w-[90vw] rounded-2xl shadow-2xl" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
