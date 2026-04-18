import { Calendar, ChevronRight, FileText, Lock, RefreshCw, Archive } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import StatusBadge from './StatusBadge';

export interface CycleCardData {
  id: number;
  name: string;
  academic_year: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  max_allowed_credits: string | number;
  applications_count?: number;
  created_at: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

interface Action {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'danger' | 'ghost';
  disabled?: boolean;
}

interface Props {
  cycle: CycleCardData;
  actions?: Action[];
  expanded?: boolean;
  onToggle?: () => void;
  className?: string;
}

const STATUS_ICON: Record<string, typeof RefreshCw> = {
  draft: FileText,
  open: RefreshCw,
  closed: Lock,
  archived: Archive,
};

export default function CycleCard({ cycle, actions, expanded, onToggle, className }: Props) {
  const Icon = STATUS_ICON[cycle.status] ?? FileText;

  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card overflow-hidden transition-all',
        className,
      )}
    >
      {/* Main row */}
      <div
        className={cn(
          'flex items-center gap-3 p-4',
          onToggle && 'cursor-pointer hover:bg-muted/40',
        )}
        onClick={onToggle}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Icon size={18} className="text-primary" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-text-primary">{cycle.name}</p>
            <StatusBadge status={cycle.status} size="sm" />
          </div>
          <p className="text-xs text-text-secondary">{cycle.academic_year}</p>
        </div>

        {cycle.applications_count !== undefined && (
          <div className="shrink-0 text-right">
            <p className="text-lg font-bold text-text-primary">{cycle.applications_count}</p>
            <p className="text-xs text-text-secondary">ariza</p>
          </div>
        )}

        {onToggle && (
          <ChevronRight
            size={16}
            className={cn('shrink-0 text-text-secondary transition-transform', expanded && 'rotate-90')}
          />
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border px-4 py-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <dt className="text-text-secondary">Boshlanishi</dt>
              <dd className="font-medium text-text-primary">{formatDate(cycle.starts_at)}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Tugashi</dt>
              <dd className="font-medium text-text-primary">{formatDate(cycle.ends_at)}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Max kredit</dt>
              <dd className="font-medium text-text-primary">{cycle.max_allowed_credits}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Yaratildi</dt>
              <dd className="font-medium text-text-primary">{formatDate(cycle.created_at)}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Actions */}
      {actions && actions.length > 0 && (
        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); action.onClick(); }}
              disabled={action.disabled}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
                action.variant === 'primary' && 'bg-primary text-white hover:bg-primary/90',
                action.variant === 'danger' && 'bg-danger/10 text-danger hover:bg-danger/20',
                (!action.variant || action.variant === 'ghost') &&
                  'bg-muted text-text-secondary hover:bg-muted/80',
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
