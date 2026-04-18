import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ClipboardEdit,
  ExternalLink,
  FileCode,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  MessageCircle,
  NotebookPen,
  PencilRuler,
  RefreshCw,
  Shield,
  ToggleRight,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { preloadRoute } from '@/src/lib/route-preload';
import { cn } from '@/src/lib/utils';
import type { NavigationItem, SessionUser } from '@/src/types';

const NAV_ICON_MAP: Record<string, LucideIcon> = {
  'arrow-left-right': ArrowLeftRight,
  'bar-chart-3': BarChart3,
  bell: Bell,
  'book-open': BookOpen,
  'calendar-check': CalendarCheck,
  'calendar-days': CalendarDays,
  'calendar-range': CalendarRange,
  'check-circle-2': CheckCircle2,
  'clipboard-edit': ClipboardEdit,
  'file-code': FileCode,
  'file-text': FileText,
  'graduation-cap': GraduationCap,
  'layout-dashboard': LayoutDashboard,
  'list-checks': ListChecks,
  'message-circle': MessageCircle,
  'notebook-pen': NotebookPen,
  'pencil-ruler': PencilRuler,
  'refresh-cw': RefreshCw,
  shield: Shield,
  'toggle-right': ToggleRight,
  'user-check': UserCheck,
  'user-plus': UserPlus,
  users: Users,
  wallet: Wallet,
};

function isSpaPath(path: string) {
  if (!path.startsWith('/')) return false;
  const externalPrefixes = ['/__legacy/', '/api/', '/static/', '/media/', '/auth/'];
  return !externalPrefixes.some((p) => path.startsWith(p));
}

function groupNavigation(items: NavigationItem[]) {
  const groups = new Map<string, NavigationItem[]>();

  for (const item of items) {
    const section = item.section || 'Asosiy modullar';
    if (!groups.has(section)) {
      groups.set(section, []);
    }
    groups.get(section)?.push(item);
  }

  return Array.from(groups.entries()).map(([section, entries]) => ({
    section,
    items: [...entries].sort((a, b) => (a.order_index || 100) - (b.order_index || 100) || a.label.localeCompare(b.label)),
  }));
}

type AppSidebarProps = {
  navigation: NavigationItem[];
  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;
  user?: SessionUser | null;
  onClose: () => void;
};

export function AppSidebar({
  navigation,
  isSidebarOpen,
  isSidebarCollapsed,
  user,
  onClose,
}: AppSidebarProps) {
  const groupedNavigation = groupNavigation(navigation);

  function renderNavigationItem(item: NavigationItem, compact = false) {
    const Icon = item.icon ? (NAV_ICON_MAP[item.icon] || ExternalLink) : ExternalLink;
    const content = (
      <>
        <Icon size={18} className="shrink-0" />
        {!compact ? <span className="truncate">{item.label}</span> : null}
      </>
    );

    if (isSpaPath(item.path)) {
      return (
        <NavLink
          key={`${item.key || item.label}:${item.path}`}
          to={item.path}
          title={compact ? item.label : undefined}
          onClick={onClose}
          onMouseEnter={() => preloadRoute(item.path)}
          onFocus={() => preloadRoute(item.path)}
          className={({ isActive }) =>
            cn(
              'group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all',
              compact ? 'justify-center px-0' : '',
              isActive ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-text-secondary hover:bg-slate-100 hover:text-text-primary',
            )
          }
        >
          {content}
        </NavLink>
      );
    }

    return (
      <a
        key={`${item.key || item.label}:${item.path}`}
        href={item.path}
        title={compact ? item.label : undefined}
        onClick={onClose}
        className={cn(
          'group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-text-secondary transition-all hover:bg-slate-100 hover:text-text-primary',
          compact ? 'justify-center px-0' : '',
        )}
      >
        {content}
        {!compact ? <ExternalLink size={16} className="ml-auto shrink-0 text-text-muted" /> : null}
      </a>
    );
  }

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 h-screen border-r border-border bg-card/90 backdrop-blur-xl transition-all duration-300 ease-out',
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        isSidebarCollapsed ? 'w-24' : 'w-80',
      )}
    >
      <div className="flex h-full flex-col">
        <div className={cn('flex items-center gap-4 border-b border-border/60 p-6', isSidebarCollapsed ? 'justify-center' : 'px-8')}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-xl shadow-primary/20">
            <GraduationCap size={28} />
          </div>
          {!isSidebarCollapsed ? (
            <div className="min-w-0">
              <p className="truncate text-2xl font-black tracking-tight">Django LMS</p>
              <p className="label-micro mt-1">Ta'lim boshqaruv tizimi</p>
            </div>
          ) : null}
        </div>

        <nav className={cn('flex-1 overflow-y-auto px-4 py-5 sidebar-scroll', isSidebarCollapsed ? 'px-3' : 'px-6')}>
          <div className="space-y-6">
            {groupedNavigation.map((group) => (
              <div key={group.section} className="space-y-2">
                {!isSidebarCollapsed ? <p className="px-4 pb-2 label-micro">{group.section}</p> : null}
                <div className="space-y-2">
                  {group.items.map((item) => renderNavigationItem(item, isSidebarCollapsed))}
                </div>
              </div>
            ))}

            {!groupedNavigation.length ? (
              <div className={cn('rounded-3xl border border-dashed border-border bg-slate-50/80 p-4 text-sm font-medium text-text-secondary', isSidebarCollapsed ? 'hidden' : '')}>
                Menyular hali sozlanmagan. Django admin orqali sidebar konfiguratsiyasini to'ldiring.
              </div>
            ) : null}
          </div>
        </nav>

        <div className={cn('border-t border-border/60 p-4', isSidebarCollapsed ? 'px-3' : 'p-6')}>
          <Link
            to="/profile"
          className={cn(
              'flex items-center gap-3 rounded-3xl border border-border/50 bg-background/50 transition-all hover:border-primary/20 hover:bg-card hover:shadow-premium',
              isSidebarCollapsed ? 'justify-center px-3 py-4' : 'p-4',
            )}
            title={isSidebarCollapsed ? user?.full_name || 'Profil' : undefined}
            onMouseEnter={() => preloadRoute('/profile')}
            onFocus={() => preloadRoute('/profile')}
          >
            <img
              src={user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.full_name || 'User')}&background=4361ee&color=fff`}
              alt={user?.full_name || 'User'}
              className="h-12 w-12 rounded-2xl object-cover"
            />
            {!isSidebarCollapsed ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-text-primary">{user?.full_name}</p>
                <p className="label-micro mt-1 text-primary">{user?.active_role_label}</p>
              </div>
            ) : null}
          </Link>
        </div>
      </div>
    </aside>
  );
}
