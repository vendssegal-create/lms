import { Bell, LogOut, Menu, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Sun, type LucideIcon } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/src/features/auth/auth-context';
import { useTheme, type Theme } from '@/src/features/theme/theme-context';
import { isSuperAdmin } from '@/src/lib/roles';
import { cn } from '@/src/lib/utils';
import { BottomNav } from '@/src/components/layout/bottom-nav';
import { LoginAlertModal } from '@/src/components/notifications/LoginAlertModal';
import { PageTransition } from '@/src/components/ui/page-transition';
import type { NavigationItem } from '@/src/types';

const AppSidebar = lazy(() => import('@/src/components/layout/app-sidebar').then((module) => ({ default: module.AppSidebar })));
const QuickChatFab = lazy(() => import('@/src/components/layout/quick-chat-fab').then((module) => ({ default: module.QuickChatFab })));
const RoleSwitcherMenu = lazy(() => import('@/src/components/layout/role-switcher-menu').then((module) => ({ default: module.RoleSwitcherMenu })));

const COLLAPSED_SIDEBAR_KEY = 'lms.sidebar.collapsed';

// Route → page title fallback map
const ROUTE_TITLE_MAP: Record<string, string> = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/courses': 'Kurslar',
  '/tests': 'Testlar',
  '/grades': 'Baholar',
  '/notifications': 'Bildirishnomalar',
  '/messages': 'Xabarlar',
  '/profile': 'Profil',
  '/retake': 'Retake arizalari',
  '/retake/dashboard': 'Retake Dashboard',
  '/retake/cycles': 'Retake sikllar',
  '/retake/groups': 'Retake guruhlar',
  '/retake/schedules': 'Retake jadval',
  '/retake/exam-calendar': 'Imtihon kalendari',
  '/retake/teacher-groups': "O'qituvchi guruhlari",
  '/retake/sync': 'HEMIS sync',
  '/retake/search-student': 'Talaba qidirish',
  '/admin': 'Admin panel',
  '/superadmin': 'Super Admin',
};

function resolvePageTitle(pathname: string, navigation: NavigationItem[]): string {
  // exact match in nav
  const navMatch = navigation.find((item) => item.path === pathname || item.path === pathname.replace(/\/$/, ''));
  if (navMatch) return navMatch.label;

  // exact match in static map
  if (ROUTE_TITLE_MAP[pathname]) return ROUTE_TITLE_MAP[pathname];

  // prefix match (e.g. /retake/students/123 → /retake)
  const prefixMatch = Object.entries(ROUTE_TITLE_MAP)
    .filter(([k]) => k !== '/' && pathname.startsWith(k))
    .sort((a, b) => b[0].length - a[0].length)[0];
  if (prefixMatch) return prefixMatch[1];

  return 'Django LMS';
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options: { value: Theme; icon: LucideIcon; label: string }[] = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ];

  return (
    <div className="hidden items-center gap-1 rounded-2xl border border-border bg-card p-1 shadow-premium md:flex">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          title={label}
          aria-label={label}
          className={cn(
            'rounded-xl p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            theme === value ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:text-text-primary',
          )}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}

