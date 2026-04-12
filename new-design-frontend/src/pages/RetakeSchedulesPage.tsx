import { useEffect, useState } from 'react';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import {
  createRetakeAssessment,
  createRetakeClassSchedule,
  deleteRetakeAssessment,
  deleteRetakeClassSchedule,
  fetchRetakeSchedules,
} from '@/src/api/retake';
import type { RetakeScheduleGroupItem, RetakeSchedulesResponse } from '@/src/types';

const DAYS = [
  { value: 1, label: 'Dushanba' },
  { value: 2, label: 'Seshanba' },
  { value: 3, label: 'Chorshanba' },
  { value: 4, label: 'Payshanba' },
  { value: 5, label: 'Juma' },
  { value: 6, label: 'Shanba' },
  { value: 7, label: 'Yakshanba' },
];

export default function RetakeSchedulesPage() {
  const [data, setData] = useState<RetakeSchedulesResponse | null>(null);
  const [selected, setSelected] = useState<RetakeScheduleGroupItem | null>(null);
  const [classForm, setClassForm] = useState({ day_of_week: 1, start_time: '08:00', end_time: '09:20', room: '', start_date: '', end_date: '' });
  const [assessmentForm, setAssessmentForm] = useState({ control_type: 'final', scheduled_at: '', pair_number: 1, room: '', teacher_id: 0 });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchRetakeSchedules();
      setData(response);
      if (!selected && response.groups[0]) {
        setSelected(response.groups[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Schedules yuklanmadi.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addClassSchedule() {
    if (!selected) return;
    setError(null);
    setSuccess(null);
    try {
      await createRetakeClassSchedule(selected.id, classForm);
      await load();
      setSuccess('Dars jadvali qo‘shildi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dars jadvali saqlanmadi.');
    }
  }

  async function addAssessment() {
    if (!selected) return;
    setError(null);
    setSuccess(null);
    try {
      await createRetakeAssessment(selected.id, {
        control_type: assessmentForm.control_type,
        scheduled_at: assessmentForm.scheduled_at,
        pair_number: assessmentForm.pair_number,
        room: assessmentForm.room,
        teacher_id: assessmentForm.teacher_id || null,
      });
      await load();
      setSuccess('Assessment qo‘shildi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assessment saqlanmadi.');
    }
  }

  async function removeClassSchedule(scheduleId: number) {
    setError(null);
    setSuccess(null);
    try {
      await deleteRetakeClassSchedule(scheduleId);
      await load();
      setSuccess('Dars jadvali o‘chirildi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dars jadvali o‘chirilmadi.');
    }
  }

  async function removeAssessment(assessmentId: number) {
    setError(null);
    setSuccess(null);
    try {
      await deleteRetakeAssessment(assessmentId);
      await load();
      setSuccess('Assessment o‘chirildi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assessment o‘chirilmadi.');
    }
  }

  return (
    <div className="space-y-8">
      <section className="card p-8 lg:p-10">
        <div className="flex items-center gap-3">
          <CalendarClock size={20} className="text-primary" />
          <h2 className="text-3xl font-black tracking-tight text-text-primary">Retake schedules</h2>
        </div>
        <p className="mt-3 max-w-3xl text-sm font-medium text-text-secondary">
          Guruhlar bo‘yicha dars jadvali va assessment schedule’larni SPA ichida boshqarish.
        </p>
        {error ? <p className="mt-4 rounded-2xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger">{error}</p> : null}
        {success ? <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{success}</p> : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)]">
        <div className="card overflow-hidden">
          <div className="border-b border-border/60 px-6 py-5">
            <h3 className="text-xl font-black tracking-tight text-text-primary">Guruhlar</h3>
          </div>
          {isLoading ? (
            <div className="px-6 py-16 text-sm font-bold text-text-secondary">Yuklanmoqda...</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data?.groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setSelected(group)}
                  className={`grid w-full gap-4 px-6 py-5 text-left transition-all hover:bg-slate-50 lg:grid-cols-[minmax(0,1.2fr)_1fr_auto] ${selected?.id === group.id ? 'bg-primary/5' : ''}`}
                >
                  <div>
                    <p className="text-base font-black tracking-tight text-text-primary">{group.subject.name}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wider text-text-muted">{group.code}</p>
                  </div>
                  <div className="text-sm font-bold text-text-secondary">
                    <p>{group.class_schedules.length} class</p>
                    <p className="mt-1">{group.assessments.length} assessment</p>
                  </div>
                  <div className="text-right">
                    <span className="status-pill status-pill-primary">{group.status_label}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected ? (
          <div className="space-y-6">
            <div className="card p-6">
              <h3 className="text-lg font-black text-text-primary">Tanlangan guruh</h3>
              <p className="mt-2 text-sm font-medium text-text-secondary">{selected.subject.name} • {selected.code}</p>

              <div className="mt-6 space-y-4">
                <p className="label-micro">Class schedule qo‘shish</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <select value={classForm.day_of_week} onChange={(e) => setClassForm((c) => ({ ...c, day_of_week: Number(e.target.value) }))} className="input">
                    {DAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
                  </select>
                  <input type="text" value={classForm.room} onChange={(e) => setClassForm((c) => ({ ...c, room: e.target.value }))} className="input" placeholder="Xona" />
                  <input type="time" value={classForm.start_time} onChange={(e) => setClassForm((c) => ({ ...c, start_time: e.target.value }))} className="input" />
                  <input type="time" value={classForm.end_time} onChange={(e) => setClassForm((c) => ({ ...c, end_time: e.target.value }))} className="input" />
                  <input type="date" value={classForm.start_date} onChange={(e) => setClassForm((c) => ({ ...c, start_date: e.target.value }))} className="input" />
                  <input type="date" value={classForm.end_date} onChange={(e) => setClassForm((c) => ({ ...c, end_date: e.target.value }))} className="input" />
                </div>
                <button type="button" onClick={() => void addClassSchedule()} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white">
                  <Plus size={16} />
                  Class schedule qo‘shish
                </button>
              </div>

              <div className="mt-8 space-y-4">
                <p className="label-micro">Assessment qo‘shish</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <select value={assessmentForm.control_type} onChange={(e) => setAssessmentForm((c) => ({ ...c, control_type: e.target.value }))} className="input">
                    {data?.control_types.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                  <input type="number" value={assessmentForm.pair_number} onChange={(e) => setAssessmentForm((c) => ({ ...c, pair_number: Number(e.target.value) }))} className="input" placeholder="Pair" />
                  <input type="datetime-local" value={assessmentForm.scheduled_at} onChange={(e) => setAssessmentForm((c) => ({ ...c, scheduled_at: e.target.value }))} className="input" />
                  <input type="text" value={assessmentForm.room} onChange={(e) => setAssessmentForm((c) => ({ ...c, room: e.target.value }))} className="input" placeholder="Xona" />
                  <select value={assessmentForm.teacher_id} onChange={(e) => setAssessmentForm((c) => ({ ...c, teacher_id: Number(e.target.value) }))} className="input md:col-span-2">
                    <option value={0}>Teacher tanlanmagan</option>
                    {data?.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}
                  </select>
                </div>
                <button type="button" onClick={() => void addAssessment()} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white">
                  <Plus size={16} />
                  Assessment qo‘shish
                </button>
              </div>
            </div>

            <div className="card p-6">
              <p className="label-micro">Class schedules</p>
              <div className="mt-4 space-y-3">
                {selected.class_schedules.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3">
                    <div className="text-sm">
                      <p className="font-bold text-text-primary">{DAYS.find((day) => day.value === item.day_of_week)?.label || item.day_of_week} • {item.start_time} - {item.end_time}</p>
                      <p className="text-text-secondary">{item.room} • {item.start_date} - {item.end_date}</p>
                    </div>
                    <button type="button" onClick={() => void removeClassSchedule(item.id)} className="rounded-2xl bg-danger px-3 py-2 text-xs font-bold text-white">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <p className="label-micro">Assessments</p>
              <div className="mt-4 space-y-3">
                {selected.assessments.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3">
                    <div className="text-sm">
                      <p className="font-bold text-text-primary">{item.control_type_label} • {item.scheduled_at || 'Belgilanmagan'}</p>
                      <p className="text-text-secondary">{item.room} • {item.teacher_name || 'Teacher yo‘q'} • {item.pair_label || '-'}</p>
                    </div>
                    <button type="button" onClick={() => void removeAssessment(item.id)} className="rounded-2xl bg-danger px-3 py-2 text-xs font-bold text-white">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
