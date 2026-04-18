import {
  FileStack,
  Filter,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchRetakeApplications,
  prefetchRetakeApplicationDetail,
} from '@/src/api/retake';
import { useAuth } from '@/src/features/auth/auth-context';
import { cn } from '@/src/lib/utils';
import type {
  RetakeApplicationListItem,
  RetakeApplicationsResponse,
} from '@/src/types';
import { Link, useLocation } from 'react-router-dom';
import RetakeApplicationModal from './RetakeApplicationModal';

function formatMoney(value: number | null) {
  if (value === null || value === undefined) {
    return '-';
  }
  return new Intl.NumberFormat('uz-UZ').format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return '-';
  }
  return new Intl.DateTimeFormat('uz-UZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function summaryCards(summary: RetakeApplicationsResponse['summary']) {
  return [
    { label: 'Jami arizalar', value: summary.total, tone: 'text-primary bg-primary/10' },
    { label: 'Qoralama', value: summary.draft, tone: 'text-slate-700 bg-slate-100' },
    { label: "Ko'rib chiqishda", value: summary.in_review, tone: 'text-warning bg-warning/10' },
    { label: 'Qisman tasdiq', value: summary.partially_approved, tone: 'text-secondary bg-secondary/10' },
    { label: 'Tasdiqlangan', value: summary.approved, tone: 'text-success bg-success/10' },
  ];
}

function statusTone(status: string) {
  if (status === 'approved' || status === 'completed') return 'status-pill-success';
  if (status === 'in_review' || status === 'partially_approved') return 'status-pill-warning';
  if (status === 'returned' || status === 'cancelled') return 'status-pill-danger';
  return 'status-pill-primary';
}

