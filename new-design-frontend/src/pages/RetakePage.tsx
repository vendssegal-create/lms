import {
  CalendarRange,
  CheckCircle2,
  CreditCard,
  FileStack,
  Filter,
  LoaderCircle,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Upload,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchRetakeApplicationDetail,
  fetchRetakeApplications,
  prefetchRetakeApplicationDetail,
  submitAccountingAction,
  submitSupervisorAction,
  updateRetakeApplication,
  invalidateRetakeApplicationsCache,
} from '@/src/api/retake';
import { useAuth } from '@/src/features/auth/auth-context';
import { canAccountingReview, canSupervisorReview } from '@/src/lib/roles';
import { cn } from '@/src/lib/utils';
import type {
  RetakeApplicationDetail,
  RetakeApplicationListItem,
  RetakeApplicationsResponse,
} from '@/src/types';
import { Link, useLocation } from 'react-router-dom';

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
  const [selectedDetail, setSelectedDetail] = useState<RetakeApplicationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [faculty, setFaculty] = useState('');
  const [group, setGroup] = useState('');
  const [cycleId, setCycleId] = useState('');
  const [actionComment, setActionComment] = useState('');
  const [accountantAmount, setAccountantAmount] = useState('');
  const [editDeclaredAmount, setEditDeclaredAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
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
      if (!nextId) {
        setSelectedDetail(null);
      } else {
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
      setSelectedDetail(null);
      return;
    }

    let cancelled = false;

    async function loadDetail() {
      setIsDetailLoading(true);
      try {
        const payload = await fetchRetakeApplicationDetail(selectedId);
        if (!cancelled) {
          setSelectedDetail(payload.application);
          setActionComment('');
          setAccountantAmount(payload.application.accountant_amount ? String(payload.application.accountant_amount) : '');
          setEditDeclaredAmount(payload.application.declared_amount ? String(payload.application.declared_amount) : '');
          setEditNotes(payload.application.notes || '');
          setContractFile(null);
          setReceiptFile(null);
          setEditSuccess(null);
        }
      } catch {
        if (!cancelled) {
          setSelectedDetail(null);
        }
      } finally {
        if (!cancelled) {
          setIsDetailLoading(false);
        }
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetailModalOpen(false);
    }
  }, [selectedId]);

  useEffect(() => {
    if (!preselectId || !selectedDetail || selectedDetail.id !== preselectId || isDetailLoading) return;
    if (openedDetailFromUrlRef.current) return;
    openedDetailFromUrlRef.current = true;
    setDetailModalOpen(true);
  }, [preselectId, selectedDetail, isDetailLoading]);

  useEffect(() => {
    if (!detailModalOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedId(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [detailModalOpen]);

  useEffect(() => {
    if (!detailModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [detailModalOpen]);

  useEffect(() => {
    if (!preselectId) {
      openedDetailFromUrlRef.current = false;
    }
  }, [preselectId]);

  const applications = data?.applications || [];
  const cards = data ? summaryCards(data.summary) : [];
  const canReviewAccounting = canAccountingReview(activeRole);
  const canReviewSupervisor = canSupervisorReview(activeRole);

  async function refreshDetailAndList(nextDetail: RetakeApplicationDetail) {
    setSelectedDetail(nextDetail);
    await loadApplications(queryString, true);
  }

  async function handleSaveDraft(action: 'save' | 'submit_to_accounting') {
    if (!selectedDetail) return;
    setIsSavingDraft(true);
    setError(null);
    setEditSuccess(null);
    try {
      const res = await updateRetakeApplication(selectedDetail.id, {
        action,
        declared_amount: editDeclaredAmount,
        notes: editNotes,
        contract_file: contractFile || undefined,
        receipt_file: receiptFile || undefined,
      });
      if (res.success) {
        invalidateRetakeApplicationsCache(selectedDetail.id);
        setSelectedDetail(res.application);
        setContractFile(null);
        setReceiptFile(null);
        await loadApplications(queryString, true);
        setEditSuccess(
          action === 'submit_to_accounting'
            ? "Butun ariza buxgalteriyaga yuborildi. Buxgalteriya arizani ko‘rib, tasdiqlashi yoki izoh bilan qaytarishi mumkin."
            : "O'zgarishlar saqlandi."
        );
      } else {
        setError(res.error || 'Xatolik yuz berdi.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saqlashda xatolik.');
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function handleAccountingAction(action: 'approve' | 'reject') {
    if (!selectedDetail) return;
    setIsSubmittingAction(true);
    setError(null);
    try {
      const payload = await submitAccountingAction(selectedDetail.id, {
        action,
        comment: actionComment,
        accountant_amount: action === 'approve' ? accountantAmount : undefined,
      });
      await refreshDetailAndList(payload.application);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Accounting action bajarilmadi.');
    } finally {
      setIsSubmittingAction(false);
    }
  }

  async function handleSupervisorAction(action: 'approve' | 'reject') {
    if (!selectedDetail) return;
    setIsSubmittingAction(true);
    setError(null);
    try {
      const payload = await submitSupervisorAction(selectedDetail.id, {
        action,
        comment: actionComment,
      });
      await refreshDetailAndList(payload.application);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Supervisor action bajarilmadi.');
    } finally {
      setIsSubmittingAction(false);
    }
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

        {detailModalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            aria-label="Modalni yopish"
            onClick={() => setSelectedId(null)}
          />
          <div
            className="relative z-10 flex max-h-[min(90vh,920px)] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-border bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="retake-detail-title"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
              <p id="retake-detail-title" className="text-sm font-black text-text-primary">
                Ariza batafsil
              </p>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-text-secondary transition-colors hover:bg-slate-50 hover:text-text-primary"
                aria-label="Yopish"
                onClick={() => setSelectedId(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8 sm:py-8">
          {isDetailLoading ? (
            <div className="flex items-center justify-center gap-3 py-20 text-sm font-bold text-text-secondary">
              <LoaderCircle size={18} className="animate-spin" />
              Detail yuklanmoqda
            </div>
          ) : !selectedDetail ? (
            <div className="py-20 text-center text-sm font-medium text-text-secondary">Ariza tanlanmagan.</div>
          ) : (
            <div className="space-y-8">
              <div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="label-micro">Ariza #{selectedDetail.id}</p>
                    <h3 className="mt-2 text-2xl font-black tracking-tight text-text-primary">{selectedDetail.student.full_name}</h3>
                    <p className="mt-2 text-sm font-medium text-text-secondary">
                      Quyida arizaning barcha qismlari: talaba, fanlar, summalar, hujjatlar va tarix.
                    </p>
                  </div>
                  <span className={cn('status-pill shrink-0', statusTone(selectedDetail.status))}>{selectedDetail.status_label}</span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-[24px] bg-slate-50 p-4 sm:col-span-2 lg:col-span-1">
                    <p className="label-micro">Talaba</p>
                    <div className="mt-3 space-y-2 text-sm font-bold text-text-primary">
                      <div className="flex items-center gap-2">
                        <UserRound size={16} className="shrink-0 text-primary" />
                        <span>{selectedDetail.student.student_id_number || "ID yo'q"}</span>
                      </div>
                      <p className="pl-6 text-sm font-medium text-text-secondary">
                        {selectedDetail.student.faculty_name || "Fakultet ko'rsatilmagan"}
                      </p>
                      <p className="pl-6 text-sm font-medium text-text-secondary">
                        Guruh: {selectedDetail.student.group_name || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-[24px] bg-slate-50 p-4">
                    <p className="label-micro">Qayta o&apos;qish tsikli</p>
                    <div className="mt-3 flex items-center gap-2 text-sm font-bold text-text-primary">
                      <CalendarRange size={16} className="text-primary" />
                      {selectedDetail.cycle?.name || '-'}
                    </div>
                  </div>
                  <div className="rounded-[24px] bg-slate-50 p-4">
                    <p className="label-micro">Vaqt</p>
                    <p className="mt-2 text-xs font-medium text-text-secondary">Yaratilgan: {formatDate(selectedDetail.created_at)}</p>
                    <p className="mt-1 text-xs font-medium text-text-secondary">Yangilangan: {formatDate(selectedDetail.updated_at)}</p>
                    <p className="mt-1 text-xs font-medium text-text-secondary">
                      Buxgalteriyaga yuborilgan: {formatDate(selectedDetail.submitted_at)}
                    </p>
                  </div>
                  <div className="rounded-[24px] bg-slate-50 p-4">
                    <p className="label-micro">Ariza bo&apos;yicha summa</p>
                    <div className="mt-3 flex items-center gap-2 text-sm font-bold text-text-primary">
                      <CreditCard size={16} className="text-primary" />
                      {formatMoney(selectedDetail.declared_amount)}
                    </div>
                  </div>
                  <div className="rounded-[24px] bg-slate-50 p-4">
                    <p className="label-micro">Buxgalter tasdiqlagan</p>
                    <div className="mt-3 flex items-center gap-2 text-sm font-bold text-text-primary">
                      <CreditCard size={16} className="text-primary" />
                      {formatMoney(selectedDetail.accountant_amount)}
                    </div>
                  </div>
                  <div className="rounded-[24px] bg-slate-50 p-4">
                    <p className="label-micro">Fanlar (jami)</p>
                    <p className="mt-3 text-sm font-bold text-text-primary">
                      {selectedDetail.item_count} ta • {selectedDetail.total_credit ?? 0} kredit
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="label-micro">Fanlar ro&apos;yxati</p>
                <p className="mt-1 text-xs font-medium text-text-muted">
                  Fanlarni alohida yuborish shart emas — registrator butun arizani bir marta buxgalteriyaga yuboradi.
                </p>
                <div className="mt-3 overflow-x-auto rounded-[24px] border border-border">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-slate-50 text-left text-[10px] font-extrabold uppercase tracking-wider text-text-muted">
                        <th className="px-4 py-3">Fan</th>
                        <th className="px-4 py-3">Kod</th>
                        <th className="px-4 py-3">Kredit</th>
                        <th className="px-4 py-3">Nazorat</th>
                        <th className="px-4 py-3">Summa</th>
                        <th className="px-4 py-3">To&apos;lov</th>
                        <th className="px-4 py-3">Holat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedDetail.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-bold text-text-primary">{item.subject_name}</td>
                          <td className="px-4 py-3 text-text-secondary">{item.subject_code || '—'}</td>
                          <td className="px-4 py-3 font-medium">{item.credit ?? '—'}</td>
                          <td className="px-4 py-3 text-text-secondary">{item.required_control_type || '—'}</td>
                          <td className="px-4 py-3 font-semibold">{formatMoney(item.amount)}</td>
                          <td className="px-4 py-3 text-xs text-text-muted">
                            {item.payment_date ? formatDate(item.payment_date) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn('status-pill whitespace-nowrap', statusTone(item.status))}>{item.status_label}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <p className="label-micro">Izohlar</p>
                <div className="mt-3 space-y-3 rounded-[28px] border border-border p-5 text-sm font-medium text-text-secondary">
                  <p><span className="font-black text-text-primary">Talaba:</span> {selectedDetail.notes || "Izoh yo'q"}</p>
                  <p><span className="font-black text-text-primary">Buxgalteriya:</span> {selectedDetail.accountant_comment || "Izoh yo'q"}</p>
                </div>
              </div>

              {/* PDF preview va havolalar */}
              {(selectedDetail.contract_url || selectedDetail.receipt_url) ? (
                <div>
                  <p className="label-micro">Hujjatlar (preview)</p>
                  <p className="mt-1 text-xs font-medium text-text-muted">
                    {selectedDetail.status === 'in_review' || selectedDetail.status === 'partially_approved' || selectedDetail.status === 'approved'
                      ? "Butun ariza buxgalteriyada ko‘rib chiqilgach hujjatlarni o‘zgartirib bo‘lmaydi."
                      : null}
                  </p>
                  <div className="mt-4 space-y-6">
                    {selectedDetail.contract_url ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-black text-text-primary">Kredit shartnomasi</p>
                          <a
                            href={selectedDetail.contract_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-primary hover:underline"
                          >
                            Yangi tabda ochish
                          </a>
                        </div>
                        <iframe
                          title="Shartnoma preview"
                          src={selectedDetail.contract_url}
                          className="h-72 w-full rounded-2xl border border-border bg-slate-50"
                        />
                      </div>
                    ) : null}
                    {selectedDetail.receipt_url ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-black text-text-primary">To'lov cheki</p>
                          <a
                            href={selectedDetail.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-primary hover:underline"
                          >
                            Yangi tabda ochish
                          </a>
                        </div>
                        <iframe
                          title="Chek preview"
                          src={selectedDetail.receipt_url}
                          className="h-72 w-full rounded-2xl border border-border bg-slate-50"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div>
                <p className="label-micro">Jarayon tarixi</p>
                <div className="mt-3 space-y-3">
                  {selectedDetail.workflow_events.length === 0 ? (
                    <div className="rounded-[24px] border border-border p-4 text-sm font-medium text-text-secondary">
                      Jarayon yozuvlari topilmadi.
                    </div>
                  ) : selectedDetail.workflow_events.map((event) => (
                    <div key={event.id} className="rounded-[24px] border border-border p-4">
                      <p className="text-sm font-black text-text-primary">{event.actor_name}</p>
                      <p className="mt-1 text-sm font-medium text-text-secondary">
                        {event.action} • {event.from_status || '-'} {'>'} {event.to_status || '-'}
                      </p>
                      <p className="mt-2 text-xs font-medium text-text-muted">{formatDate(event.created_at)}</p>
                      {event.comment ? <p className="mt-2 text-sm font-medium text-text-secondary">{event.comment}</p> : null}
                    </div>
                  ))}
                </div>
              </div>

              {/* Registrator: butun arizani buxgalteriyaga yuborish */}
              {selectedDetail.can_edit ? (
                <div>
                  <p className="label-micro">Arizani yakunlash va yuborish</p>
                  <p className="mt-1 text-xs font-medium text-text-muted">
                    Bu yerda bitta butun arizani (barcha fanlar bilan) buxgalteriyaga yuborasiz. Buxgalteriya arizani ko‘rib, tasdiqlaydi yoki izoh bilan qaytaradi.
                  </p>
                  <div className="mt-3 rounded-[28px] border border-border p-5 space-y-5">
                    {editSuccess && (
                      <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-bold text-emerald-700">{editSuccess}</div>
                    )}

                    <label className="block space-y-2">
                      <span className="text-xs font-black uppercase tracking-wider text-text-muted">Shartnoma summasi (so'm)</span>
                      <input
                        value={editDeclaredAmount}
                        onChange={(e) => setEditDeclaredAmount(e.target.value)}
                        className="input"
                        placeholder="Masalan: 450000"
                        type="text"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-black uppercase tracking-wider text-text-muted">Izoh</span>
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        className="input min-h-20"
                        placeholder="Qo'shimcha izoh..."
                      />
                    </label>

                    {/* Shartnoma fayli */}
                    <div className="space-y-2">
                      <span className="text-xs font-black uppercase tracking-wider text-text-muted">Kredit shartnomasi</span>
                      {selectedDetail.contract_attached && !contractFile ? (
                        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                          <Paperclip size={14} className="text-emerald-600" />
                          <span className="text-sm font-bold text-emerald-700">{selectedDetail.contract_original_name || 'Shartnoma yuklangan'}</span>
                          <a href={selectedDetail.contract_url} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-primary font-bold hover:underline">Ko'rish</a>
                        </div>
                      ) : null}
                      <label className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-border px-4 py-4 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
                        <Upload size={18} className="text-text-muted" />
                        <span className="text-sm font-bold text-text-secondary">
                          {contractFile ? contractFile.name : (selectedDetail.contract_attached ? 'Yangi fayl tanlash' : 'Shartnoma yuklang')}
                        </span>
                        <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => setContractFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>

                    {/* To'lov cheki */}
                    <div className="space-y-2">
                      <span className="text-xs font-black uppercase tracking-wider text-text-muted">To'lov cheki</span>
                      {selectedDetail.receipt_attached && !receiptFile ? (
                        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                          <Paperclip size={14} className="text-emerald-600" />
                          <span className="text-sm font-bold text-emerald-700">{selectedDetail.receipt_original_name || 'Chek yuklangan'}</span>
                          <a href={selectedDetail.receipt_url} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-primary font-bold hover:underline">Ko'rish</a>
                        </div>
                      ) : null}
                      <label className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-border px-4 py-4 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
                        <Upload size={18} className="text-text-muted" />
                        <span className="text-sm font-bold text-text-secondary">
                          {receiptFile ? receiptFile.name : (selectedDetail.receipt_attached ? 'Yangi fayl tanlash' : "To'lov chekini yuklang")}
                        </span>
                        <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>

                    {/* Tugmalar */}
                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        type="button"
                        disabled={isSavingDraft}
                        onClick={() => void handleSaveDraft('save')}
                        className="inline-flex items-center gap-2 rounded-2xl border border-border px-5 py-3 text-sm font-bold text-text-primary hover:bg-slate-50 disabled:opacity-60"
                      >
                        {isSavingDraft ? <LoaderCircle size={16} className="animate-spin" /> : null}
                        Saqlash
                      </button>
                      <button
                        type="button"
                        disabled={isSavingDraft}
                        onClick={() => void handleSaveDraft('submit_to_accounting')}
                        className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-xl shadow-primary/20 disabled:opacity-60"
                      >
                        {isSavingDraft ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
                        Arizani buxgalteriyaga yuborish
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {((canReviewAccounting && selectedDetail.status === 'in_review') ||
                (canReviewSupervisor && selectedDetail.status === 'partially_approved')) ? (
                <div>
                  <p className="label-micro">Buxgalteriya / rahbar</p>
                  <div className="mt-3 rounded-[28px] border border-border p-5">
                    {canReviewAccounting && selectedDetail.status === 'in_review' ? (
                      <div className="space-y-4">
                        <p className="text-sm font-medium text-text-secondary">
                          Butun arizani ko‘rib chiqing: fanlar va hujjatlar yuqorida. Tasdiqlash yoki qaytarish ariza bo‘yicha amalga oshadi.
                        </p>
                        <label className="block space-y-2">
                          <span className="label-micro">Buxgalteriya summasi</span>
                          <input
                            value={accountantAmount}
                            onChange={(event) => setAccountantAmount(event.target.value)}
                            className="input"
                            placeholder="Masalan: 450000"
                          />
                        </label>
                        <label className="block space-y-2">
                          <span className="label-micro">Izoh</span>
                          <textarea
                            value={actionComment}
                            onChange={(event) => setActionComment(event.target.value)}
                            className="input min-h-28"
                            placeholder="Buxgalteriya izohi"
                          />
                        </label>
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            disabled={isSubmittingAction}
                            onClick={() => void handleAccountingAction('approve')}
                            className="inline-flex items-center gap-2 rounded-2xl bg-success px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                          >
                            {isSubmittingAction ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            Tasdiqlash
                          </button>
                          <button
                            type="button"
                            disabled={isSubmittingAction}
                            onClick={() => void handleAccountingAction('reject')}
                            className="inline-flex items-center gap-2 rounded-2xl bg-danger px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                          >
                            <XCircle size={16} />
                            Qaytarish
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {canReviewSupervisor && selectedDetail.status === 'partially_approved' ? (
                      <div className="space-y-4">
                        <p className="text-sm font-medium text-text-secondary">
                          Buxgalteriya qismi yakunlangan ariza. Rahbar sifatida butun arizani yakuniy tasdiqlang yoki qaytaring.
                        </p>
                        <label className="block space-y-2">
                          <span className="label-micro">Rahbar izohi</span>
                          <textarea
                            value={actionComment}
                            onChange={(event) => setActionComment(event.target.value)}
                            className="input min-h-28"
                            placeholder="Supervisor izohi"
                          />
                        </label>
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            disabled={isSubmittingAction}
                            onClick={() => void handleSupervisorAction('approve')}
                            className="inline-flex items-center gap-2 rounded-2xl bg-success px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                          >
                            {isSubmittingAction ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            Tasdiqlash
                          </button>
                          <button
                            type="button"
                            disabled={isSubmittingAction}
                            onClick={() => void handleSupervisorAction('reject')}
                            className="inline-flex items-center gap-2 rounded-2xl bg-danger px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                          >
                            <XCircle size={16} />
                            Qaytarish
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          )}
            </div>
          </div>
        </div>
        ) : null}
      </section>
    </div>
  );
}
