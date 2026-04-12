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
        <Icon size={18} className="shrink-0 opacity-90" />
        {!compact ? <span className="truncate">{item.label}</span> : null}
      </>
    );

    const itemBase = cn(
      'group relative flex items-center gap-3 rounded-xl py-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/80',
      compact ? 'justify-center px-0' : 'px-3',
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
              itemBase,
              isActive
                ? 'bg-emerald-500/15 text-emerald-300 before:absolute before:left-0 before:top-1/2 before:h-7 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-emerald-400'
                : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100',
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
          itemBase,
          'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100',
        )}
      >
        {content}
        {!compact ? <ExternalLink size={15} className="ml-auto shrink-0 text-slate-500" /> : null}
      </a>
    );
  }

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 h-screen border-r border-slate-800/90 bg-slate-950 text-slate-100 shadow-[4px_0_24px_rgba(0,0,0,0.12)] transition-all duration-300 ease-out',
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        isSidebarCollapsed ? 'w-20' : 'w-72',
      )}
    >
      <div className="flex h-full flex-col">
        <div
          className={cn(
            'flex items-center gap-3 border-b border-slate-800/80 py-5',
            isSidebarCollapsed ? 'justify-center px-3' : 'px-5',
          )}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-emerald-900/40">
            <GraduationCap size={24} />
          </div>
          {!isSidebarCollapsed ? (
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-bold tracking-tight text-white">HEMIS LMS</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Ta'lim platformasi</p>
            </div>
          ) : null}
        </div>

        <nav className={cn('flex-1 overflow-y-auto py-4 sidebar-scroll', isSidebarCollapsed ? 'px-2.5' : 'px-3')}>
          <div className="space-y-5">
            {groupedNavigation.map((group) => (
              <div key={group.section} className="space-y-1.5">
                {!isSidebarCollapsed ? (
                  <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{group.section}</p>
                ) : null}
                <div className="space-y-1">{group.items.map((item) => renderNavigationItem(item, isSidebarCollapsed))}</div>
              </div>
            ))}

            {!groupedNavigation.length ? (
              <div
                className={cn(
                  'rounded-2xl border border-dashed border-slate-700/80 bg-slate-900/50 p-4 text-xs font-medium leading-relaxed text-slate-400',
                  isSidebarCollapsed ? 'hidden' : '',
                )}
              >
                Menyular hali sozlanmagan. Django admin orqali sidebar konfiguratsiyasini to'ldiring.
              </div>
            ) : null}
          </div>
        </nav>

        <div className={cn('border-t border-slate-800/80 p-3', isSidebarCollapsed ? 'px-2' : 'px-3 pb-4')}>
          <Link
            to="/profile"
            className={cn(
              'flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 transition-colors hover:border-emerald-500/30 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/80',
              isSidebarCollapsed ? 'justify-center px-2 py-3' : 'p-3',
            )}
            title={isSidebarCollapsed ? user?.full_name || 'Profil' : undefined}
            onMouseEnter={() => preloadRoute('/profile')}
            onFocus={() => preloadRoute('/profile')}
          >
            <img
              src={
                user?.avatar_url ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.full_name || 'User')}&background=059669&color=fff`
              }
              alt={user?.full_name || 'User'}
              className="h-10 w-10 rounded-lg object-cover ring-2 ring-slate-800"
            />
            {!isSidebarCollapsed ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{user?.full_name}</p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400/90">{user?.active_role_label}</p>
              </div>
            ) : null}
          </Link>
        </div>
      </div>
    </aside>
  );
}
