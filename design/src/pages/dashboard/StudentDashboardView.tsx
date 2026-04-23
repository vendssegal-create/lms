import { ArrowUpRight, BookOpen, CalendarClock, GraduationCap, ListChecks } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DashboardCourseItem, DashboardResponse } from '@/src/types';
import { EmptyState } from '@/src/components/ui/empty-state';

function formatDate(value: string | null) {
  if (!value) return 'Belgilanmagan';
  return new Intl.DateTimeFormat('uz-UZ', {
    dateStyle: 'medium',
    timeStyle: value.includes('T') ? 'short' : undefined,
  }).format(new Date(value));
}

function clampPct(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ProgressRing({ value, label }: { value: number; label: string }) {
  const pct = clampPct(value);
  return (
    <div className="card p-8">
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="label-micro">Umumiy progress</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-text-primary">{pct}%</p>
          <p className="mt-2 text-sm font-medium text-text-secondary">{label}</p>
        </div>
        <div className="relative h-20 w-20 shrink-0">
          <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90 text-primary">
            <path
              d="M18 2a16 16 0 1 1 0 32a16 16 0 1 1 0-32"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.12"
              strokeWidth="3"
            />
            <path
              d="M18 2a16 16 0 1 1 0 32a16 16 0 1 1 0-32"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={`${pct}, 100`}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

function sortByNearestDeadline(items: DashboardCourseItem[]) {
  return [...items]
    .filter((c) => Boolean(c.deadline))
    .sort((a, b) => new Date(a.deadline || 0).getTime() - new Date(b.deadline || 0).getTime());
}

function CourseProgressRow({ course }: { course: DashboardCourseItem }) {
  const pct = typeof course.progress_percentage === 'number' ? clampPct(course.progress_percentage) : null;
  const subtitle = pct === null
    ? `Deadline: ${formatDate(course.deadline)}`
    : `Bo'limlar: ${course.completed_sections ?? 0}/${course.sections_count ?? 0}`;

  return (
    <Link
      to={course.spa_path || course.detail_url}
      className="group flex flex-col gap-4 rounded-[28px] border border-border bg-slate-50/70 p-6 transition-all hover:border-primary/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      aria-label={`${course.title} kursiga o'tish`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-lg font-black text-text-primary">{course.title}</p>
          <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-text-secondary">{course.description || 'Tavsif kiritilmagan.'}</p>
        </div>
        <ArrowUpRight size={18} className="shrink-0 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>

      <div className="grid gap-2 text-sm font-semibold text-text-secondary md:grid-cols-4">
        {pct !== null ? (
          <>
            <span className="md:col-span-2">
              Progress: {pct}% · {subtitle}
            </span>
            <span>Testlar: {course.tests_count ?? 0}</span>
            <span>Topshiriqlar: {course.assignments_count ?? 0}</span>
          </>
        ) : (
          <>
            <span className="md:col-span-2">{subtitle}</span>
            <span>Testlar: {course.test_count ?? 0}</span>
            <span>Topshiriqlar: {course.assignment_count ?? 0}</span>
          </>
        )}
      </div>
    </Link>
  );
}

type StudentDashboardViewProps = {
  data: DashboardResponse;
  onReload: () => void;
};

export function StudentDashboardView({ data, onReload }: StudentDashboardViewProps) {
  const coursesWithProgress = data.courses.filter((c) => typeof c.progress_percentage === 'number');
  const avgProgress = coursesWithProgress.length
    ? coursesWithProgress.reduce((acc, c) => acc + (typeof c.progress_percentage === 'number' ? c.progress_percentage : 0), 0) / coursesWithProgress.length
    : 0;

  const deadlines = sortByNearestDeadline(data.courses).slice(0, 6);

  return (
    <div className="space-y-10">
      <section className="card overflow-hidden bg-slate-950 p-8 text-white lg:p-12">
        <p className="label-micro text-white/50">{data.hero.kicker}</p>
        <h2 className="mt-4 text-4xl font-black tracking-tight lg:text-5xl">{data.hero.title}</h2>
        <p className="mt-4 max-w-3xl text-base font-medium leading-7 text-white/70">{data.hero.subtitle}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to={data.actions?.courses_path || '/courses'} className="btn btn-primary inline-flex items-center gap-2" aria-label="Kurslar sahifasi">
            <BookOpen size={16} />
            Kurslar
          </Link>
          <Link to={data.actions?.tests_path || '/tests'} className="btn inline-flex items-center gap-2 border border-white/15 bg-white/5 text-white hover:bg-white/10" aria-label="Testlar sahifasi">
            <ListChecks size={16} />
            Testlar
          </Link>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <ProgressRing
          value={avgProgress}
          label={coursesWithProgress.length ? `${coursesWithProgress.length} ta kurs bo'yicha` : "Kurs progressi topilmadi"}
        />

        <div className="card p-8">
          <div className="flex items-center gap-3">
            <GraduationCap size={20} className="text-primary" />
            <h3 className="text-xl font-black tracking-tight text-text-primary">Kurslar</h3>
          </div>
          <p className="mt-4 text-sm font-medium text-text-secondary">
            Jami: <span className="font-black text-text-primary">{data.courses.length}</span>
          </p>
          <p className="mt-2 text-sm font-medium text-text-secondary">
            Yaqin testlar: <span className="font-black text-text-primary">{data.upcoming_tests.length}</span>
          </p>
        </div>

        <div className="card p-8">
          <div className="flex items-center gap-3">
            <CalendarClock size={20} className="text-warning" />
            <h3 className="text-xl font-black tracking-tight text-text-primary">Deadline</h3>
          </div>
          <p className="mt-4 text-sm font-medium text-text-secondary">
            Eng yaqin deadline’lar kurslar ichida ko‘rsatiladi.
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <div className="card p-8">
          <div className="flex items-center gap-3">
            <BookOpen className="text-primary" size={22} />
            <h3 className="text-2xl font-black tracking-tight text-text-primary">Kurslar progressi</h3>
          </div>
          <div className="mt-8 space-y-4">
            {data.courses.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="Kurslar yo'q"
                description="Siz hali hech qanday kursga biriktirilmagansiz yoki kurslar ko‘rsatish uchun tayyor emas."
                action={{ label: 'Qayta urinish', onClick: () => onReload() }}
              />
            ) : (
              data.courses.slice(0, 6).map((course) => (
                <CourseProgressRow key={course.id} course={course} />
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-8">
            <div className="flex items-center gap-3">
              <CalendarClock className="text-warning" size={22} />
              <h3 className="text-2xl font-black tracking-tight text-text-primary">Deadline’lar</h3>
            </div>
            <div className="mt-6 space-y-3">
              {deadlines.length === 0 ? (
                <p className="text-sm font-medium text-text-secondary">Deadline belgilanmagan.</p>
              ) : (
                deadlines.map((c) => (
                  <Link
                    key={c.id}
                    to={c.spa_path || c.detail_url}
                    className="block rounded-[24px] border border-border p-5 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    aria-label={`${c.title} deadline`}
                  >
                    <p className="text-sm font-black text-text-primary">{c.title}</p>
                    <p className="mt-2 text-sm font-semibold text-text-secondary">{formatDate(c.deadline)}</p>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="card p-8">
            <div className="flex items-center gap-3">
              <ListChecks className="text-primary" size={22} />
              <h3 className="text-2xl font-black tracking-tight text-text-primary">Yaqin testlar</h3>
            </div>
            <div className="mt-6 space-y-4">
              {data.upcoming_tests.length === 0 ? (
                <p className="text-sm font-medium text-text-secondary">Yaqin test topilmadi.</p>
              ) : (
                data.upcoming_tests.slice(0, 5).map((test) => (
                  <Link
                    key={test.id}
                    to={test.spa_take_path}
                    className="block rounded-[24px] border border-border p-5 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    aria-label={`${test.name} testini boshlash`}
                  >
                    <p className="text-sm font-black text-text-primary">{test.name}</p>
                    <p className="mt-1 text-sm font-medium text-text-secondary">{test.course.title}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold uppercase tracking-wide text-text-secondary">
                      <span>{test.status_label}</span>
                      <span>{formatDate(test.start_datetime)}</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

