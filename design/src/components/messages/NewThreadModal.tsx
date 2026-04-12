import { useRef, useState } from 'react';
import { LoaderCircle, MessageSquarePlus, Search, X } from 'lucide-react';
import { searchUsers, startThread } from '@/src/api/messages';

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

  function handleQuery(value: string) {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    timerRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await searchUsers(value);
        setResults(response.items);
      } finally {
        setLoading(false);
      }
    }, 250);
  }

  async function handleStart(userId: number) {
    setStarting(true);
    setError(null);
    try {
      const response = await startThread({ user_id: userId });
      onStart(response.thread.id);
      onClose();
      setQuery('');
      setResults([]);
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : 'Suhbat boshlanmadi.');
    } finally {
      setStarting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-[28px] border border-border bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
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
              onChange={(event) => handleQuery(event.target.value)}
              placeholder="Ism yoki username..."
              className="flex-1 bg-transparent text-sm font-medium text-text-primary outline-none placeholder:text-text-muted"
            />
            {loading && <LoaderCircle size={14} className="animate-spin text-text-muted" />}
          </div>
          {error && <p className="mt-3 text-xs font-bold text-danger">{error}</p>}
          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
            {results.length === 0 && query.trim().length >= 2 && !loading && (
              <p className="py-6 text-center text-sm text-text-muted">Foydalanuvchi topilmadi</p>
            )}
            {results.map((user) => (
              <div key={user.id} className="flex items-center gap-3 rounded-2xl border border-border p-3 transition-colors hover:bg-slate-50">
                <img src={user.avatar_url} alt={user.full_name} className="h-10 w-10 rounded-2xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-text-primary">{user.full_name}</p>
                  <p className="text-xs text-text-muted">@{user.username}</p>
                </div>
                <button
                  onClick={() => void handleStart(user.id)}
                  disabled={starting}
                  className="flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2 text-xs font-black text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
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
