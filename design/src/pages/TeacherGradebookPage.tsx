import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, LoaderCircle, Save, Upload } from 'lucide-react';
import { fetchTeacherGradebook, importTeacherGradebookTest, saveTeacherGradebook, setupTeacherGradebook } from '@/src/api/lms';

export default function TeacherGradebookPage() {
  const params = useParams();
  const courseId = Number(params.courseId || 0);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchTeacherGradebook>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTestId, setSelectedTestId] = useState('');
  const [setup, setSetup] = useState({ current_max: 30, midterm_max: 30, final_max: 40 });

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchTeacherGradebook(courseId);
        if (!active) return;
        setData(response);
        setSetup({
          current_max: response.gradebook.current_max,
          midterm_max: response.gradebook.midterm_max,
          final_max: response.gradebook.final_max,
        });
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Gradebook yuklanmadi.');
      } finally {
        if (active) setIsLoading(false);
      }
    }
    if (courseId) void load();
    return () => { active = false; };
  }, [courseId]);

  const items = useMemo(() => (data?.students || []).map((s) => ({
    student_id: s.student_id,
    current: s.current,
    midterm: s.midterm,
    final: s.final,
  })), [data]);

  const [draft, setDraft] = useState(items);

  useEffect(() => {
    setDraft(items);
  }, [items]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!data) return;
    setIsSaving(true);
    setError(null);
    try {
      await saveTeacherGradebook(courseId, { items: draft });
      const refreshed = await fetchTeacherGradebook(courseId);
      setData(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saqlanmadi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function saveSetup() {
    if (!data) return;
    setIsSaving(true);
    setError(null);
    try {
      await setupTeacherGradebook(courseId, setup);
      const refreshed = await fetchTeacherGradebook(courseId);
      setData(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sozlamalar saqlanmadi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function importTest() {
    if (!selectedTestId) return;
    setIsSaving(true);
    setError(null);
    try {
      await importTeacherGradebookTest(courseId, Number(selectedTestId));
      const refreshed = await fetchTeacherGradebook(courseId);
      setData(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import bo‘lmadi.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="card flex min-h-[320px] items-center justify-center gap-3 p-8 text-text-secondary">
        <LoaderCircle className="animate-spin text-primary" size={20} />
        Gradebook yuklanmoqda...
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="card p-8">
        <p className="text-lg font-black text-text-primary">Gradebook yuklanmadi</p>
        <p className="mt-3 text-sm font-medium text-rose-500">{error || 'Nomaʼlum xatolik.'}</p>
        <Link to={`/courses/${courseId}`} className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-bold text-text-primary">
          <ArrowLeft size={16} />
          Kursga qaytish
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="card p-8 lg:p-10">
        <Link to={data.course.spa_path} className="inline-flex items-center gap-2 text-sm font-bold text-text-secondary hover:text-text-primary">
          <ArrowLeft size={16} />
          Kurs
        </Link>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-text-primary">Gradebook: {data.course.title}</h2>
        {data.gradebook.is_locked ? (
          <p className="mt-3 text-sm font-semibold text-rose-500">Qaydnoma yopilgan (locked). O‘zgartirib bo‘lmaydi.</p>
        ) : null}
      </section>

      <section className="card p-8">
        <h3 className="text-xl font-black text-text-primary">Sozlamalar</h3>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <input value={setup.current_max} onChange={(e) => setSetup((c) => ({ ...c, current_max: Number(e.target.value) }))} className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary" />
          <input value={setup.midterm_max} onChange={(e) => setSetup((c) => ({ ...c, midterm_max: Number(e.target.value) }))} className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary" />
          <input value={setup.final_max} onChange={(e) => setSetup((c) => ({ ...c, final_max: Number(e.target.value) }))} className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary" />
        </div>
        <button type="button" disabled={isSaving} onClick={() => void saveSetup()} className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold text-text-primary disabled:opacity-70">
          <Save size={16} />
          Sozlamani saqlash
        </button>
      </section>

      <section className="card p-8">
        <h3 className="text-xl font-black text-text-primary">Test import</h3>
        <div className="mt-6 flex flex-col gap-3 md:flex-row">
          <select value={selectedTestId} onChange={(e) => setSelectedTestId(e.target.value)} className="flex-1 rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary">
            <option value="">Test tanlang</option>
            {data.tests.map((t) => (
              <option key={t.id} value={String(t.id)}>{t.name} ({t.control_type})</option>
            ))}
          </select>
          <button type="button" disabled={isSaving || !selectedTestId} onClick={() => void importTest()} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white disabled:opacity-70">
            <Upload size={16} />
            Import
          </button>
        </div>
      </section>

      <section className="card p-8">
        <h3 className="text-xl font-black text-text-primary">Baholar</h3>
        <form className="mt-6 space-y-3" onSubmit={(e) => void save(e)}>
          <div className="grid gap-3">
            {data.students.map((s, idx) => (
              <div key={s.student_id} className="grid gap-3 rounded-[24px] border border-border bg-slate-50 p-5 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
                <div>
                  <p className="text-sm font-black text-text-primary">{s.student_name}</p>
                  <p className="mt-1 text-xs font-semibold text-text-secondary">{s.student_id_number}</p>
                </div>
                {(['current', 'midterm', 'final'] as const).map((key) => (
                  <input
                    key={key}
                    value={(draft[idx] as any)?.[key] ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : Number(e.target.value);
                      setDraft((cur) => cur.map((row, ridx) => ridx === idx ? ({ ...row, [key]: val }) : row));
                    }}
                    disabled={data.gradebook.is_locked}
                    className="rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-text-primary disabled:opacity-60"
                    placeholder={key}
                  />
                ))}
                <div className="flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold text-text-primary">
                  <span>Total</span>
                  <span>{s.total ?? '-'}</span>
                </div>
              </div>
            ))}
          </div>
          <button type="submit" disabled={isSaving || data.gradebook.is_locked} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-70">
            <Save size={16} />
            Saqlash
          </button>
        </form>
      </section>
    </div>
  );
}

