import { BarChart3, BookOpen, FlaskConical, Home, MessageCircle } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/src/lib/utils';

const NAV_ITEMS = [
  { path: '/', icon: Home, label: 'Bosh sahifa' },
  { path: '/courses', icon: BookOpen, label: 'Kurslar' },
  { path: '/tests', icon: FlaskConical, label: 'Testlar' },
  { path: '/grades', icon: BarChart3, label: 'Baholar' },
  { path: '/messages', icon: MessageCircle, label: 'Xabarlar' },
];

export function BottomNav({ unreadMessages }: { unreadMessages: number }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 pb-safe backdrop-blur-xl lg:hidden dark:border-dark-border dark:bg-dark-card/95"
      aria-label="Asosiy navigatsiya"
    >
      <div className="flex justify-around px-1">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              cn(
                'flex min-h-[48px] min-w-[48px] flex-col items-center justify-center gap-0.5 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                isActive ? 'text-primary' : 'text-text-muted',
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    'relative rounded-xl p-2 transition-colors',
                    isActive ? 'bg-primary/12 text-primary' : 'text-text-muted',
                  )}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.25 : 2} aria-hidden />
                  {path === '/messages' && unreadMessages > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-0.5 text-[9px] font-bold text-white">
                      {unreadMessages > 9 ? '9+' : unreadMessages}
                    </span>
                  ) : null}
                </div>
                <span className="max-w-[4.5rem] truncate">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
