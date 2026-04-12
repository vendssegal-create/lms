import { AnimatePresence, motion } from 'motion/react';
import { CalendarClock, CheckCircle2, Clock, RefreshCw, User as UserIcon, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { fetchExtensionRequests, reviewExtensionRequest } from '@/src/api/lms';
import { useToast } from '@/src/components/notifications/ToastProvider';
import type { ExtensionRequest } from '@/src/types';

type TabStatus = 'pending' | 'approved' | 'rejected';

function ReviewForm({ request, onDone }: { request: ExtensionRequest; onDone: () => void }) {
  const { success, error } = useToast();
  const [newDeadline, setNewDeadline] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(action: 'approve' | 'reject') {
    if (action === 'approve' && !newDeadline) {
      error('Yangi muddat kiriting', '');
      return;
    }
    setLoading(true);
    try {
      await reviewExtensionRequest(request.id, {
        action,
        admin_note: adminNote || undefined,
        ...(action === 'approve' ? { new_deadline: new Date(newDeadline).toISOString() } : {}),
      });
      success(action === 'approve' ? 'Tasdiqlandi' : 'Rad etildi', `${request.student_name}ga xabar yuborildi`);
      onDone();
    } catch (err) {
      error('Xatolik', err instanceof Error ? err.message : 'Amal bajarilmadi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="mt-4 space-y-3 border-t border-border pt-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label-micro mb-1 block">Yangi muddat (tasdiqlash uchun)</label>
          <input
            type="datetime-local"
            value={newDeadline}
            onChange={(e) => setNewDeadline(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            className="input w-full text-sm"
          />
        </div>
        <div>
          <label className="label-micro mb-1 block">Izoh (ixtiyoriy)</label>
          <input
            type="text"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="Talabaga eslatma..."
            className="input w-full text-sm"
          />
        </div>
      </div>
      <div className="flex gap-3">
        <button type="button" disabled={loading} onClick={() => void submit('approve')} className="btn btn-primary inline-flex items-center gap-2 py-2.5 text-sm">
          <CheckCircle2 size={15} /> Tasdiqlash
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void submit('reject')}
          className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-100"
        >
          <XCircle size={15} /> Rad etish
        </button>
      </div>
    </motion.div>
  );
}

function RequestCard({ request, showActions, onRefresh }: { key?: number; request: ExtensionRequest; showActions: boolean; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-micro rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{request.course_title}</span>
            {request.status === 'pending' ? (
              <span className="label-micro rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">Kutilmoqda</span>
            ) : null}
          </div>
          <p className="text-sm font-black text-text-primary">{request.assignment_title}</p>
          <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
            <UserIcon size={12} />
            <span>{request.student_name}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1 text-right text-xs font-medium">
          <div className="flex items-center justify-end gap-1 text-text-secondary">
            <Clock size={11} />
            <span>Asl: {request.original_deadline ? new Date(request.original_deadline).toLocaleString('uz-UZ') : '—'}</span>
          </div>
          <div className="flex items-center justify-end gap-1 text-amber-600">
            <CalendarClock size={11} />
            <span>So'rov: {new Date(request.requested_deadline).toLocaleString('uz-UZ')}</span>
          </div>
          {request.approved_deadline ? (
            <div className="flex items-center justify-end gap-1 text-emerald-600">
              <CheckCircle2 size={11} />
              <span>Tasdiq: {new Date(request.approved_deadline).toLocaleString('uz-UZ')}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-slate-50 p-3">
        <p className="mb-0.5 text-xs font-bold text-text-secondary">Sabab:</p>
        <p className="text-xs font-medium text-text-primary">{request.reason}</p>
      </div>

      {showActions ? (
        <div className="mt-3">
          <button type="button" onClick={() => setExpanded((v) => !v)} className="text-xs font-bold text-primary underline underline-offset-2 hover:text-primary/80">
            {expanded ? "Yig'ish ↑" : "Ko'rib chiqish ↓"}
          </button>
          <AnimatePresence>
            {expanded ? <ReviewForm request={request} onDone={() => { setExpanded(false); onRefresh(); }} /> : null}
          </AnimatePresence>
        </div>
      ) : null}

      {request.admin_note ? (
        <div className="mt-3 rounded-xl border border-border bg-slate-50 p-3">
          <p className="text-xs font-bold text-text-secondary">Admin izohi: {request.admin_note}</p>
        </div>
      ) : null}
    </motion.div>
  );
}

export default function AdminExtensionRequestsPage() {
  const [tab, setTab] = useState<TabStatus>('pending');
  const [requests, setRequests] = useState<ExtensionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (status: TabStatus) => {
    setLoading(true);
    try {
      setRequests(await fetchExtensionRequests(status));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(tab); }, [tab, load]);

  const tabs: Array<{ label: string; value: TabStatus; colour: string }> = [
    { label: 'Kutilmoqda', value: 'pending', colour: 'text-amber-600' },
    { label: 'Tasdiqlangan', value: 'approved', colour: 'text-emerald-600' },
    { label: 'Rad etilgan', value: 'rejected', colour: 'text-rose-500' },
  ];

  return (
    <div className="space-y-8">
      <section className="card p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-text-primary">Muddat uzaytirish so'rovlari</h2>
            <p className="mt-1 text-sm font-medium text-text-secondary">Talabalar yuborgan so'rovlarni ko'rib chiqing</p>
          </div>
          <button type="button" onClick={() => void load(tab)} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold">
            <RefreshCw size={15} /> Yangilash
          </button>
        </div>

        <div className="mt-6 flex w-fit gap-1 rounded-2xl bg-slate-50 p-1">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${tab === t.value ? `bg-white shadow-sm ${t.colour}` : 'text-text-secondary hover:text-text-primary'}`}
            >
              {t.label}
              {tab === t.value && requests.length > 0 ? (
                <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black text-text-secondary">
                  {requests.length}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="card flex items-center justify-center gap-3 p-16 text-text-secondary">
          <span className="animate-spin text-2xl">⏳</span> Yuklanmoqda...
        </div>
      ) : requests.length === 0 ? (
        <div className="card p-12 text-center">
          <CalendarClock className="mx-auto text-text-secondary/30" size={48} />
          <p className="mt-4 text-lg font-black text-text-primary">So'rovlar yo'q</p>
          <p className="mt-2 text-sm text-text-secondary">Bu bo'limda hozircha so'rov mavjud emas</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {requests.map((r) => (
              <RequestCard key={r.id} request={r} showActions={tab === 'pending'} onRefresh={() => void load(tab)} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

