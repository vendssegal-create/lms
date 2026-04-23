import { useEffect, useState } from 'react';
import { BookOpen, Briefcase, GraduationCap, RefreshCw, ShieldCheck, Users, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchAdminDashboard } from '@/src/api/lms';
import type { AdminDashboardResponse } from '@/src/types';
import { SkeletonStatCard, SkeletonTable } from '@/src/components/ui/skeleton-card';
import { cn } from '@/src/lib/utils';

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'medium' }).format(new Date(value));
}

function formatRelative(value: string | null) {
  if (!value) return '-';
  const diff = Date.now() - new Date(value).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'hozir';
  if (hours < 24) return `${hours} soat oldin`;
  const days = Math.floor(hours / 24);
  return `${days} kun oldin`;
}

export function AdminDashboardView() {
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await fetchAdminDashboard();
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin dashboard yuklanmadi.');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = data
    ? [
        { label: 'Jami foydalanuvchi', value: data.totals.users, icon: Users, tone: 'bg-primary text-white' },
        { label: 'Jami kurslar', value: data.totals.courses, icon: BookOpen, tone: 'bg-emerald-500 text-white' },
        { label: "O'qituvchilar", value: data.totals.teachers, icon: Briefcase, tone: 'bg-amber-500 text-white' },
        { label: 'Talabalar', value: data.totals.students, icon: GraduationCap, tone: 'bg-rose-500 text-white' },
      ]
    : [];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[32px] bg-slate-900 p-8 text-white lg:p-12">
        <div className="absolute -right-20 -top-16 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-secondary/10 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.2em]">
              <ShieldCheck size={12} className="text-primary" />
              Ma'muriy dashboard
            </div>
            <h2 className="mt-6 text-4xl font-black tracking-tight lg:text-5xl">Tizim ko‘rsatkichlari</h2>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-white/70">
              Foydalanuvchilar, kurslar va retake jarayonlari bo‘yicha tezkor ko‘rinish.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/admin/teachers/create" className="btn btn-primary">
              O'qituvchi qo'shish
            </Link>
            <Link to="/admin/students/create" className="btn border border-white/15 bg-white/5 text-white hover:bg-white/10">
              Talaba qo'shish
            </Link>
            <button type="button" onClick={() => void load()} className="btn border border-white/15 bg-white/5 text-white hover:bg-white/10" aria-label="Yangilash">
              <RefreshCw size={16} />
              Yangilash
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="card p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-danger/10 text-danger">
              <XCircle size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-black text-text-primary">Dashboard yuklanmadi</p>
              <p className="mt-2 text-sm font-medium leading-7 text-text-secondary">{error}</p>
              <button type="button" onClick={() => void load()} className="btn btn-primary mt-5">
                Qayta urinish
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          <>
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
          </>
        ) : (
          stats.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="card p-6">
                <div className={cn('flex h-14 w-14 items-center justify-center rounded-[20px] shadow-xl', item.tone)}>
                  <Icon size={28} />
                </div>
                <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.2em] text-text-muted">{item.label}</p>
                <p className="mt-2 text-3xl font-black tracking-tight text-text-primary">{item.value}</p>
              </div>
            );
          })
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)]">
        <div className="card overflow-hidden">
          <div className="border-b border-border/60 px-6 py-5 lg:px-8">
            <h3 className="text-xl font-black tracking-tight text-text-primary">Oxirgi kurslar</h3>
          </div>
          {isLoading ? (
            <div className="p-6">
              <SkeletonTable rows={6} cols={4} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
                    <th className="px-6 py-4">Kurs</th>
                    <th className="px-6 py-4">O'qituvchi</th>
                    <th className="px-6 py-4">Bo'limlar</th>
                    <th className="px-6 py-4">Holat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.recent_courses.length ? (
                    data.recent_courses.map((course) => (
                      <tr key={course.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-5">
                          <Link to={course.spa_path} className="font-bold text-text-primary hover:text-primary">
                            {course.title}
                          </Link>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">{formatDate(course.created_at)}</p>
                        </td>
                        <td className="px-6 py-5 text-text-secondary">{course.teacher.full_name}</td>
                        <td className="px-6 py-5 text-text-secondary">{course.sections_count}</td>
                        <td className="px-6 py-5">
                          <span className={cn('status-pill', course.is_active ? 'status-pill-success' : 'status-pill-muted')}>
                            {course.is_active ? 'Faol' : 'Nofaol'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-16 text-center text-sm font-medium text-text-secondary">
                        Kurslar mavjud emas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card bg-slate-900 p-8 text-white">
            <h3 className="text-lg font-black tracking-tight">Retake statistikasi</h3>
            <div className="mt-6 space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/40">Jami arizalar</span>
                <span className="text-2xl font-black text-primary">{data?.retake_stats.total_apps ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white/70">Moliya ko'rigida</span>
                <span className="font-black text-amber-400">{data?.retake_stats.pending_finance ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white/70">Tasdiqlangan</span>
                <span className="font-black text-emerald-400">{data?.retake_stats.approved_retakes ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white/70">Yakunlangan</span>
                <span className="font-black text-sky-400">{data?.retake_stats.completed_retakes ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-border/60 px-6 py-5">
              <h3 className="text-lg font-black tracking-tight text-text-primary">Yaqinda qo'shilganlar</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {isLoading ? (
                <div className="px-6 py-10 text-sm font-medium text-text-secondary">Yuklanmoqda...</div>
              ) : data?.recent_users.length ? (
                data.recent_users.map((user) => (
                  <div key={user.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-xs font-black text-primary">
                      {(user.full_name || user.username).slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-text-primary">{user.full_name || user.username}</p>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-text-muted">{user.role_label}</p>
                    </div>
                    <span className="text-[10px] font-bold text-text-muted">{formatRelative(user.date_joined)}</span>
                  </div>
                ))
              ) : (
                <div className="px-6 py-10 text-sm font-medium text-text-secondary">Yangi userlar yo'q.</div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

