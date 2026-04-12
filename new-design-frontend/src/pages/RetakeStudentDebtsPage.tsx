import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarCheck2, Check, ExternalLink, FileText, Lock, RefreshCw } from 'lucide-react';
import { createRetakeApplication, fetchRetakeStudentDebts } from '@/src/api/retake';
import type { RetakeApplicationItemDocument, RetakeStudentDebtsApplication, RetakeStudentDebtsResponse } from '@/src/types';
import { cn } from '@/src/lib/utils';

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('uz-UZ').format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'medium' }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function DocumentLink({ doc }: { doc: RetakeApplicationItemDocument }) {
  if (!doc.url) {
    return <span className="text-xs text-text-muted">—</span>;
  }
  const label = doc.original_name?.trim() || doc.document_type || `Hujjat #${doc.id}`;
  return (
    <a
      href={doc.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1 truncate rounded-lg border border-border bg-white px-2 py-1 text-xs font-bold text-primary hover:bg-slate-50"
    >
      <FileText size={12} className="shrink-0" />
      <span className="truncate">{label}</span>
      <ExternalLink size={10} className="shrink-0 opacity-60" />
    </a>
  );
}

function ApplicationFileLink({
  url,
  label,
}: {
  url: string | null | undefined;
  label: string;
}) {
  if (!url) {
    return <span className="text-xs font-medium text-text-muted">Yuklanmagan</span>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/15"
    >
      <FileText size={14} />
      {label}
      <ExternalLink size={12} className="opacity-70" />
    </a>
  );
}

export default function RetakeStudentDebtsPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const syncOnLoad = searchParams.get('sync') === '1';
  const [data, setData] = useState<RetakeStudentDebtsResponse | null>(null);
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);
  const [selectedDebtIds, setSelectedDebtIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastApplicationId, setLastApplicationId] = useState<number | null>(null);

  const selectedCycle = useMemo(() => {
    if (!data) return null;
    return data.open_cycles.find((cycle) => cycle.id === selectedCycleId) || data.selected_cycle || null;
  }, [data, selectedCycleId]);

  const selectedDebts = useMemo(() => {
    if (!data) return [];
    const set = new Set(selectedDebtIds);
    return data.debts.filter((debt) => set.has(debt.id));
  }, [data, selectedDebtIds]);

  const totalCredits = useMemo(() => {
    return selectedDebts.reduce((sum, debt) => sum + (debt.credit || 0), 0);
  }, [selectedDebts]);

  const maxCredits = selectedCycle?.max_allowed_credits ?? 0;
  const overLimit = maxCredits > 0 && totalCredits > maxCredits;
  const canSubmit = selectedDebtIds.length > 0 && Boolean(selectedCycleId) && !overLimit && !isSubmitting;

  async function load(params = '') {
    if (!studentId) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetchRetakeStudentDebts(Number(studentId), params);
      setData(response);
      setWarning(response.warning || null);
      setSelectedDebtIds([]);
      const fromUrl = searchParams.get('cycle_id');
      const fromUrlNum = fromUrl && /^\d+$/.test(fromUrl) ? Number(fromUrl) : null;
      if (fromUrlNum && response.open_cycles.some((c) => c.id === fromUrlNum)) {
        setSelectedCycleId(fromUrlNum);
      } else {
        setSelectedCycleId(response.selected_cycle?.id || response.open_cycles[0]?.id || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Qarzdorliklar yuklanmadi.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load(syncOnLoad ? 'sync=1' : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, syncOnLoad]);

  function toggleDebt(id: number) {
    if (data?.applied_debt_ids.includes(id)) return;
    setSelectedDebtIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  async function handleCreateApplication() {
    if (!studentId || !selectedCycleId) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = await createRetakeApplication(Number(studentId), {
        cycle_id: selectedCycleId,
        debt_ids: selectedDebtIds,
      });
      setLastApplicationId(payload.application.id);
      setSuccess('Ariza yaratildi yoki yangilandi.');
      await load('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ariza yaratilmadi.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="card overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-primary/80 p-8 text-white lg:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/70">Retake talaba</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight">
                {data?.student.full_name || 'Talaba'}
              </h2>
              <p className="mt-2 text-sm font-semibold text-white/80">
                {data?.student.group_name || '-'} - {data?.student.faculty_name || '-'} - ID: {data?.student.student_id_number || '-'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void load('sync=1')}
                className="inline-flex items-center gap-2 rounded-2xl bg-white/20 px-4 py-3 text-sm font-bold text-white"
              >
                <RefreshCw size={16} />
                HEMIS bilan yangilash
              </button>
              <button
                type="button"
                onClick={() => navigate('/retake/search-student')}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-primary"
              >
                Orqaga
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {data?.student ? (
        <section className="card p-6 lg:p-8">
          <div className="flex items-center gap-2">
            <FileText className="text-primary" size={20} />
            <h3 className="text-lg font-black text-text-primary">Talaba — barcha ma&apos;lumotlar</h3>
          </div>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['F.I.Sh.', data.student.full_name],
              ['Qisqa ism', data.student.short_name || '—'],
              ['HEMIS ID', data.student.hemis_student_id != null ? String(data.student.hemis_student_id) : '—'],
              ['Talaba ID raqami', data.student.student_id_number || '—'],
              ['PINFL', data.student.pinfl || '—'],
              ['Guruh', data.student.group_name || '—'],
              ['Fakultet', data.student.faculty_name || '—'],
              ['Yo‘nalish', data.student.specialty_name || '—'],
              ['Semestr kodi', data.student.semester_code || '—'],
              ['Semestr', data.student.semester_name || '—'],
              ['Email', data.student.email || '—'],
              ['Telefon', data.student.phone || '—'],
              ['Oxirgi sinxron', formatDateTime(data.student.synced_at)],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-border/80 bg-slate-50/80 px-4 py-3">
                <dt className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">{label}</dt>
                <dd className="mt-1 text-sm font-semibold text-text-primary break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {error ? <div className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger">{error}</div> : null}
      {warning ? <div className="rounded-2xl bg-warning/10 px-4 py-3 text-sm font-bold text-warning">{warning}</div> : null}
      {success ? (
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {success}
          {lastApplicationId ? (
            <button
              type="button"
              onClick={() => navigate(`/retake/applications?app_id=${lastApplicationId}`)}
              className="ml-3 inline-flex items-center gap-2 text-emerald-700"
            >
              Arizani ochish
              <ArrowRight size={14} />
            </button>
          ) : null}
        </div>
      ) : null}

      <section className="card p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-black text-text-primary">Qarzdorliklar</h3>
            <p className="mt-1 text-sm font-medium text-text-secondary">
              Tanlangan fanlar bo'yicha qayta topshirish arizasi yaratiladi.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <CalendarCheck2 size={18} className="text-primary" />
            <select
              value={selectedCycleId || ''}
              onChange={(event) => setSelectedCycleId(Number(event.target.value))}
              className="input min-w-[220px]"
              disabled={!data?.open_cycles.length}
            >
              <option value="" disabled>Retake davrini tanlang</option>
              {data?.open_cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.name} ({cycle.max_allowed_credits ?? 0} kr)
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-6 text-sm font-bold text-text-secondary">Yuklanmoqda...</div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs font-extrabold uppercase tracking-wider text-text-muted">
                  <th className="px-4 py-3 text-center"></th>
                  <th className="px-4 py-3 text-left">Fan nomi</th>
                  <th className="px-4 py-3 text-left">Semestr</th>
                  <th className="px-4 py-3 text-center">Kredit</th>
                  <th className="px-4 py-3 text-left">Nazorat turi</th>
                  <th className="px-4 py-3 text-center">Ball</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.debts.length ? (
                  data.debts.map((debt) => {
                    const applied = data.applied_debt_ids.includes(debt.id);
                    const selected = selectedDebtIds.includes(debt.id);
                    return (
                      <tr
                        key={debt.id}
                        className={cn(
                          'transition-colors',
                          applied ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50',
                          selected ? 'bg-primary/5' : ''
                        )}
                        onClick={() => toggleDebt(debt.id)}
                        role="button"
                      >
                        <td className="px-4 py-3 text-center">
                          {applied ? (
                            <Lock size={16} className="mx-auto text-text-muted" />
                          ) : (
                            <div className={cn('mx-auto flex h-6 w-6 items-center justify-center rounded-full border', selected ? 'border-primary bg-primary text-white' : 'border-border')}>
                              {selected ? <Check size={14} /> : null}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-text-primary">{debt.subject_name}</div>
                          <div className="text-xs text-text-muted">{debt.subject_code}</div>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">{debt.semester_label || '-'}</td>
                        <td className="px-4 py-3 text-center font-bold text-primary">{debt.credit ?? 0}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-text-secondary">
                            {debt.exam_type_label || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-black text-danger">
                          {debt.total_point ?? debt.grade ?? 0}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-text-muted">
                      Qarzdorliklar topilmadi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-slate-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-text-muted">Jami tanlangan</span>
            <div className={cn('mt-2 text-2xl font-black', overLimit ? 'text-danger' : 'text-text-primary')}>
              {totalCredits.toFixed(1)} / {maxCredits ? maxCredits.toFixed(1) : '0.0'} kr
            </div>
            {overLimit ? (
              <p className="mt-1 text-xs font-bold text-danger">
                Kredit limiti oshdi.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void handleCreateApplication()}
            className={cn(
              'inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white',
              canSubmit ? 'bg-primary' : 'bg-slate-300 cursor-not-allowed'
            )}
            disabled={!canSubmit}
          >
            Ariza yaratish
            <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {data?.applications.length ? (
        <section className="card p-6 lg:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-text-primary">Retake arizalari va hujjatlar</h3>
              <p className="mt-1 text-sm font-medium text-text-secondary">
                Har bir ariza uchun shartnoma, to‘lov cheki va fan bo‘yicha biriktirilgan PDF fayllar.
              </p>
            </div>
            <span className="w-fit rounded-xl bg-primary/10 px-3 py-2 text-xs font-extrabold text-primary">
              {data.applications.length} ta
            </span>
          </div>
          <div className="mt-6 space-y-6">
            {data.applications.map((app: RetakeStudentDebtsApplication) => (
              <div
                key={app.id}
                className="rounded-2xl border border-border bg-slate-50/50 p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-wider text-text-muted">Ariza</p>
                    <p className="mt-1 text-xl font-black text-text-primary">#{app.id}</p>
                    <p className="mt-2 text-sm font-semibold text-text-secondary">
                      {app.cycle?.name || '—'} · {formatDate(app.created_at)}
                    </p>
                    <p className="mt-2">
                      <span className="status-pill status-pill-primary">{app.status_label}</span>
                    </p>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm">
                      <span>
                        <span className="text-text-muted">Kredit: </span>
                        <span className="font-bold text-primary">{app.total_credit ?? 0} kr</span>
                      </span>
                      <span>
                        <span className="text-text-muted">E’lon qilingan: </span>
                        <span className="font-bold">{formatMoney(app.declared_amount)} UZS</span>
                      </span>
                      <span>
                        <span className="text-text-muted">Buxgalteriya: </span>
                        <span className="font-bold">{formatMoney(app.accountant_amount)} UZS</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end lg:flex-col lg:items-stretch">
                    <div className="space-y-2">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Ariza hujjatlari</p>
                      <div className="flex flex-wrap gap-2">
                        <ApplicationFileLink
                          url={app.contract_url}
                          label={app.contract_original_name?.trim() ? `Shartnoma: ${app.contract_original_name}` : 'Shartnoma (PDF)'}
                        />
                        <ApplicationFileLink
                          url={app.receipt_url}
                          label={app.receipt_original_name?.trim() ? `Chek: ${app.receipt_original_name}` : 'To‘lov cheki (PDF)'}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/retake/applications?app_id=${app.id}`)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-xs font-bold text-text-primary hover:bg-slate-50"
                    >
                      Arizani retake panelida ochish
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
                {app.items?.length ? (
                  <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-white">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-[10px] font-extrabold uppercase tracking-wider text-text-muted">
                          <th className="px-4 py-3">Fan</th>
                          <th className="px-4 py-3">Holat</th>
                          <th className="px-4 py-3">Summa</th>
                          <th className="px-4 py-3">Biriktirilgan fayllar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {app.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3">
                              <div className="font-bold text-text-primary">{item.subject_name}</div>
                              <div className="text-xs text-text-muted">{item.subject_code}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold">{item.status_label}</span>
                            </td>
                            <td className="px-4 py-3 font-semibold">{formatMoney(item.amount)}</td>
                            <td className="px-4 py-3">
                              {item.documents?.length ? (
                                <div className="flex flex-col gap-1.5">
                                  {item.documents.map((doc) => (
                                    <Fragment key={doc.id}>
                                      <DocumentLink doc={doc} />
                                    </Fragment>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-text-muted">Fayl yo‘q</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