function NotificationBell({ count }: { count: number }) {
  const hasUnread = count > 0;
  return (
    <Link
      to="/notifications"
      aria-label={`${count} ta o'qilmagan bildirishnoma`}
      className="relative hidden rounded-2xl border border-border bg-card p-3 text-text-secondary shadow-premium transition-all hover:border-primary/20 hover:bg-primary/5 hover:text-primary md:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <Bell size={18} />
      {hasUnread && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-black text-white shadow-lg">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}

export function AppShell() {
  const { session, logout, switchRole } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.localStorage.getItem(COLLAPSED_SIDEBAR_KEY) === '1';
  });
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);

  const user = session?.user;
  const activeRole = user?.active_role || '';
  const unreadMessages = session?.messages.unread_count || 0;
  const unreadNotifications = session?.notifications.unread_count || 0;
  const hasUnreadMessages = unreadMessages > 0;
  const isMessagesRoute = location.pathname.startsWith('/messages');
  const isSuperAdminRole = isSuperAdmin(activeRole);

  const pageTitle = useMemo(
    () => resolvePageTitle(location.pathname, session?.navigation || []),
    [location.pathname, session?.navigation],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(COLLAPSED_SIDEBAR_KEY, isSidebarCollapsed ? '1' : '0');
  }, [isSidebarCollapsed]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen mesh-bg text-text-primary">
      <LoginAlertModal />
      <div className="flex min-h-screen">
        <Suspense fallback={null}>
          <AppSidebar
            navigation={session?.navigation || []}
            isSidebarOpen={isSidebarOpen}
            isSidebarCollapsed={isSidebarCollapsed}
            user={user}
            onClose={() => setIsSidebarOpen(false)}
          />
        </Suspense>

        {/* Mobile backdrop overlay */}
        <button
          type="button"
          aria-label="Menyuni yopish"
          onClick={() => setIsSidebarOpen(false)}
          className={cn(
            'fixed inset-0 z-40 bg-black/45 backdrop-blur-sm transition-opacity lg:hidden',
            isSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        />

        <div className={cn('flex min-h-screen flex-1 flex-col transition-[margin] duration-300 ease-out', isSidebarCollapsed ? 'lg:ml-24' : 'lg:ml-80')}>
          <header className="sticky top-0 z-40 flex h-20 items-center justify-between border-b border-border/60 bg-card/80 px-6 backdrop-blur-md lg:px-8">
            <div className="flex items-center gap-3">
              {/* Mobile menu toggle */}
              <button
                type="button"
                onClick={() => setIsSidebarOpen((value) => !value)}
                className="rounded-2xl border border-border bg-card p-2.5 text-text-secondary shadow-premium transition-all hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 lg:hidden"
                aria-label="Menyuni ochish"
              >
                <Menu size={18} />
              </button>
              {/* Desktop sidebar collapse toggle */}
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed((value) => !value)}
                className="hidden rounded-2xl border border-border bg-card p-2.5 text-text-secondary shadow-premium transition-all hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 lg:inline-flex"
                aria-label={isSidebarCollapsed ? 'Sidebarni kengaytirish' : 'Sidebarni qisqartirish'}
              >
                {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              </button>

              {/* Page title */}
              <div className="hidden sm:block">
                <p className="label-micro">{isSuperAdminRole ? 'Super admin' : user?.active_role_label || 'Boshqaruv paneli'}</p>
                <h1 className="text-lg font-black tracking-tight text-text-primary transition-all duration-200">
                  {pageTitle}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <NotificationBell count={unreadNotifications} />

              <Suspense fallback={<div className="h-10 w-36 rounded-2xl border border-border bg-card shadow-premium" />}>
                <RoleSwitcherMenu
                  activeRole={activeRole}
                  activeRoleLabel={user?.active_role_label}
                  availableRoles={user?.available_roles || []}
                  isOpen={isRoleMenuOpen}
                  onToggle={() => setIsRoleMenuOpen((value) => !value)}
                  onSwitchRole={async (role) => {
                    await switchRole(role);
                    setIsRoleMenuOpen(false);
                  }}
                />
              </Suspense>

              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-2xl border border-border bg-card p-2.5 text-text-secondary shadow-premium transition-all hover:border-danger/20 hover:bg-danger/5 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
                aria-label="Chiqish"
              >
                <LogOut size={18} />
              </button>
            </div>
          </header>

          <main className="flex-1 p-6 pb-24 lg:p-10 lg:pb-10">
            <div className="mx-auto max-w-7xl">
              <PageTransition>
                <Outlet />
              </PageTransition>
            </div>
          </main>
          <BottomNav unreadMessages={unreadMessages} />

          <Suspense fallback={null}>
            <QuickChatFab
              unreadMessages={unreadMessages}
              hasUnreadMessages={hasUnreadMessages}
              isMessagesRoute={isMessagesRoute}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
