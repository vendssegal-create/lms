import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, LoaderCircle, Lock, RefreshCw, Save, UnlockKeyhole, Users } from 'lucide-react';
import { fetchRetakeExamSheet, saveRetakeExamSheet } from '@/src/api/retake';
import type { RetakeExamSheetResponse } from '@/src/types';

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Belgilanmagan';
  }
  return new Intl.DateTimeFormat('uz-UZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function gradeBadge(score: number | null, absent: boolean) {
  if (absent) return { label: 'Kelmagan', cls: 'status-pill-danger' };
  if (score === null || score === undefined) return { label: 'Kiritilmagan', cls: 'status-pill-primary' };
  if (score >= 86) return { label: '5', cls: 'status-pill-success' };
  if (score >= 71) return { label: '4', cls: 'status-pill-success' };
  if (score >= 60) return { label: '3', cls: 'status-pill-warning' };
  return { label: '2', cls: 'status-pill-danger' };
}

export default function RetakeExamSheetPage() {
  const { sheetId } = useParams();
  const numericSheetId = Number(sheetId);
  const [data, setData] = useState<RetakeExamSheetResponse | null>(null);
  const [draft, setDraft] = useState<Record<number, { score: string; is_absent: boolean }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchRetakeExamSheet(numericSheetId);
      setData(response);
      setDraft(
        Object.fromEntries(
          response.entries.map((entry) => [
            entry.id,
            {
              score: entry.score === null ? '' : String(entry.score),
              is_absent: entry.is_absent,
            },
          ]),
        ),
      );
      setWarnings(response.warnings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Exam sheet yuklanmadi.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!numericSheetId) {
      setError('Sheet ID noto‘g‘ri.');
      setIsLoading(false);
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericSheetId]);

  const summary = useMemo(
    () =>
      data
        ? [
            { label: 'Jami', value: data.stats.total },
            { label: 'Kiritilgan', value: data.stats.graded },
            { label: 'Kelmagan', value: data.stats.absent },
            { label: 'Present', value: data.stats.present },
          ]
        : [],
    [data],
  );

  async function submit(action: 'save' | 'submit' | 'unlock') {
    if (!data) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    setWarnings([]);
    try {
      const entries =
        action === 'unlock'
          ? []
          : data.entries.map((entry) => ({
              id: entry.id,
              score: draft[entry.id]?.score === '' ? null : Number(draft[entry.id]?.score),
              is_absent: draft[entry.id]?.is_absent || false,
            }));
      const response = await saveRetakeExamSheet(data.sheet.id, { action, entries });
      setData(response);
      setDraft(
        Object.fromEntries(
          response.entries.map((entry) => [
            entry.id,
            {
              score: entry.score === null ? '' : String(entry.score),
              is_absent: entry.is_absent,
            },
          ]),
        ),
      );
      setWarnings(response.warnings || []);
      setSuccess(
        action === 'unlock'
          ? 'Qaydnoma ochildi.'
          : action === 'submit'
            ? 'Qaydnoma yakunlandi.'
            : 'Qoralama saqlandi.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Amal bajarilmadi.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="card p-8 lg:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link to="/retake/teacher/groups" className="inline-flex items-center gap-2 text-sm font-bold text-text-secondary hover:text-text-primary">
              <ArrowLeft size={16} />
              Teacher groups ga qaytish
            </Link>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-text-primary lg:text-4xl">
              Exam sheet {data?.sheet.sheet_no ? `#${data.sheet.sheet_no}` : ''}
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-text-secondary">
              Baholarni qoralama saqlash, yakunlash va kerak bo‘lsa qayta ochish shu sahifada bajariladi.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-bold text-text-primary transition-all hover:border-primary/20 hover:bg-primary/5"
            >
              <RefreshCw size={16} />
              Yangilash
            </button>
            {data?.sheet.can_unlock ? (
              <button
                type="button"
                onClick={() => void submit('unlock')}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold text-text-primary disabled:opacity-70"
              >
                <UnlockKeyhole size={16} />
                Unlock
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void submit('save')}
              disabled={isSaving || !data?.sheet.can_edit}
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold text-text-primary disabled:opacity-70"
            >
              <Save size={16} />
              Qoralama saqlash
            </button>
            <button
              type="button"
              onClick={() => void submit('submit')}
              disabled={isSaving || !data?.sheet.can_edit}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-xl shadow-primary/20 disabled:opacity-70"
            >
              <CheckCircle2 size={16} />
              Yakunlash
            </button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="card flex min-h-[240px] items-center justify-center gap-3 p-8 text-text-secondary">
          <LoaderCircle className="animate-spin text-primary" size={20} />
          Exam sheet yuklanmoqda...
        </div>
      ) : error ? (
        <div className="rounded-[28px] border border-danger/20 bg-danger/10 px-6 py-5 text-sm font-medium text-danger">{error}</div>
      ) : data ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summary.map((item) => (
              <div key={item.label} className="card p-6">
                <p className="label-micro">{item.label}</p>
                <p className="mt-3 text-4xl font-black tracking-tight text-text-primary">{item.value}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
            <div className="card overflow-hidden">
              <div className="border-b border-border/60 px-6 py-5 lg:px-8">
                <div className="flex items-center gap-3">
                  <Users className="text-primary" size={18} />
                  <h3 className="text-xl font-black tracking-tight text-text-primary">Talabalar ro‘yxati</h3>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-widest text-text-muted">
                    <tr>
                      <th className="px-4 py-4">Talaba</th>
                      <th className="px-4 py-4">JN</th>
                      <th className="px-4 py-4">ON</th>
                      <th className="px-4 py-4">Completion</th>
                      <th className="px-4 py-4">Ball</th>
                      <th className="px-4 py-4">Kelmagan</th>
                      <th className="px-4 py-4">Natija</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.entries.map((entry) => {
                      const badge = gradeBadge(
                        draft[entry.id]?.score === '' ? null : Number(draft[entry.id]?.score),
                        draft[entry.id]?.is_absent || false,
                      );
                      return (
                        <tr key={entry.id} className="align-top">
                          <td className="px-4 py-4">
                            <p className="font-black text-text-primary">{entry.full_name}</p>
                            <p className="mt-1 text-xs font-bold uppercase tracking-wider text-text-muted">
                              {entry.student_id_number || 'ID yo‘q'} • {entry.group_name || 'Guruh yo‘q'}
                            </p>
                          </td>
                          <td className="px-4 py-4 font-bold text-text-secondary">{entry.cross_scores.jn}</td>
                          <td className="px-4 py-4 font-bold text-text-secondary">{entry.cross_scores.on}</td>
                          <td className="px-4 py-4">
                            <p className="font-bold text-text-primary">
                              {entry.completion.completed}/{entry.completion.total}
                            </p>
                            <p className={`mt-1 text-xs font-bold ${entry.completion.is_finished ? 'text-emerald-700' : 'text-warning'}`}>
                              {entry.completion.is_finished ? 'Tugatgan' : 'Tugatmagan'}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max={data.sheet.max_score}
                              disabled={!data.sheet.can_edit || draft[entry.id]?.is_absent}
                              value={draft[entry.id]?.score || ''}
                              onChange={(event) =>
                                setDraft((current) => ({
                                  ...current,
                                  [entry.id]: {
                                    ...(current[entry.id] || { is_absent: false }),
                                    score: event.target.value,
                                  },
                                }))
                              }
                              className="w-28 rounded-2xl border border-border bg-white px-3 py-2 font-bold text-text-primary outline-none focus:border-primary/30 disabled:bg-slate-100"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <label className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-text-secondary">
                              <input
                                type="checkbox"
                                disabled={!data.sheet.can_edit}
                                checked={draft[entry.id]?.is_absent || false}
                                onChange={(event) =>
                                  setDraft((current) => ({
                                    ...current,
                                    [entry.id]: {
                                      ...(current[entry.id] || { score: '' }),
                                      is_absent: event.target.checked,
                                      score: event.target.checked ? '0' : current[entry.id]?.score || '',
                                    },
                                  }))
                                }
                                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                              />
                              Ha
                            </label>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`status-pill ${badge.cls}`}>{badge.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-6">
              <section className="card p-6">
                <p className="label-micro">Sheet status</p>
                <div className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-text-primary">
                  <Lock size={16} />
                  {data.sheet.status_label}
                </div>
                <div className="mt-5 space-y-3 text-sm font-medium text-text-secondary">
                  <p>Fan: <span className="font-black text-text-primary">{data.group.subject_name}</span></p>
                  <p>Group: <span className="font-black text-text-primary">{data.group.code}</span></p>
                  <p>Cycle: <span className="font-black text-text-primary">{data.group.cycle_name}</span></p>
                  <p>Control: <span className="font-black text-text-primary">{data.schedule.control_type_label}</span></p>
                  <p>Sana: <span className="font-black text-text-primary">{formatDateTime(data.schedule.scheduled_at)}</span></p>
                  <p>Xona: <span className="font-black text-text-primary">{data.schedule.room || 'Belgilanmagan'}</span></p>
                  <p>Max ball: <span className="font-black text-text-primary">{data.sheet.max_score}</span></p>
                </div>
              </section>

              {warnings.length ? (
                <section className="rounded-[28px] border border-warning/20 bg-warning/10 px-6 py-5">
                  <p className="text-sm font-black text-warning">Ogohlantirishlar</p>
                  <div className="mt-3 space-y-2 text-sm font-medium text-text-secondary">
                    {warnings.map((warning, index) => (
                      <p key={`${warning}:${index}`}>{warning}</p>
                    ))}
                  </div>
                </section>
              ) : null}

              {success ? (
                <section className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-6 py-5 text-sm font-bold text-emerald-700">
                  {success}
                </section>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
