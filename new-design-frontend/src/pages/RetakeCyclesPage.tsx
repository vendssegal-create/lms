import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, LoaderCircle, Pencil, Plus, Save } from 'lucide-react';
import { createRetakeCycle, fetchRetakeCycles, updateRetakeCycle } from '@/src/api/retake';
import type { RetakeCycleManageItem, RetakeCyclesResponse } from '@/src/types';

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'medium' }).format(new Date(value));
}

type CycleFormState = {
  name: string;
  academic_year: string;
  starts_at: string;
  ends_at: string;
  max_allowed_credits: string;
  status: string;
};

const EMPTY_FORM: CycleFormState = {
  name: '',
  academic_year: '',
  starts_at: '',
  ends_at: '',
  max_allowed_credits: '15.00',
  status: 'draft',
};

export default function RetakeCyclesPage() {
  const [data, setData] = useState<RetakeCyclesResponse | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<CycleFormState>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchRetakeCycles();
      setData(response);
      if (!selectedId && response.items[0]) {
        selectCycle(response.items[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cycle ro‘yxati yuklanmadi.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCycle = useMemo(
    () => data?.items.find((item) => item.id === selectedId) || null,
    [data, selectedId],
  );

  function selectCycle(cycle: RetakeCycleManageItem) {
    setSelectedId(cycle.id);
    setForm({
      name: cycle.name,
      academic_year: cycle.academic_year,
      starts_at: cycle.starts_at || '',
      ends_at: cycle.ends_at || '',
      max_allowed_credits: String(cycle.max_allowed_credits ?? '15.00'),
      status: cycle.status,
    });
    setError(null);
    setSuccess(null);
  }

  function resetForCreate() {
    setSelectedId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setSuccess(null);
  }

  async function save() {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        ...form,
      };
      if (selectedId) {
        const response = await updateRetakeCycle(selectedId, payload);
        setSuccess('Cycle yangilandi.');
        setData((current) =>
          current
            ? {
                ...current,
                items: current.items.map((item) => (item.id === response.cycle.id ? response.cycle : item)),
              }
            : current,
        );
        selectCycle(response.cycle);
      } else {
        const response = await createRetakeCycle(payload);
        setSuccess('Cycle yaratildi.');
        setData((current) =>
          current
            ? {
                ...current,
                items: [response.cycle, ...current.items],
              }
            : current,
        );
        selectCycle(response.cycle);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cycle saqlanmadi.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="card p-8 lg:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary">
              <CalendarRange size={12} />
              Retake cycles
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-text-primary lg:text-4xl">Retake davrlari</h2>
            <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-text-secondary">
              Retake sikllari, ularning statusi va limitlari endi SPA ichida boshqariladi.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={resetForCreate}
              className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-bold text-text-primary"
            >
              <Plus size={16} />
              Yangi cycle
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={isSaving || !data?.permissions.can_manage}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-xl shadow-primary/20 disabled:opacity-70"
            >
              <Save size={16} />
              {isSaving ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </div>
        {error ? <p className="mt-4 rounded-2xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger">{error}</p> : null}
        {success ? <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{success}</p> : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <div className="card overflow-hidden">
          <div className="border-b border-border/60 px-6 py-5 lg:px-8">
            <div className="flex items-center gap-3">
              <CalendarRange className="text-primary" size={18} />
              <h3 className="text-xl font-black tracking-tight text-text-primary">Cycle ro‘yxati</h3>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-3 px-6 py-16 text-sm font-bold text-text-secondary">
              <LoaderCircle size={18} className="animate-spin" />
              Yuklanmoqda
            </div>
          ) : data?.items.length ? (
            <div className="divide-y divide-slate-100">
              {data.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectCycle(item)}
                  className={`grid w-full gap-4 px-6 py-5 text-left transition-all hover:bg-slate-50 lg:grid-cols-[minmax(0,1.3fr)_1fr_1fr_auto] ${selectedId === item.id ? 'bg-primary/5' : ''}`}
                >
                  <div>
                    <p className="text-base font-black tracking-tight text-text-primary">{item.name}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wider text-text-muted">{item.academic_year}</p>
                  </div>
                  <div>
                    <p className="label-micro">Muddat</p>
                    <p className="mt-2 text-sm font-bold text-text-primary">{formatDate(item.starts_at)}</p>
                    <p className="mt-1 text-xs font-medium text-text-secondary">{formatDate(item.ends_at)}</p>
                  </div>
                  <div>
                    <p className="label-micro">Hajm</p>
                    <p className="mt-2 text-sm font-bold text-text-primary">{item.max_allowed_credits} kredit</p>
                    <p className="mt-1 text-xs font-medium text-text-secondary">{item.applications_count} ariza • {item.groups_count} group</p>
                  </div>
                  <div className="text-right">
                    <span className="status-pill status-pill-primary">{item.status_label}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-6 py-16 text-center text-sm font-medium text-text-secondary">Cycle topilmadi.</div>
          )}
        </div>

        <div className="card p-6 lg:p-8">
          <div className="flex items-center gap-3">
            <Pencil size={18} className="text-primary" />
            <h3 className="text-xl font-black tracking-tight text-text-primary">
              {selectedCycle ? 'Cycle tahrirlash' : 'Yangi cycle yaratish'}
            </h3>
          </div>

          <div className="mt-6 space-y-4">
            <label className="space-y-2">
              <span className="label-micro">Nomi</span>
              <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="input" />
            </label>
            <label className="space-y-2">
              <span className="label-micro">Akademik yil</span>
              <input value={form.academic_year} onChange={(event) => setForm((current) => ({ ...current, academic_year: event.target.value }))} className="input" />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="label-micro">Boshlanish sanasi</span>
                <input type="date" value={form.starts_at} onChange={(event) => setForm((current) => ({ ...current, starts_at: event.target.value }))} className="input" />
              </label>
              <label className="space-y-2">
                <span className="label-micro">Tugash sanasi</span>
                <input type="date" value={form.ends_at} onChange={(event) => setForm((current) => ({ ...current, ends_at: event.target.value }))} className="input" />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="label-micro">Max kredit</span>
                <input value={form.max_allowed_credits} onChange={(event) => setForm((current) => ({ ...current, max_allowed_credits: event.target.value }))} className="input" />
              </label>
              <label className="space-y-2">
                <span className="label-micro">Status</span>
                <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="input">
                  {data?.statuses.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
