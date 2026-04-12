import { useEffect, useState } from 'react';
import { ExternalLink, LoaderCircle, MailOpen, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchNotifications, markNotificationRead, markNotificationsReadAll } from '@/src/api/lms';
import { useAuth } from '@/src/features/auth/auth-context';

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function isSpaLink(link: string) {
  // With BrowserRouter basename="/app", <Link to="/x"> correctly becomes /app/x.
  // Plain <a href="/x"> would navigate to backend root, so we route common SPA links here.
  if (!link.startsWith('/')) return false;
  const legacyPrefixes = ['/__legacy/', '/admin/', '/api/', '/accounts/', '/auth/'];
  return !legacyPrefixes.some((p) => link.startsWith(p));
}

export default function NotificationsPage() {
  const { refreshSession } = useAuth();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchNotifications>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(nextPage = page) {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchNotifications(nextPage, 20);
      setData(response);
      setPage(nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bildirishnomalar yuklanmadi.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function markAllRead() {
    await markNotificationsReadAll();
    await refreshSession({ silent: true });
    await load(1);
  }

  async function markRead(id: number) {
    await markNotificationRead(id);
    await refreshSession({ silent: true });
    await load(page);
  }

  if (isLoading) {
    return (
      <div className="card flex min-h-[320px] items-center justify-center gap-3 p-8 text-text-secondary">
        <LoaderCircle className="animate-spin text-primary" size={20} />
        Bildirishnomalar yuklanmoqda...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card p-8">
        <p className="text-lg font-black text-text-primary">Bildirishnomalar yuklanmadi</p>
        <p className="mt-3 text-sm font-medium text-rose-500">{error || 'Nomaʼlum xatolik.'}</p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.page_size));

  return (
    <div className="space-y-8">
      <section className="card p-8 lg:p-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-text-primary">Bildirishnomalar</h2>
            <p className="mt-3 text-sm font-medium text-text-secondary">
              Unread: {data.unread_count} | Total: {data.total}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void load(page)} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold text-text-primary">
              <RefreshCw size={16} />
              Yangilash
            </button>
            <button type="button" onClick={() => void markAllRead()} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white">
              <MailOpen size={16} />
              Hammasini o'qilgan qilish
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {data.items.length ? data.items.map((n) => (
          <div key={n.id} className={`card p-6 ${n.is_read ? 'opacity-80' : ''}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-black text-text-primary">{n.title}</p>
                <p className="mt-2 text-sm font-medium leading-7 text-text-secondary">{n.message}</p>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-text-secondary">{formatDateTime(n.created_at)}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {n.link ? (
                  isSpaLink(n.link) ? (
                    <Link to={n.link} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold text-text-primary">
                      Ochish
                      <ExternalLink size={16} />
                    </Link>
                  ) : (
                    <a href={n.link} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold text-text-primary">
                      Ochish
                      <ExternalLink size={16} />
                    </a>
                  )
                ) : null}
                {!n.is_read ? (
                  <button type="button" onClick={() => void markRead(n.id)} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white">
                    O'qilgan
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )) : (
          <div className="card p-8">
            <p className="text-lg font-black text-text-primary">Bildirishnoma yo'q</p>
            <p className="mt-3 text-sm font-medium text-text-secondary">Hozircha ko'rsatish uchun ma'lumot yo'q.</p>
          </div>
        )}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm font-semibold text-text-secondary">Sahifa: {data.page} / {totalPages}</p>
        <div className="flex gap-3">
          <button type="button" disabled={page <= 1} onClick={() => void load(page - 1)} className="rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold text-text-primary disabled:opacity-50">
            Oldingi
          </button>
          <button type="button" disabled={page >= totalPages} onClick={() => void load(page + 1)} className="rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold text-text-primary disabled:opacity-50">
            Keyingi
          </button>
        </div>
      </section>
    </div>
  );
}
