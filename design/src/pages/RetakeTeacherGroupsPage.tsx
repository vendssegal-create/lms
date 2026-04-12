import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FileSpreadsheet, Filter, GraduationCap, LoaderCircle, RefreshCw, Search, Users, UserPlus } from 'lucide-react';
import { fetchRetakeTeacherGroups } from '@/src/api/retake';
import { useAuth } from '@/src/features/auth/auth-context';
import { cn } from '@/src/lib/utils';
import type { RetakeTeacherGroupItem, RetakeTeacherGroupsResponse } from '@/src/types';
import EnrollmentModal from '@/src/components/retake/EnrollmentModal';

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Belgilanmagan';
  }

  return new Intl.DateTimeFormat('uz-UZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function summaryCards(summary: RetakeTeacherGroupsResponse['summary']) {
  return [
    { label: 'Jami assessment', value: summary.total, tone: 'bg-primary/10 text-primary' },
    { label: 'Ochiq qaydnoma', value: summary.open_sheets, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Yopiq qaydnoma', value: summary.locked_sheets, tone: 'bg-slate-100 text-slate-700' },
    { label: 'Faol guruh', value: summary.active_groups, tone: 'bg-warning/10 text-warning' },
  ];
}

function sheetStatusTone(status: string) {
  if (status === 'locked') return 'status-pill-success';
  if (status === 'open') return 'status-pill-warning';
  if (status === 'submitted') return 'status-pill-primary';
  return 'status-pill-danger';
}

export default function RetakeTeacherGroupsPage() {
  const { session } = useAuth();
  const [data, setData] = useState<RetakeTeacherGroupsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [controlType, setControlType] = useState('');
  const [groupStatus, setGroupStatus] = useState('');
  const [enrollmentModal, setEnrollmentModal] = useState<{
    groupId: number;
    groupCode: string;
    subjectName: string;
  } | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (controlType) params.set('control_type', controlType);
    if (groupStatus) params.set('group_status', groupStatus);
    return params.toString();
  }, [search, controlType, groupStatus]);

  async function loadTeacherGroups(query = queryString) {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchRetakeTeacherGroups(query);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Teacher groups yuklanmadi.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTeacherGroups('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cards = data ? summaryCards(data.summary) : [];

  return (
    <div className="space-y-8">
      <section className="card p-8 lg:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary">
              <GraduationCap size={12} />
              Retake teacher groups
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-text-primary lg:text-4xl">O&apos;qituvchi guruhlari</h2>
            <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-text-secondary">
              Retake assessment guruhlari, qaydnoma holati va baholashga o&apos;tish nuqtalari endi SPA ichida ko&apos;rsatiladi.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadTeacherGroups()}
              className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-bold text-text-primary transition-all hover:border-primary/20 hover:bg-primary/5"
            >
              <RefreshCw size={16} />
              Yangilash
            </button>
          </div>
        </div>
      </section>

      {data ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="card p-6">
              <div className={cn('inline-flex rounded-2xl px-3 py-2 text-xs font-black', card.tone)}>{card.label}</div>
              <p className="mt-5 text-4xl font-black tracking-tight text-text-primary">{card.value}</p>
            </div>
          ))}
        </section>
      ) : null}

      <section className="card p-6 lg:p-8">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2">
            <span className="label-micro">Qidiruv</span>
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="input pl-11" placeholder="Fan, kod, cycle, group" />
            </div>
          </label>
          <label className="space-y-2">
            <span className="label-micro">Control type</span>
            <select value={controlType} onChange={(event) => setControlType(event.target.value)} className="input">
              <option value="">Barchasi</option>
              {data?.filters.control_types.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="label-micro">Group status</span>
            <select value={groupStatus} onChange={(event) => setGroupStatus(event.target.value)} className="input">
              <option value="">Barchasi</option>
              {data?.filters.group_statuses.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => void loadTeacherGroups()}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-xl shadow-primary/20"
          >
            <Filter size={16} />
            Filtrni qo&apos;llash
          </button>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setControlType('');
              setGroupStatus('');
              void loadTeacherGroups('');
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

      <section className="grid gap-6 xl:grid-cols-2">
        {isLoading ? (
          <div className="card col-span-full flex min-h-[240px] items-center justify-center gap-3 p-8 text-text-secondary">
            <LoaderCircle className="animate-spin text-primary" size={20} />
            Teacher groups yuklanmoqda...
          </div>
        ) : data?.items.length ? (
          data.items.map((item: RetakeTeacherGroupItem) => (
            <article key={item.id} className="card p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-2xl font-black tracking-tight text-text-primary">{item.group.subject_name}</p>
                  <p className="mt-2 text-sm font-medium text-text-secondary">
                    {item.group.code} • {item.group.subject_code || 'Kodsiz'} • {item.group.cycle_name}
                  </p>
                </div>
                <span className={cn('status-pill', sheetStatusTone(item.sheet?.status || item.status))}>
                  {item.sheet?.status_label || item.status_label}
                </span>
              </div>

              <div className="mt-6 grid gap-3 text-sm font-semibold text-text-secondary md:grid-cols-2">
                <span className="inline-flex items-center gap-2"><BookOpen size={15} className="text-primary" /> {item.control_type_label}</span>
                <span>{formatDateTime(item.scheduled_at)}</span>
                <span>Xona: {item.room || 'Belgilanmagan'}</span>
                <span>Juftlik: {item.pair_label || '-'}</span>
                <span className="inline-flex items-center gap-2"><Users size={15} className="text-primary" /> {item.group.members_count} talaba</span>
                <span>Sig&apos;im: {item.group.capacity || '-'}</span>
              </div>

              <div className="mt-6 rounded-[24px] bg-slate-50 p-5">
                <p className="label-micro">Qaydnoma</p>
                {item.sheet ? (
                  <>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm font-bold text-text-primary">
                      <span>#{item.sheet.sheet_no}</span>
                      <span>Kiritilgan: {item.sheet.entered_count}/{item.sheet.total_count}</span>
                      <span>Kelmadi: {item.sheet.absent_count}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        to={`/retake/exam-sheets/${item.sheet.id}`}
                        className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white"
                      >
                        <FileSpreadsheet size={16} />
                        Qaydnoma ochish
                      </Link>
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm font-medium text-text-secondary">Bu assessment uchun qaydnoma hali ochilmagan.</p>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-bold uppercase tracking-wider text-text-muted">
                <span>Teacher: {item.teacher.full_name || 'Biriktirilmagan'}</span>
                <span>Group: {item.group.status_label}</span>
                {item.group.lms_course_title ? <span>LMS: {item.group.lms_course_title}</span> : null}
                <button
                  type="button"
                  onClick={() => setEnrollmentModal({
                    groupId: item.group.id,
                    groupCode: item.group.code,
                    subjectName: item.group.subject_name,
                  })}
                  className="ml-auto inline-flex items-center gap-2 rounded-2xl border border-primary px-4 py-2 text-xs font-bold normal-case tracking-normal text-primary hover:bg-primary/5"
                >
                  <UserPlus size={14} />
                  {item.group.lms_course_title ? 'LMS biriktirish' : 'LMS kurs yaratish'}
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="card col-span-full p-8">
            <p className="text-lg font-black text-text-primary">Assessment topilmadi</p>
            <p className="mt-3 text-sm font-medium text-text-secondary">Hozircha ko&apos;rsatish uchun teacher group yo&apos;q.</p>
          </div>
        )}
      </section>

      {enrollmentModal && (
        <EnrollmentModal
          groupId={enrollmentModal.groupId}
          groupCode={enrollmentModal.groupCode}
          subjectName={enrollmentModal.subjectName}
          onClose={() => setEnrollmentModal(null)}
          onSuccess={() => { setEnrollmentModal(null); void loadTeacherGroups(); }}
        />
      )}
    </div>
  );
}
