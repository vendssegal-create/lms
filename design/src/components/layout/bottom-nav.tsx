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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white/90 px-2 pb-safe backdrop-blur-xl lg:hidden dark:bg-dark-card/90">
      <div className="flex justify-around">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 px-4 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors',
                isActive ? 'text-primary' : 'text-text-muted',
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn('relative rounded-2xl p-2 transition-colors', isActive ? 'bg-primary/10' : '')}>
                  <Icon size={20} />
                  {path === '/messages' && unreadMessages > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-black text-white">
                      {unreadMessages > 9 ? '9+' : unreadMessages}
                    </span>
                  ) : null}
                </div>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
