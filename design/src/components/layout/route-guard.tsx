import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/src/features/auth/auth-context';

function FullPageMessage({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-6">
      <div className="max-w-md rounded-[32px] border border-border bg-white p-10 text-center shadow-premium">
        <h1 className="text-2xl font-black tracking-tight text-text-primary">{title}</h1>
        <p className="mt-3 text-sm font-medium text-text-secondary">{description}</p>
      </div>
    </div>
  );
}

export function ProtectedRoute() {
  const { session, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <FullPageMessage title="Yuklanmoqda" description="Frontend sessiya bilan sinxronlanmoqda." />;
  }

  if (!session?.authenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
