import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { fetchRetakeExamCalendar, saveRetakeExamCalendar } from '@/src/api/retake';
import type { RetakeExamCalendarResponse } from '@/src/types';

export default function RetakeExamCalendarPage() {
  const [data, setData] = useState<RetakeExamCalendarResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<number>(0);
  const [controlType, setControlType] = useState<string>('final');
  const [pairNumber, setPairNumber] = useState<number>(1);
  const [room, setRoom] = useState<string>('');
  const [teacherId, setTeacherId] = useState<number>(0);

  const query = useMemo(() => {
    if (!data) return '';
    const params = new URLSearchParams();
    params.set('year', String(data.year));
    params.set('month', String(data.month));
    if (data.selected_group_id) {
      params.set('group_id', String(data.selected_group_id));
    }
    return params.toString();
  }, [data]);

  async function load(params = '') {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchRetakeExamCalendar(params);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Exam calendar yuklanmadi.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load('');
  }, []);

  async function goMonth(offset: number) {
    if (!data) return;
    const nextMonth = data.month + offset;
    const year = nextMonth < 1 ? data.year - 1 : nextMonth > 12 ? data.year + 1 : data.year;
    const month = nextMonth < 1 ? 12 : nextMonth > 12 ? 1 : nextMonth;
    const params = new URLSearchParams();
    params.set('year', String(year));
    params.set('month', String(month));
    if (data.selected_group_id) params.set('group_id', String(data.selected_group_id));
    await load(params.toString());
  }

  async function filterByGroup(groupId: number) {
    if (!data) return;
    const params = new URLSearchParams();
    params.set('year', String(data.year));
    params.set('month', String(data.month));
    if (groupId) params.set('group_id', String(groupId));
    await load(params.toString());
  }

  async function createAssessment() {
    if (!selectedDate || !selectedGroup || !controlType) {
      setError('Sana, guruh va nazorat turi kiritilishi shart.');
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await saveRetakeExamCalendar({
        action: 'create',
        group_id: selectedGroup,
        control_type: controlType,
        teacher_id: teacherId || null,
        pair_number: pairNumber,
        room,
        exam_date: selectedDate,
      });
      setSuccess("Nazorat jadvali qo'shildi.");
      await load(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nazorat jadvali saqlanmadi.');
    }
  }

  async function deleteAssessment(assessmentId: number) {
    setError(null);
    setSuccess(null);
    try {
      await saveRetakeExamCalendar({ action: 'delete', assessment_id: assessmentId });
      setSuccess("Nazorat jadvali o'chirildi.");
      await load(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nazorat jadvali o'chirilmadi.");
    }
  }

  return (
    <div className="space-y-8">
      <section className="card p-8 lg:p-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary">
              <CalendarDays size={12} />
              Exam calendar
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-text-primary">Imtihon kalendari</h2>
            <p className="mt-3 max-w-3xl text-sm font-medium text-text-secondary">
              Retake assessmentlarini oy bo'yicha ko'rish va tez jadval qo'shish.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => void goMonth(-1)} className="rounded-2xl border border-border p-3 text-text-secondary">
              <ChevronLeft size={18} />
            </button>
            <div className="min-w-[160px] text-center text-sm font-black text-text-primary">
              {data?.month_name} {data?.year}
            </div>
            <button type="button" onClick={() => void goMonth(1)} className="rounded-2xl border border-border p-3 text-text-secondary">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        {error ? <p className="mt-4 rounded-2xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger">{error}</p> : null}
        {success ? <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{success}</p> : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.8fr)]">
        <div className="card p-6 lg:p-8">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black text-text-primary">Kalendar</h3>
            <select
              value={data?.selected_group_id || 0}
              onChange={(event) => void filterByGroup(Number(event.target.value))}
              className="input max-w-xs"
            >
              <option value={0}>Barcha guruhlar</option>
              {data?.groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.code} - {group.subject_name}
                </option>
              ))}
            </select>
          </div>
          {isLoading ? (
            <div className="mt-6 text-sm font-bold text-text-secondary">Yuklanmoqda...</div>
          ) : (
            <div className="mt-6 grid grid-cols-7 gap-2 text-xs font-bold text-text-secondary">
              {['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'].map((day) => (
                <div key={day} className="text-center">{day}</div>
              ))}
              {data?.month_days.map((week, wi) => (
                <div key={`week-${wi}`} className="col-span-7 grid grid-cols-7 gap-2">
                  {week.map((day, di) => (
                    <div
                      key={`day-${wi}-${di}`}
                      className="min-h-[120px] rounded-2xl border border-border bg-white p-2"
                      onClick={() =>
                        day > 0 && setSelectedDate(`${data?.year}-${String(data?.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
                      }
                      role="button"
                      tabIndex={0}
                    >
                      <div className="text-right text-xs font-black text-text-muted">{day || ''}</div>
                      <div className="mt-2 space-y-1">
                        {(data?.day_assessments[String(day)] || []).map((item) => (
                          <div key={item.id} className="rounded-xl bg-slate-50 p-2 text-[10px] font-semibold text-text-secondary">
                            <div className="font-black text-text-primary">{item.group_code}</div>
                            <div>{item.control_type_label}</div>
                            <div>{item.pair_label || ''} {item.room}</div>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void deleteAssessment(item.id);
                              }}
                              className="mt-1 inline-flex items-center gap-1 text-danger"
                            >
                              <Trash2 size={12} />
                              O'chirish
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6 lg:p-8">
          <h3 className="text-lg font-black text-text-primary">Assessment qo'shish</h3>
          <div className="mt-4 space-y-3">
            <input value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} type="date" className="input" />
            <select value={selectedGroup} onChange={(e) => setSelectedGroup(Number(e.target.value))} className="input">
              <option value={0}>Guruh tanlang</option>
              {data?.groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.code} - {group.subject_name}
                </option>
              ))}
            </select>
            <select value={controlType} onChange={(e) => setControlType(e.target.value)} className="input">
              {data?.control_types.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <select value={pairNumber} onChange={(e) => setPairNumber(Number(e.target.value))} className="input">
              {Object.keys(data?.pair_times || {}).map((key) => (
                <option key={key} value={Number(key)}>Pair {key} ({data?.pair_times[key]})</option>
              ))}
            </select>
            <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Xona" className="input" />
            <select value={teacherId} onChange={(e) => setTeacherId(Number(e.target.value))} className="input">
              <option value={0}>Teacher tanlanmagan</option>
              {data?.teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>
              ))}
            </select>
            <button type="button" onClick={() => void createAssessment()} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white">
              <Plus size={16} />
              Qo'shish
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
