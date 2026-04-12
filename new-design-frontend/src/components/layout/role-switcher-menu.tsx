import { ChevronDown, UserCircle2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { AvailableRole } from '@/src/types';

type RoleSwitcherMenuProps = {
  activeRole: string;
  activeRoleLabel?: string;
  availableRoles: AvailableRole[];
  isOpen: boolean;
  onToggle: () => void;
  onSwitchRole: (role: string) => Promise<void>;
};

export function RoleSwitcherMenu({
  activeRole,
  activeRoleLabel,
  availableRoles,
  isOpen,
  onToggle,
  onSwitchRole,
}: RoleSwitcherMenuProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="flex max-w-[200px] items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-text-primary shadow-sm transition-colors hover:border-primary/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:max-w-none sm:gap-3 sm:px-4 sm:py-2.5"
      >
        <UserCircle2 size={18} className="text-primary" />
        <span>{activeRoleLabel}</span>
        <ChevronDown size={16} className="text-text-muted" />
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl dark:border-dark-border dark:bg-dark-card">
          <div className="border-b border-border/60 px-4 py-3 dark:border-dark-border/80">
            <p className="label-micro">Faol rol</p>
            <p className="mt-1.5 text-sm font-bold text-text-primary">{activeRoleLabel}</p>
          </div>
          <div className="p-2">
            {availableRoles.map((role) => (
              <button
                type="button"
                key={role.value}
                onClick={() => void onSwitchRole(role.value)}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  role.value === activeRole ? 'bg-primary text-white' : 'text-text-secondary hover:bg-stone-100 hover:text-text-primary dark:hover:bg-dark-surface',
                )}
              >
                <span>{role.label}</span>
                {role.value === activeRole ? <span className="text-xs uppercase tracking-widest">Active</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