export default function RetakePage() {
  const { session } = useAuth();
  const location = useLocation();
  const activeRole = session?.user?.active_role || '';
  const [data, setData] = useState<RetakeApplicationsResponse | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [faculty, setFaculty] = useState('');
  const [group, setGroup] = useState('');
  const [cycleId, setCycleId] = useState('');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const openedDetailFromUrlRef = useRef(false);

  const preselectId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const value = params.get('app_id');
    if (!value) return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }, [location.search]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (status) params.set('status', status);
    if (faculty) params.set('faculty', faculty);
    if (group) params.set('group', group);
    if (cycleId) params.set('cycle_id', cycleId);
    return params.toString();
  }, [search, status, faculty, group, cycleId]);

  async function loadApplications(query = queryString, forceReload = false) {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await fetchRetakeApplications(query, { cacheMode: forceReload ? 'reload' : 'default' });
      setData(payload);
      if (!cycleId && payload.selected_cycle?.id) {
        setCycleId(String(payload.selected_cycle.id));
      }
      let nextId: number | null = null;
      if (preselectId && payload.applications.some((item) => item.id === preselectId)) {
        nextId = preselectId;
      } else if (selectedId && payload.applications.some((item) => item.id === selectedId)) {
        nextId = selectedId;
      }
      setSelectedId(nextId);
      if (nextId) {
        void prefetchRetakeApplicationDetail(nextId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retake arizalari yuklanmadi.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadApplications('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  useEffect(() => {
    if (!selectedId) {
      setDetailModalOpen(false);
    }
  }, [selectedId]);

  useEffect(() => {
    if (!preselectId) {
      openedDetailFromUrlRef.current = false;
      return;
    }
    if (openedDetailFromUrlRef.current) return;
    // Open modal once the list has loaded and the preselectId is present
    if (data?.applications.some((item) => item.id === preselectId)) {
      openedDetailFromUrlRef.current = true;
      setSelectedId(preselectId);
      setDetailModalOpen(true);
    }
  }, [preselectId, data]);

  const applications = data?.applications || [];
  const cards = data ? summaryCards(data.summary) : [];

  function closeModal() {
    setSelectedId(null);
    setDetailModalOpen(false);
  }

  async function refreshList() {
    await loadApplications(queryString, true);
  }

  return (
    <div className="space-y-8">
      <section className="card p-8 lg:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary">
              <ShieldCheck size={12} />
              Retake boshqaruvi
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-text-primary lg:text-4xl">
              {activeRole === 'RET_REGISTRATOR' ? "Qayta o'qish arizalari" : 'Qayta topshirish arizalari'}
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-text-secondary">
              Arizalar, statuslar, filterlar va tasdiqlash jarayoni bitta boshqaruv oynasida jamlangan.
              {activeRole === 'RET_REGISTRATOR' ? " Siz faqat o'zingiz yaratgan va biriktirilgan fakultet talabalariga tegishli arizalarni ko'rasiz." : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {activeRole === 'RET_REGISTRATOR' ? (
              <Link
                to={`/retake/search-student${cycleId ? `?cycle_id=${encodeURIComponent(cycleId)}` : ''}`}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-xl shadow-primary/20 transition-all hover:bg-primary-hover"
              >
                <Plus size={18} />
                Yangi ariza
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void loadApplications(queryString, true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-bold text-text-primary transition-all hover:border-primary/20 hover:bg-primary/5"
            >
              <RefreshCw size={16} />
              Yangilash
            </button>
          </div>
        </div>
      </section>

      {activeRole === 'RET_REGISTRATOR' &&
      session?.user?.retake_assigned_faculties &&
      session.user.retake_assigned_faculties.length === 0 ? (
        <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-6 py-4 text-sm font-medium text-amber-900">
          Sizga hali fakultet biriktirilmagan. Django admin → Retake → «Xizmat registratori fakultet biriktiruvlari» orqali
          tayinlang; aks holda talaba qidiruv va yangi ariza mumkin emas.
        </div>
      ) : null}

      {data ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {cards.map((card) => (
            <div key={card.label} className="card p-6">
              <div className={cn('inline-flex rounded-2xl px-3 py-2 text-xs font-black', card.tone)}>{card.label}</div>
              <p className="mt-5 text-4xl font-black tracking-tight text-text-primary">{card.value}</p>
            </div>
          ))}
        </section>
      ) : null}

      <section className="card p-6 lg:p-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-2">
            <span className="label-micro">Qidiruv</span>
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="input pl-11" placeholder="Talaba yoki ID" />
            </div>
          </label>
          <label className="space-y-2">
            <span className="label-micro">Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="input">
              <option value="">Barchasi</option>
              {data?.filters.statuses.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="label-micro">Fakultet</span>
            <select value={faculty} onChange={(event) => setFaculty(event.target.value)} className="input">
              <option value="">Barchasi</option>
              {data?.filters.faculties.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="label-micro">Guruh</span>
            <select value={group} onChange={(event) => setGroup(event.target.value)} className="input">
              <option value="">Barchasi</option>
              {data?.filters.groups.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="label-micro">Cycle</span>
            <select value={cycleId} onChange={(event) => setCycleId(event.target.value)} className="input">
              <option value="">Faol cycle</option>
              {data?.cycles.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => void loadApplications(queryString, true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-xl shadow-primary/20"
          >
            <Filter size={16} />
            Filtrni qo'llash
          </button>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setStatus('');
              setFaculty('');
              setGroup('');
              setCycleId('');
              void loadApplications('', true);
            }}
            className="inline-flex items-center gap-2 rounded-2xl border border-border px-5 py-3 text-sm font-bold text-text-primary"
          >
            Tozalash
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-[28px] border border-danger/20 bg-danger/10 px-6 py-5 text-sm font-medium text-danger">
          {error}
        </div>
      ) : null}

      <section>
        <div className="card overflow-hidden">
          <div className="border-b border-border/60 px-6 py-5 lg:px-8">
            <div className="flex items-center gap-3">
              <FileStack className="text-primary" size={18} />
              <h3 className="text-xl font-black tracking-tight text-text-primary">Retake applications</h3>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-3 px-6 py-16 text-sm font-bold text-text-secondary">
              <LoaderCircle size={18} className="animate-spin" />
              Yuklanmoqda
            </div>
          ) : applications.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm font-medium text-text-secondary">Mos ariza topilmadi.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {applications.map((application: RetakeApplicationListItem) => (
                <div
                  key={application.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedId(application.id);
                    setDetailModalOpen(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedId(application.id);
                      setDetailModalOpen(true);
                    }
                  }}
                  className={cn(
                    'grid w-full cursor-pointer gap-4 px-6 py-5 text-left transition-colors hover:bg-slate-50 lg:grid-cols-[minmax(0,1.4fr)_1fr_1fr_auto]',
                    selectedId === application.id && detailModalOpen ? 'bg-primary/5' : ''
                  )}
                >
                  <div>
                    <Link
                      to={`/retake/students/${application.student.id}/debts`}
                      className="text-base font-black tracking-tight text-text-primary hover:text-primary hover:underline"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {application.student.full_name}
                    </Link>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wider text-text-muted">
                      {application.student.student_id_number || "ID yo'q"} • {application.student.group_name || "Guruh yo'q"}
                    </p>
                    <p className="mt-3 text-sm font-medium text-text-secondary">
                      {application.item_count} ta fan • {application.total_credit ?? 0} kredit
                    </p>
                  </div>
                  <div>
                    <p className="label-micro">Cycle</p>
                    <p className="mt-2 text-sm font-bold text-text-primary">{application.cycle?.name || '-'}</p>
                    <p className="mt-1 text-xs font-medium text-text-secondary">
                      {application.student.faculty_name || "Fakultet yo'q"}
                    </p>
                  </div>
                  <div>
                    <p className="label-micro">To'lov</p>
                    <p className="mt-2 text-sm font-bold text-text-primary">{formatMoney(application.declared_amount)}</p>
                    <p className="mt-1 text-xs font-medium text-text-secondary">Buxg: {formatMoney(application.accountant_amount)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-3 text-right">
                    <span className={cn('status-pill', statusTone(application.status))}>{application.status_label}</span>
                    <p className="text-xs font-medium text-text-secondary">{formatDate(application.updated_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <RetakeApplicationModal
          open={detailModalOpen}
          selectedId={selectedId}
          onClose={closeModal}
          onActionSuccess={() => void refreshList()}
          userRole={activeRole}
        />
      </section>
    </div>
  );
}
