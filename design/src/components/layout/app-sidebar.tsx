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
  Search,
  Shield,
  ToggleRight,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useI18n } from '@/src/features/i18n/i18n-context';
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
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section)?.push(item);
  }
  return Array.from(groups.entries()).map(([section, entries]) => ({
    section,
    items: [...entries].sort(
      (a, b) => (a.order_index || 100) - (b.order_index || 100) || a.label.localeCompare(b.label),
    ),
  }));
}

function getInitials(fullName?: string | null): string {
  if (!fullName) return 'U';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

type AppSidebarProps = {
  navigation: NavigationItem[];
  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;
  user?: SessionUser | null;
  unreadMessages?: number;
  unreadNotifications?: number;
  onClose: () => void;
};

export function AppSidebar({
  navigation,
  isSidebarOpen,
  isSidebarCollapsed,
  user,
  unreadMessages = 0,
  unreadNotifications = 0,
  onClose,
}: AppSidebarProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const touchStartXRef = useRef<number | null>(null);
  const touchLastXRef = useRef<number | null>(null);

  const filteredNavigation = searchQuery.trim()
    ? navigation.filter((item) =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : navigation;

  const groupedNavigation = groupNavigation(filteredNavigation);

  function badgeCount(path: string): number {
    if (path === '/messages') return unreadMessages;
    if (path === '/notifications') return unreadNotifications;
    return 0;
  }

  function renderNavigationItem(item: NavigationItem, compact = false) {
    const Icon = item.icon ? (NAV_ICON_MAP[item.icon] || ExternalLink) : ExternalLink;
    const badge = badgeCount(item.path);

    const content = (
      <>
        <span className="relative shrink-0">
          <Icon size={18} />
          {compact && badge > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-0.5 text-[9px] font-black text-white">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </span>
        {!compact && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            {badge > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-black text-white shadow-sm">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </>
        )}
      </>
    );

    const activeClass = cn(
      'group flex items-center gap-3 rounded-2xl bg-gradient-to-r from-primary to-secondary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/25',
      compact && 'justify-center px-0',
    );
    const inactiveClass = cn(
      'group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-text-secondary transition-all duration-200 hover:bg-primary/8 hover:text-primary',
      compact && 'justify-center px-0',
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
          className={({ isActive }) => (isActive ? activeClass : inactiveClass)}
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
        className={inactiveClass}
      >
        {content}
        {!compact && (
          <ExternalLink size={14} className="ml-auto shrink-0 text-text-muted opacity-60" />
        )}
      </a>
    );
  }

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 h-screen border-r border-border/50 bg-card/95 backdrop-blur-2xl transition-all duration-300 ease-out',
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        isSidebarCollapsed ? 'w-24' : 'w-80',
      )}
      onTouchStart={(e) => {
        if (!isSidebarOpen) return;
        touchStartXRef.current = e.touches[0]?.clientX ?? null;
        touchLastXRef.current = touchStartXRef.current;
      }}
      onTouchMove={(e) => {
        if (!isSidebarOpen) return;
        touchLastXRef.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={() => {
        if (!isSidebarOpen) return;
        const startX = touchStartXRef.current;
        const endX = touchLastXRef.current;
        touchStartXRef.current = null;
        touchLastXRef.current = null;
        if (startX === null || endX === null) return;
        const delta = endX - startX;
        // swipe left to close
        if (delta < -80) onClose();
      }}
    >
      <div className="flex h-full flex-col">

        {/* ── Logo ── */}
        <div
          className={cn(
            'relative flex shrink-0 items-center gap-4 border-b border-border/40',
            isSidebarCollapsed ? 'justify-center px-0 py-6' : 'px-7 py-6',
          )}
        >
          {/* Top gradient bar */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-primary via-secondary to-primary opacity-80" />

          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white shadow-xl shadow-primary/30">
            <GraduationCap size={26} />
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent" />
          </div>

          {!isSidebarCollapsed && (
            <div className="min-w-0">
              <p className="truncate text-xl font-black tracking-tight text-text-primary">
                Django LMS
              </p>
              <p className="mt-0.5 truncate text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                {t.common.loading === 'Yuklanmoqda...' ? 'HEMIS integratsiyasi' :
                 t.common.loading === 'Загрузка...' ? 'Интеграция с HEMIS' : 'HEMIS Integration'}
              </p>
            </div>
          )}
        </div>

        {/* ── Search ── */}
        {!isSidebarCollapsed && (
          <div className="shrink-0 px-5 py-3">
            <div className="flex items-center gap-2.5 rounded-2xl border border-border/60 bg-background/60 px-3.5 py-2.5 transition-all focus-within:border-primary/40 focus-within:bg-card focus-within:shadow-sm">
              <Search size={15} className="shrink-0 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.common.search}
                className="w-full bg-transparent text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        <nav
          className={cn(
            'flex-1 overflow-y-auto py-3 sidebar-scroll',
            isSidebarCollapsed ? 'px-3' : 'px-4',
          )}
        >
          <div className="space-y-5">
            {groupedNavigation.map((group) => (
              <div key={group.section} className="space-y-1">
                {!isSidebarCollapsed && (
                  <p className="mb-2 px-4 text-[10px] font-black uppercase tracking-widest text-text-muted/70">
                    {group.section}
                  </p>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => renderNavigationItem(item, isSidebarCollapsed))}
                </div>
              </div>
            ))}

            {!groupedNavigation.length && !isSidebarCollapsed && (
              <div className="rounded-3xl border border-dashed border-border bg-slate-50/80 p-4 text-sm font-medium text-text-secondary dark:bg-slate-900/40">
                {searchQuery
                  ? t.common.noData
                  : "Menyular hali sozlanmagan. Django admin orqali sidebar konfiguratsiyasini to'ldiring."}
              </div>
            )}
          </div>
        </nav>

        {/* ── User card ── */}
        <div
          className={cn(
            'shrink-0 border-t border-border/40',
            isSidebarCollapsed ? 'p-3' : 'p-4',
          )}
        >
          <Link
            to="/profile"
            className={cn(
              'group flex items-center gap-3 rounded-3xl border border-border/40 bg-background/50 transition-all duration-200 hover:border-primary/30 hover:bg-card hover:shadow-premium',
              isSidebarCollapsed ? 'justify-center p-3' : 'p-3.5',
            )}
            title={isSidebarCollapsed ? (user?.full_name || t.nav.profile) : undefined}
            onMouseEnter={() => preloadRoute('/profile')}
            onFocus={() => preloadRoute('/profile')}
          >
            {/* Avatar */}
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border-2 border-primary/20 shadow-sm ring-2 ring-primary/10 transition-all group-hover:ring-primary/25">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name || 'Avatar'}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary to-secondary text-sm font-black text-white">
                  {getInitials(user?.full_name)}
                </div>
              )}
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-success" />
            </div>

            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-text-primary">
                  {user?.full_name || t.nav.profile}
                </p>
                <p className="mt-0.5 truncate text-xs font-semibold text-primary">
                  {user?.active_role_label || '—'}
                </p>
              </div>
            )}
          </Link>
        </div>
      </div>
    </aside>
  );
}
