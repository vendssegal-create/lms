import { Bell, LogOut, Menu, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Sun, type LucideIcon } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/src/features/auth/auth-context';
import { useTheme, type Theme } from '@/src/features/theme/theme-context';
import { isSuperAdmin } from '@/src/lib/roles';
import { cn } from '@/src/lib/utils';
import { BottomNav } from '@/src/components/layout/bottom-nav';
import { LoginAlertModal } from '@/src/components/notifications/LoginAlertModal';
import { PageTransition } from '@/src/components/ui/page-transition';

const AppSidebar = lazy(() => import('@/src/components/layout/app-sidebar').then((module) => ({ default: module.AppSidebar })));
const QuickChatFab = lazy(() => import('@/src/components/layout/quick-chat-fab').then((module) => ({ default: module.QuickChatFab })));
const RoleSwitcherMenu = lazy(() => import('@/src/components/layout/role-switcher-menu').then((module) => ({ default: module.RoleSwitcherMenu })));

const COLLAPSED_SIDEBAR_KEY = 'lms.v2.sidebar.collapsed';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options: { value: Theme; icon: LucideIcon; label: string }[] = [
    { value: 'light', icon: Sun, label: 'Yorug‘' },
    { value: 'dark', icon: Moon, label: 'Qorong‘u' },
    { value: 'system', icon: Monitor, label: 'Tizim' },
  ];

  return (
    <div className="hidden items-center gap-0.5 rounded-xl border border-border bg-stone-50/90 p-0.5 dark:border-dark-border dark:bg-dark-surface md:flex">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          title={label}
          aria-label={label}
          className={cn(
            'rounded-lg p-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            theme === value
              ? 'bg-white text-primary shadow-sm dark:bg-stone-700 dark:text-emerald-400'
              : 'text-text-muted hover:text-text-primary',
          )}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
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
  const hasUnreadMessages = unreadMessages > 0;
  const isMessagesRoute = location.pathname.startsWith('/messages');
  const isSuperAdminRole = isSuperAdmin(activeRole);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(COLLAPSED_SIDEBAR_KEY, isSidebarCollapsed ? '1' : '0');
  }, [isSidebarCollapsed]);

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

        <div
          className={cn(
            'flex min-h-screen flex-1 flex-col transition-[margin] duration-300 ease-out',
            isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72',
          )}
        >
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-border/80 bg-card/75 px-4 backdrop-blur-xl lg:px-8 dark:border-dark-border dark:bg-dark-card/75">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                onClick={() => setIsSidebarOpen((value) => !value)}
                className="rounded-xl border border-border bg-card p-2.5 text-text-secondary shadow-sm transition-colors hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:hidden dark:hover:bg-dark-surface"
                aria-label="Menyuni ochish"
              >
                <Menu size={18} />
              </button>
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed((value) => !value)}
                className="hidden rounded-xl border border-border bg-card p-2.5 text-text-secondary shadow-sm transition-colors hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:inline-flex dark:hover:bg-dark-surface"
                aria-label={isSidebarCollapsed ? 'Sidebarni kengaytirish' : 'Sidebarni qisqartirish'}
              >
                {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              </button>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                  {isSuperAdminRole ? 'Super admin' : 'Boshqaruv'}
                </p>
                <h1 className="truncate font-display text-base font-bold tracking-tight text-text-primary lg:text-lg">HEMIS LMS</h1>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <ThemeToggle />
              <div className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-text-secondary shadow-sm sm:flex dark:border-dark-border dark:bg-dark-surface">
                <Bell size={15} className="text-primary" aria-hidden />
                <span className="tabular-nums">{session?.notifications.unread_count || 0} yangi</span>
              </div>

              <Suspense fallback={<div className="h-10 w-36 rounded-xl border border-border bg-card shadow-sm" />}>
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
                className="rounded-xl border border-border bg-card p-2.5 text-text-secondary shadow-sm transition-colors hover:border-danger/30 hover:bg-danger/5 hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
                aria-label="Chiqish"
              >
                <LogOut size={18} />
              </button>
            </div>
          </header>

          <main className="flex-1 p-4 pb-24 lg:p-8 lg:pb-8">
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
