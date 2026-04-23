import { ArrowUpRight, BarChart3, BookOpen, CalendarRange, ClipboardEdit, Users } from 'lucide-react';
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

function topCoursesByStudents(items: DashboardCourseItem[]) {
  return [...items]
    .filter((c) => typeof c.student_count === 'number')
    .sort((a, b) => (b.student_count || 0) - (a.student_count || 0))
    .slice(0, 6);
}

type TeacherDashboardViewProps = {
  data: DashboardResponse;
  onReload: () => void;
};

export function TeacherDashboardView({ data, onReload }: TeacherDashboardViewProps) {
  const topCourses = topCoursesByStudents(data.courses);

  return (
    <div className="space-y-10">
      <section className="card overflow-hidden bg-slate-950 p-8 text-white lg:p-12">
        <p className="label-micro text-white/50">{data.hero.kicker}</p>
        <h2 className="mt-4 text-4xl font-black tracking-tight lg:text-5xl">{data.hero.title}</h2>
        <p className="mt-4 max-w-3xl text-base font-medium leading-7 text-white/70">{data.hero.subtitle}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/courses/manage" className="btn btn-primary" aria-label="Kurslarni boshqarish">
            <BookOpen size={16} />
            Kurslarni boshqarish
          </Link>
          <Link to="/tests/manage" className="btn border border-white/15 bg-white/5 text-white hover:bg-white/10" aria-label="Testlarni boshqarish">
            <ClipboardEdit size={16} />
            Testlarni boshqarish
          </Link>
          <button
            type="button"
            onClick={() => onReload()}
            className="btn border border-white/15 bg-white/5 text-white hover:bg-white/10"
            aria-label="Dashboardni yangilash"
          >
            Yangilash
          </button>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {(data.stats || []).slice(0, 3).map((stat) => (
          <div key={stat.label} className="card p-8">
            <p className="label-micro">{stat.label}</p>
            <p className="mt-3 text-3xl font-black tracking-tight text-text-primary">{stat.value}</p>
            <p className="mt-2 text-sm font-medium text-text-secondary">{stat.subtitle}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
        <div className="card p-8">
          <div className="flex items-center gap-3">
            <CalendarRange className="text-primary" size={22} />
            <h3 className="text-2xl font-black tracking-tight text-text-primary">Kurs statistikasi</h3>
          </div>
          <div className="mt-8 space-y-4">
            {data.courses.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="Kurslar topilmadi"
                description="Sizga biriktirilgan kurslar yo‘q yoki ko‘rsatish uchun tayyor emas."
              />
            ) : (
              data.courses.slice(0, 6).map((course) => (
                <Link
                  key={course.id}
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
                    <span className="md:col-span-2">Deadline: {formatDate(course.deadline)}</span>
                    <span>Talabalar: {course.student_count ?? 0}</span>
                    <span>Bo'limlar: {course.section_count ?? 0}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-8">
            <div className="flex items-center gap-3">
              <Users className="text-success" size={22} />
              <h3 className="text-2xl font-black tracking-tight text-text-primary">Aktiv talabalar</h3>
            </div>
            <div className="mt-6 space-y-3">
              {topCourses.length === 0 ? (
                <p className="text-sm font-medium text-text-secondary">
                  Talabalar soni bo‘yicha ma’lumot topilmadi.
                </p>
              ) : (
                topCourses.map((c) => (
                  <Link
                    key={c.id}
                    to={c.spa_path || c.detail_url}
                    className="flex items-center justify-between rounded-[24px] border border-border p-5 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    aria-label={`${c.title} kursi talabalari`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-text-primary">{c.title}</p>
                      <p className="mt-1 text-xs font-semibold text-text-secondary">Talabalar: {c.student_count ?? 0}</p>
                    </div>
                    <ArrowUpRight size={16} className="shrink-0 text-primary" />
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="card p-8">
            <div className="flex items-center gap-3">
              <BarChart3 className="text-primary" size={22} />
              <h3 className="text-2xl font-black tracking-tight text-text-primary">Baholash navbati</h3>
            </div>
            <div className="mt-6 space-y-3">
              {data.recent_attempts.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title="Navbat bo‘sh"
                  description="Hozircha baholash uchun yangi urinishlar yo‘q."
                  className="py-10"
                />
              ) : (
                data.recent_attempts.slice(0, 5).map((attempt) => (
                  <div key={attempt.id} className="rounded-[24px] border border-border p-5">
                    <p className="text-sm font-black text-text-primary">{attempt.test.name}</p>
                    <p className="mt-1 text-sm font-medium text-text-secondary">{attempt.student_name}</p>
                    <div className="mt-3 flex items-center justify-between text-sm font-semibold text-text-secondary">
                      <span>{attempt.score} / {attempt.test.max_score}</span>
                      <span>{formatDate(attempt.finished_at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

