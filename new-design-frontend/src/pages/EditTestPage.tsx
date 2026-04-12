import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileQuestion, LoaderCircle, Plus, Rows3, Upload } from 'lucide-react';
import { fetchTeacherTestDetail, updateTeacherTest } from '@/src/api/lms';
import type { TeacherTestDetailResponse } from '@/src/types';

function toLocalInputValue(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditTestPage() {
  const params = useParams();
  const testId = Number(params.testId || 0);
  const [data, setData] = useState<TeacherTestDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    course_id: '',
    section_id: '',
    control_type: 'other',
    is_active: true,
    start_datetime: '',
    end_datetime: '',
    duration_minutes: '30',
    max_score: '100',
    attempts_allowed: '1',
    question_count: '10',
    is_random_order: false,
    proctoring_enabled: false,
    face_id_required: false,
    max_tab_switches: '3',
  });

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchTeacherTestDetail(testId);
        if (!active) return;
        setData(response);
        setForm({
          name: response.test.name,
          description: response.test.description,
          course_id: String(response.test.course_id),
          section_id: response.test.section_id ? String(response.test.section_id) : '',
          control_type: response.test.control_type,
          is_active: response.test.is_active,
          start_datetime: toLocalInputValue(response.test.start_datetime),
          end_datetime: toLocalInputValue(response.test.end_datetime),
          duration_minutes: String(response.test.duration_minutes),
          max_score: String(response.test.max_score),
          attempts_allowed: String(response.test.attempts_allowed),
          question_count: String(response.test.question_count),
          is_random_order: response.test.is_random_order,
          proctoring_enabled: response.test.proctoring_enabled,
          face_id_required: response.test.face_id_required,
          max_tab_switches: String(response.test.max_tab_switches),
        });
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Test yuklanmadi.');
      } finally {
        if (active) setIsLoading(false);
      }
    }
    if (testId) void load();
    return () => {
      active = false;
    };
  }, [testId]);

  const sections = useMemo(() => data?.sections || [], [data]);
  const questionTotal = data?.questions.length || 0;

  async function save(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await updateTeacherTest(testId, {
        ...form,
        course_id: Number(form.course_id),
        section_id: form.section_id ? Number(form.section_id) : null,
        duration_minutes: Number(form.duration_minutes),
        max_score: Number(form.max_score),
        attempts_allowed: Number(form.attempts_allowed),
        question_count: Number(form.question_count),
        max_tab_switches: Number(form.max_tab_switches),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saqlanmadi.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="card flex min-h-[320px] items-center justify-center gap-3 p-8 text-text-secondary">
        <LoaderCircle className="animate-spin text-primary" size={20} />
        Test yuklanmoqda...
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="card p-8">
        <p className="text-lg font-black text-text-primary">Test yuklanmadi</p>
        <p className="mt-3 text-sm font-medium text-rose-500">{error || "Noma'lum xatolik."}</p>
        <Link to="/tests/manage" className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-bold text-text-primary">
          <ArrowLeft size={16} />
          Test management
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="card p-8 lg:p-10">
        <Link to="/tests/manage" className="inline-flex items-center gap-2 text-sm font-bold text-text-secondary hover:text-text-primary">
          <ArrowLeft size={16} />
          Test management
        </Link>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-text-primary">{data.test.name}</h2>
            <p className="mt-3 max-w-3xl text-sm font-medium text-text-secondary">
              Test sozlamalari va savollar bilan ishlash actionlari bir joyda jamlandi. O'qituvchi uchun eng muhim amallar bir qarashda ko'rinadi.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`status-pill ${form.is_active ? 'status-pill-success' : 'status-pill-warning'}`}>{form.is_active ? 'Faol' : 'Qoralama'}</span>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-xs font-black uppercase tracking-[0.15em] text-primary">
              <FileQuestion size={14} />
              {questionTotal} ta savol
            </span>
          </div>
        </div>
      </section>

      <section className="card p-8">
        <h3 className="text-xl font-black text-text-primary">Test sozlamalari</h3>
        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={(e) => void save(e)}>
          <label className="space-y-2 md:col-span-2">
            <span className="label-micro">Nomi</span>
            <input className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none" value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="label-micro">Tavsif</span>
            <textarea className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none" value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} />
          </label>
          <label className="space-y-2">
            <span className="label-micro">Section</span>
            <select className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary" value={form.section_id} onChange={(e) => setForm((c) => ({ ...c, section_id: e.target.value }))}>
              <option value="">(None)</option>
              {sections.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="label-micro">Control type</span>
            <input className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary" value={form.control_type} onChange={(e) => setForm((c) => ({ ...c, control_type: e.target.value }))} />
          </label>
          <label className="space-y-2">
            <span className="label-micro">Start</span>
            <input type="datetime-local" className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary" value={form.start_datetime} onChange={(e) => setForm((c) => ({ ...c, start_datetime: e.target.value }))} />
          </label>
          <label className="space-y-2">
            <span className="label-micro">End</span>
            <input type="datetime-local" className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary" value={form.end_datetime} onChange={(e) => setForm((c) => ({ ...c, end_datetime: e.target.value }))} />
          </label>
          <label className="space-y-2">
            <span className="label-micro">Duration</span>
            <input className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary" value={form.duration_minutes} onChange={(e) => setForm((c) => ({ ...c, duration_minutes: e.target.value }))} />
          </label>
          <label className="space-y-2">
            <span className="label-micro">Max score</span>
            <input className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary" value={form.max_score} onChange={(e) => setForm((c) => ({ ...c, max_score: e.target.value }))} />
          </label>
          <label className="space-y-2">
            <span className="label-micro">Attempts allowed</span>
            <input className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary" value={form.attempts_allowed} onChange={(e) => setForm((c) => ({ ...c, attempts_allowed: e.target.value }))} />
          </label>
          <label className="space-y-2">
            <span className="label-micro">Question count</span>
            <input className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary" value={form.question_count} onChange={(e) => setForm((c) => ({ ...c, question_count: e.target.value }))} />
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-bold text-text-primary">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((c) => ({ ...c, is_active: e.target.checked }))} className="h-5 w-5 accent-primary" />
            Active
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-bold text-text-primary">
            <input type="checkbox" checked={form.is_random_order} onChange={(e) => setForm((c) => ({ ...c, is_random_order: e.target.checked }))} className="h-5 w-5 accent-primary" />
            Random order
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-bold text-text-primary">
            <input type="checkbox" checked={form.proctoring_enabled} onChange={(e) => setForm((c) => ({ ...c, proctoring_enabled: e.target.checked }))} className="h-5 w-5 accent-primary" />
            Proctoring
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-bold text-text-primary">
            <input type="checkbox" checked={form.face_id_required} onChange={(e) => setForm((c) => ({ ...c, face_id_required: e.target.checked }))} className="h-5 w-5 accent-primary" />
            Face ID required
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="label-micro">Max tab switches</span>
            <input className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary" value={form.max_tab_switches} onChange={(e) => setForm((c) => ({ ...c, max_tab_switches: e.target.value }))} />
          </label>
          <button type="submit" disabled={isSaving} className="md:col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white disabled:opacity-70">
            {isSaving ? <LoaderCircle className="animate-spin" size={16} /> : null}
            Saqlash
          </button>
        </form>
      </section>

      <section className="card overflow-hidden p-0">
        <div className="bg-gradient-to-r from-indigo-600 via-primary to-sky-600 px-8 py-7 text-white">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">Savollar bilan ishlash</p>
              <h3 className="mt-2 text-2xl font-black">Savollar workspace</h3>
              <p className="mt-2 max-w-2xl text-sm font-semibold text-white/80">
                Mavjud savollar ro'yxatini oching, bulk import qiling yoki qo'lda yangi savol qo'shing. Barcha kontent actionlari SPA ichida ishlaydi.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link to={`/tests/${testId}/questions`} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-primary shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5">
                <Rows3 size={16} />
                Savollar
              </Link>
              <Link to={`/tests/${testId}/questions?mode=bulk#bulk-import`} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition-all hover:bg-white/15">
                <Upload size={16} />
                Savollarni yuklash
              </Link>
              <Link to={`/tests/${testId}/questions?mode=manual#manual-question`} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-transparent px-5 py-3 text-sm font-black text-white transition-all hover:bg-white/10">
                <Plus size={16} />
                Savol qo'shish
              </Link>
            </div>
          </div>
        </div>
        <div className="grid gap-4 px-8 py-7 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-slate-50 px-5 py-4">
            <p className="label-micro">Jami savollar</p>
            <p className="mt-2 text-2xl font-black text-text-primary">{questionTotal}</p>
          </div>
          <div className="rounded-2xl border border-border bg-slate-50 px-5 py-4">
            <p className="label-micro">Boshqaruv turi</p>
            <p className="mt-2 inline-flex items-center gap-2 text-sm font-black text-text-primary">
              <Rows3 size={16} className="text-primary" />
              Savollar + import oqimi
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-slate-50 px-5 py-4">
            <p className="label-micro">Tavsiya</p>
            <p className="mt-2 inline-flex items-center gap-2 text-sm font-black text-text-primary">
              <FileQuestion size={16} className="text-primary" />
              Avval savollarni tayyorlab, keyin testni faollashtiring
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
