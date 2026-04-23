import { Fragment, type ReactNode } from 'react';
import { ExternalLink, GraduationCap, Shield, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/src/features/auth/auth-context';
import { cn } from '@/src/lib/utils';

function QuickLink({
  to,
  label,
  icon,
  external,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  external?: boolean;
}) {
  const base =
    'flex items-center gap-3 rounded-3xl border border-border bg-white px-5 py-4 text-sm font-black text-text-primary shadow-premium transition-all hover:border-primary/20 hover:shadow-2xl';

  if (external) {
    return (
      <a href={to} className={cn(base, 'justify-between')}>
        <span className="flex items-center gap-3">
          {icon}
          <span>{label}</span>
        </span>
        <ExternalLink size={16} className="text-text-muted" />
      </a>
    );
  }

  return (
    <Link to={to} className={base}>
      {icon}
      <span>{label}</span>
    </Link>
  );
}

export default function SuperAdminPage() {
  const { session } = useAuth();
  const role = session?.user?.active_role || '';

  if (!session?.authenticated) {
    return null;
  }

  if (role !== 'SUPER_ADMIN') {
    return (
      <div className="rounded-3xl border border-border bg-white p-8 shadow-premium">
        <p className="label-micro">Access</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight">Sizda ruxsat yo&apos;q</h2>
        <p className="mt-2 text-sm font-medium text-text-secondary">Ushbu sahifa faqat `SUPER_ADMIN` roli uchun.</p>
      </div>
    );
  }

  const quickLinks = [
    {
      to: '/admin/dashboard',
      label: 'Admin panel',
      icon: <Shield size={18} className="text-primary" />,
    },
    {
      to: '/admin/',
      label: 'Django Admin',
      icon: <ExternalLink size={18} className="text-primary" />,
      external: true,
    },
    {
      to: '/admin/users/sidebarmenu/',
      label: 'Sidebar menulari',
      icon: <Shield size={18} className="text-primary" />,
      external: true,
    },
    {
      to: '/super-admin/sidebar',
      label: 'Sidebar management',
      icon: <Shield size={18} className="text-primary" />,
    },
    {
      to: '/admin/users/sidebarmenuaccess/',
      label: 'Sidebar ruxsatlari',
      icon: <Shield size={18} className="text-primary" />,
      external: true,
    },
    {
      to: '/admin/teachers/create',
      label: "O'qituvchi yaratish",
      icon: <UserPlus size={18} className="text-primary" />,
    },
    {
      to: '/admin/students/create',
      label: 'Talaba yaratish',
      icon: <GraduationCap size={18} className="text-primary" />,
    },
    {
      to: '/retake/admin/db-managers/faculties',
      label: 'MB menejerlar — fakultetlar',
      icon: <Shield size={18} className="text-primary" />,
    },
  ];

  const dynamicLinks = (session.navigation || []).map((item) => ({
    ...item,
    external: !item.path.startsWith('/') || item.path.startsWith('/admin/'),
  }));

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-border bg-white p-8 shadow-premium">
        <p className="label-micro">Super admin</p>
        <div className="mt-3 flex items-start justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black tracking-tight">Boshqaruv paneli</h2>
            <p className="mt-3 max-w-3xl text-sm font-medium text-text-secondary">
              Bu bo&apos;lim super admin uchun markaziy nazorat nuqtasi. Sidebar navigatsiyasi endi backenddan boshqariladi:
              har bir rol uchun qaysi menyu ko&apos;rinishi, qaysi section&apos;ga tushishi va qanday tartibda chiqishi
              `SidebarMenu` hamda `SidebarMenuAccess` orqali belgilanadi.
            </p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-950 text-white shadow-xl">
            <Shield size={22} />
          </div>
        </div>
      </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map(({ to, label, icon, external }) => (
            <Fragment key={`${label}:${to}`}>
              <QuickLink to={to} label={label} icon={icon} external={external} />
            </Fragment>
          ))}
        </div>

      {dynamicLinks.length ? (
        <div className="rounded-3xl border border-border bg-white p-8 shadow-premium">
          <p className="label-micro">Dynamic sidebar</p>
          <h3 className="mt-2 text-xl font-black tracking-tight">Backenddan kelayotgan navigatsiya</h3>
          <p className="mt-2 max-w-3xl text-sm font-medium text-text-secondary">
            Quyidagi ro&apos;yxat faol `SUPER_ADMIN` roli uchun real session payload. Admin panelda order yoki visibility
            o&apos;zgarsa, frontend sidebar shu konfiguratsiya bilan qayta chiziladi.
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {dynamicLinks.map((item) =>
              item.external ? (
                <a
                  key={`${item.label}:${item.path}`}
                  href={item.path}
                  className="flex items-center justify-between rounded-2xl border border-border/60 bg-slate-50/60 px-5 py-4 text-sm font-bold text-text-primary transition-all hover:bg-white hover:shadow-premium"
                >
                  <span className="truncate">{item.label}</span>
                  <span className="text-xs font-black uppercase tracking-widest text-text-muted">Open</span>
                </a>
              ) : (
                <Link
                  key={`${item.label}:${item.path}`}
                  to={item.path}
                  className="flex items-center justify-between rounded-2xl border border-border/60 bg-slate-50/60 px-5 py-4 text-sm font-bold text-text-primary transition-all hover:bg-white hover:shadow-premium"
                >
                  <span className="truncate">{item.label}</span>
                  <span className="text-xs font-black uppercase tracking-widest text-text-muted">Open</span>
                </Link>
              ),
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
