import { LoaderCircle, MessageSquarePlus, Search } from 'lucide-react';
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
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Hozir';
  if (minutes < 60) return `${minutes} daq`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} soat`;
  return new Intl.DateTimeFormat('uz-UZ', { day: 'numeric', month: 'short' }).format(new Date(value));
}

export function ThreadSidebar({ threads, activeThreadId, loading, meId, onSelect, isMobileOpen }: Props) {
  const [search, setSearch] = useState('');
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const filtered = threads.filter((thread) => thread.other_user.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <aside className={cn(
        'absolute inset-0 z-10 h-full w-full flex-col border-r border-border bg-slate-50/50 transition-all lg:relative lg:z-auto lg:flex lg:w-80 lg:min-w-[320px] lg:max-w-[320px]',
        isMobileOpen ? 'flex' : 'hidden lg:flex',
      )}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-black text-text-primary">Xabarlar</h2>
          <button
            onClick={() => setNewThreadOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-white shadow-xl shadow-primary/20 transition-colors hover:bg-primary-hover"
          >
            <MessageSquarePlus size={18} />
          </button>
        </div>
        <div className="border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-2.5">
            <Search size={15} className="shrink-0 text-text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Qidirish..."
              className="flex-1 bg-transparent text-sm font-medium text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoaderCircle size={20} className="animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-bold text-text-muted">Suhbat topilmadi</p>
            </div>
          ) : filtered.map((thread) => {
            const isActive = thread.id === activeThreadId;
            const hasUnread = thread.unread_count > 0;
            const lastMessage = thread.last_message;
            const isMine = lastMessage?.sender_id === meId;
            return (
              <button
                key={thread.id}
                onClick={() => onSelect(thread.id)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white',
                  isActive ? 'border-r-2 border-primary bg-primary/8' : '',
                )}
              >
                <img src={thread.other_user.avatar_url} alt={thread.other_user.full_name} className="h-12 w-12 rounded-2xl object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={cn('truncate text-sm font-black', hasUnread ? 'text-text-primary' : 'text-text-secondary')}>
                      {thread.other_user.full_name}
                    </p>
                    <span className="shrink-0 text-[10px] font-bold text-text-muted">{formatRelativeTime(thread.updated_at)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium text-text-muted">
                      {lastMessage
                        ? `${isMine ? 'Siz: ' : ''}${lastMessage.is_deleted ? "[o'chirildi]" : lastMessage.body || `📎 ${lastMessage.attachment_name}`}`
                        : "Hozircha xabar yo'q"}
                    </p>
                    {hasUnread && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-black text-white">
                        {thread.unread_count > 99 ? '99+' : thread.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>
      <NewThreadModal open={newThreadOpen} onClose={() => setNewThreadOpen(false)} onStart={onSelect} />
    </>
  );
}
