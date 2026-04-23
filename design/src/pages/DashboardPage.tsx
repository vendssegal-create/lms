import { useEffect, useState } from 'react';
import { LoaderCircle, XCircle } from 'lucide-react';
import { fetchDashboard } from '@/src/api/lms';
import type { DashboardResponse, UserRole } from '@/src/types';
import { useAuth } from '@/src/features/auth/auth-context';
import { StudentDashboardView } from '@/src/pages/dashboard/StudentDashboardView';
import { TeacherDashboardView } from '@/src/pages/dashboard/TeacherDashboardView';
import { AdminDashboardView } from '@/src/pages/dashboard/AdminDashboardView';

function isAdminLike(role: UserRole | string): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'REGISTRATOR' || role === 'ACADEMIC_BOARD';
}

export default function DashboardPage() {
  const { session } = useAuth();
  const activeRole = (session?.user?.active_role || '') as UserRole | string;

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchDashboard();
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dashboard yuklanmadi.');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-danger/10 text-danger">
            <XCircle size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-black text-text-primary">Dashboard yuklanmadi</p>
            <p className="mt-2 text-sm font-medium leading-7 text-text-secondary">{error || "Noma'lum xatolik."}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="btn btn-primary mt-5"
              aria-label="Dashboardni qayta yuklash"
            >
              Qayta urinish
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isAdminLike(activeRole)) {
    return <AdminDashboardView />;
  }

  if (activeRole === 'TEACHER' || data.role === 'TEACHER') {
    return <TeacherDashboardView data={data} onReload={load} />;
  }

  return <StudentDashboardView data={data} onReload={load} />;
}
