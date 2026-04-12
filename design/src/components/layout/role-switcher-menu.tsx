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
        className="flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold text-text-primary shadow-premium transition-all hover:border-primary/20"
      >
        <UserCircle2 size={18} className="text-primary" />
        <span>{activeRoleLabel}</span>
        <ChevronDown size={16} className="text-text-muted" />
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-3xl border border-border bg-white shadow-2xl">
          <div className="border-b border-border/60 px-5 py-4">
            <p className="label-micro">Faol rol</p>
            <p className="mt-2 text-sm font-black text-text-primary">{activeRoleLabel}</p>
          </div>
          <div className="p-2">
            {availableRoles.map((role) => (
              <button
                type="button"
                key={role.value}
                onClick={() => void onSwitchRole(role.value)}
                className={cn(
                  'flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-bold transition-all',
                  role.value === activeRole ? 'bg-primary text-white' : 'text-text-secondary hover:bg-slate-100 hover:text-text-primary',
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
