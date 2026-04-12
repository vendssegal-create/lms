import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, BarChart3, BookOpen, CalendarRange, FlaskConical, Layers3, LoaderCircle, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { fetchDashboard } from '@/src/api/lms';
import { DashboardResponse } from '@/src/types';
import { AnimatedCounter } from '@/src/components/ui/animated-counter';
import { cn } from '@/src/lib/utils';

function formatDate(value: string | null) {
  if (!value) {
    return 'Belgilanmagan';
  }

  return new Intl.DateTimeFormat('uz-UZ', {
    dateStyle: 'medium',
    timeStyle: value.includes('T') ? 'short' : undefined,
  }).format(new Date(value));
}

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  icon?: ReactNode;
  color?: string;
}

function StatCard({ title, value, subtitle, icon, color }: StatCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 20px 40px -15px rgba(67, 97, 238, 0.18)' }}
      transition={{ duration: 0.25 }}
      className="card p-7"
    >
      {icon ? (
        <div className={cn('mb-5 flex h-12 w-12 items-center justify-center rounded-2xl', color || 'bg-primary/10 text-primary')}>
          {icon}
        </div>
      ) : null}
      <p className="label-micro">{title}</p>
      <p className="mt-3 text-4xl font-black tracking-tight text-text-primary">
        {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
      </p>
      <p className="mt-2 text-sm font-medium text-text-secondary">{subtitle}</p>
    </motion.div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchDashboard();
        if (active) {
          setData(response);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Dashboard yuklanmadi.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="card flex min-h-[320px] items-center justify-center gap-3 p-8 text-text-secondary">
        <LoaderCircle className="animate-spin text-primary" size={20} />
        Dashboard yuklanmoqda...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card p-8">
        <p className="text-lg font-black text-text-primary">Dashboard yuklanmadi</p>
        <p className="mt-3 text-sm font-medium text-rose-500">{error || "Noma'lum xatolik."}</p>
      </div>
    );
  }

  const statVisuals = [
    { icon: <BookOpen size={20} />, color: 'bg-primary/10 text-primary' },
    { icon: <FlaskConical size={20} />, color: 'bg-emerald-100 text-emerald-700' },
    { icon: <BarChart3 size={20} />, color: 'bg-violet-100 text-violet-700' },
    { icon: <Layers3 size={20} />, color: 'bg-amber-100 text-amber-700' },
  ];

  return (
    <div className="space-y-10">
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-[40px] bg-slate-950 px-8 py-10 text-white shadow-2xl lg:px-12 lg:py-14"
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 animate-pulse rounded-full bg-primary/20 blur-[80px]" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-60 w-60 animate-pulse rounded-full bg-secondary/15 blur-[60px]" />

        <div className="relative z-10">
          <p className="label-micro text-white/50">{data.hero.kicker}</p>
          <h2 className="mt-4 text-4xl font-black tracking-tight lg:text-5xl">{data.hero.title}</h2>
          <p className="mt-4 max-w-3xl text-base font-medium leading-7 text-white/70">{data.hero.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/courses" className="flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/20">
              <BookOpen size={15} />
              Kurslar
            </Link>
            <Link to="/tests" className="flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/20">
              <FlaskConical size={15} />
              Testlar
            </Link>
            <Link to="/grades" className="flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/20">
              <BarChart3 size={15} />
              Baholar
            </Link>
          </div>
        </div>
      </motion.section>

      <section className={`grid gap-6 ${data.stats.length > 3 ? 'xl:grid-cols-4 md:grid-cols-2' : 'md:grid-cols-3'}`}>
        {data.stats.map((stat, idx) => (
          <div key={stat.label}>
            <StatCard
              title={stat.label}
              value={stat.value}
              subtitle={stat.subtitle}
              icon={statVisuals[idx % statVisuals.length]?.icon}
              color={statVisuals[idx % statVisuals.length]?.color}
            />
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <div className="card p-8">
          <div className="flex items-center gap-3">
            <BookOpen className="text-primary" size={22} />
            <h3 className="text-2xl font-black tracking-tight text-text-primary">Kurslar holati</h3>
          </div>
          <div className="mt-8 space-y-4">
            {data.courses.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-border p-6 text-sm font-medium text-text-secondary">
                Hozircha ko'rsatish uchun kurs topilmadi.
              </div>
            ) : (
              data.courses.map((course) => (
                <Link
                  key={course.id}
                  to={course.spa_path || course.detail_url}
                  className="flex flex-col gap-4 rounded-[28px] border border-border bg-slate-50/70 p-6 transition-all hover:border-primary/20 hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-black text-text-primary">{course.title}</p>
                      <p className="mt-2 text-sm font-medium leading-6 text-text-secondary">{course.description || 'Tavsif kiritilmagan.'}</p>
                    </div>
                    <ArrowUpRight size={18} className="shrink-0 text-primary" />
                  </div>
                  <div className="grid gap-3 text-sm font-semibold text-text-secondary md:grid-cols-4">
                    {'progress_percentage' in course && typeof course.progress_percentage === 'number' ? (
                      <>
                        <span>Progress: {course.progress_percentage}%</span>
                        <span>Bo'limlar: {course.completed_sections}/{course.sections_count}</span>
                        <span>Testlar: {course.tests_count}</span>
                        <span>Topshiriqlar: {course.assignments_count}</span>
                      </>
                    ) : (
                      <>
                        <span>Talabalar: {course.student_count}</span>
                        <span>Bo'limlar: {course.section_count}</span>
                        <span>Testlar: {course.test_count}</span>
                        <span>Deadline: {formatDate(course.deadline)}</span>
                      </>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-8">
            <div className="flex items-center gap-3">
              <CalendarRange className="text-primary" size={22} />
              <h3 className="text-2xl font-black tracking-tight text-text-primary">Yaqin testlar</h3>
            </div>
            <div className="mt-6 space-y-4">
              {data.upcoming_tests.length === 0 ? (
                <p className="text-sm font-medium text-text-secondary">Yaqin test topilmadi.</p>
              ) : (
                data.upcoming_tests.map((test) => (
                  <div key={test.id} className="rounded-[24px] border border-border p-5">
                    <p className="text-sm font-black text-text-primary">{test.name}</p>
                    <p className="mt-1 text-sm font-medium text-text-secondary">{test.course.title}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold uppercase tracking-wide text-text-secondary">
                      <span>{test.status_label}</span>
                      <span>{formatDate(test.start_datetime)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card p-8">
            <div className="flex items-center gap-3">
              <Layers3 className="text-primary" size={22} />
              <h3 className="text-2xl font-black tracking-tight text-text-primary">Oxirgi natijalar</h3>
            </div>
            <div className="mt-6 space-y-4">
              {data.recent_attempts.length === 0 ? (
                <p className="text-sm font-medium text-text-secondary">Hali yakunlangan urinishlar yo'q.</p>
              ) : (
                data.recent_attempts.map((attempt) => (
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

          {data.pending_retake_groups && data.pending_retake_groups.length > 0 ? (
            <div className="card p-8">
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-success" size={22} />
                <h3 className="text-2xl font-black tracking-tight text-text-primary">Retake bog'lanishlari</h3>
              </div>
              <div className="mt-6 space-y-4">
                {data.pending_retake_groups.map((group) => (
                  <div key={group.id} className="rounded-[24px] border border-border p-5">
                    <p className="text-sm font-black text-text-primary">{group.subject_name}</p>
                    <p className="mt-1 text-sm font-medium text-text-secondary">{group.cycle_name}</p>
                    <p className="mt-2 text-sm font-semibold text-text-primary">{group.course_title}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
