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

const COLLAPSED_SIDEBAR_KEY = 'lms.sidebar.collapsed';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options: { value: Theme; icon: LucideIcon; label: string }[] = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ];

  return (
    <div className="hidden items-center gap-1 rounded-2xl border border-border bg-white p-1 shadow-premium md:flex dark:bg-dark-surface">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          title={label}
          aria-label={label}
          className={cn(
            'rounded-xl p-2 transition-colors',
            theme === value ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:text-text-primary',
          )}
        >
          <Icon size={15} />
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

        <div className={cn('flex min-h-screen flex-1 flex-col transition-[margin] duration-300 ease-out', isSidebarCollapsed ? 'lg:ml-24' : 'lg:ml-80')}>
          <header className="sticky top-0 z-40 flex h-24 items-center justify-between border-b border-border/60 bg-white/70 px-6 backdrop-blur-md lg:px-8">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setIsSidebarOpen((value) => !value)}
                className="rounded-2xl border border-border bg-white p-3 text-text-secondary shadow-premium transition-all hover:bg-slate-50 lg:hidden"
              >
                <Menu size={18} />
              </button>
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed((value) => !value)}
                className="hidden rounded-2xl border border-border bg-white p-3 text-text-secondary shadow-premium transition-all hover:bg-slate-50 lg:inline-flex"
                aria-label={isSidebarCollapsed ? 'Sidebarni kengaytirish' : 'Sidebarni qisqartirish'}
              >
                {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              </button>
              <div>
                <p className="label-micro">{isSuperAdminRole ? 'Super admin paneli' : 'Boshqaruv paneli'}</p>
                <h1 className="text-xl font-black tracking-tight">Django LMS</h1>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <ThemeToggle />
              <div className="hidden items-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold text-text-secondary shadow-premium md:flex">
                <Bell size={16} className="text-primary" />
                <span>{session?.notifications.unread_count || 0} ta yangi bildirishnoma</span>
              </div>

              <Suspense fallback={<div className="h-12 w-40 rounded-2xl border border-border bg-white shadow-premium" />}>
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
                className="rounded-2xl border border-border bg-white p-3 text-text-secondary shadow-premium transition-all hover:border-danger/20 hover:bg-danger/5 hover:text-danger"
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
