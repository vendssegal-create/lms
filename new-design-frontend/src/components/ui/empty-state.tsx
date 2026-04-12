import type { LucideIcon } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-5 rounded-[32px] border-2 border-dashed border-border bg-slate-50/50 px-8 py-16 text-center',
        className,
      )}
    >
      <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] bg-white shadow-premium">
        <div className="absolute inset-0 animate-pulse rounded-[28px] bg-primary/5" />
        <Icon size={36} className="text-primary/60" />
      </div>

      <div className="max-w-sm">
        <h3 className="text-xl font-black text-text-primary">{title}</h3>
        <p className="mt-2 text-sm font-medium leading-7 text-text-secondary">{description}</p>
      </div>

      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="btn btn-primary mt-2"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
