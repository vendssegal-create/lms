import { CheckCircle2, Circle, XCircle, Clock, ArrowRightCircle } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export interface WorkflowEvent {
  id: number;
  action: string;
  from_status: string;
  to_status: string;
  actor_name: string | null;
  comment: string;
  created_at: string;
}

const ACTION_CONFIG: Record<string, {
  label: string;
  icon: typeof CheckCircle2;
  iconClass: string;
}> = {
  submitted:              { label: 'Ariza yuborildi',          icon: ArrowRightCircle, iconClass: 'text-blue-500' },
  submitted_to_accounting:{ label: 'Buxgalteriyaga yuborildi', icon: ArrowRightCircle, iconClass: 'text-indigo-500' },
  payment_verified:       { label: "To'lov tasdiqlandi",        icon: CheckCircle2,     iconClass: 'text-green-500' },
  payment_approved:       { label: "To'lov tasdiqlandi",        icon: CheckCircle2,     iconClass: 'text-green-500' },
  payment_rejected:       { label: "To'lov rad etildi",         icon: XCircle,          iconClass: 'text-red-500' },
  supervisor_approved:    { label: 'Rahbar tasdiqladi',         icon: CheckCircle2,     iconClass: 'text-emerald-500' },
  supervisor_rejected:    { label: 'Rahbar qaytardi',           icon: XCircle,          iconClass: 'text-orange-500' },
  cancelled:              { label: 'Bekor qilindi',             icon: XCircle,          iconClass: 'text-gray-400' },
  completed:              { label: 'Yakunlandi',               icon: CheckCircle2,     iconClass: 'text-teal-500' },
  contract_attached:      { label: 'Shartnoma yuklandi',        icon: Circle,           iconClass: 'text-slate-400' },
  receipt_attached:       { label: 'Kvitansiya yuklandi',       icon: Circle,           iconClass: 'text-slate-400' },
  cycle_opened:           { label: 'Sikl ochildi',             icon: CheckCircle2,     iconClass: 'text-green-500' },
  cycle_closed:           { label: 'Sikl yopildi',             icon: XCircle,          iconClass: 'text-orange-500' },
  cycle_archived:         { label: 'Sikl arxivlandi',          icon: Clock,            iconClass: 'text-zinc-400' },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  events: WorkflowEvent[];
  className?: string;
  compact?: boolean;
}

export default function WorkflowTimeline({ events, className, compact = false }: Props) {
  if (!events || events.length === 0) {
    return (
      <div className={cn('py-4 text-center text-sm text-text-secondary', className)}>
        Hodisalar yo'q
      </div>
    );
  }

  const sorted = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <ol className={cn('relative border-l border-border', className)}>
      {sorted.map((event, idx) => {
        const cfg = ACTION_CONFIG[event.action] ?? {
          label: event.action,
          icon: Circle,
          iconClass: 'text-slate-400',
        };
        const Icon = cfg.icon;
        return (
          <li key={event.id} className={cn('ml-4', idx !== sorted.length - 1 && 'mb-4')}>
            <div className="absolute -left-2 flex h-4 w-4 items-center justify-center">
              <Icon size={16} className={cfg.iconClass} />
            </div>
            <div className="ml-2">
              <p className={cn('font-medium', compact ? 'text-xs' : 'text-sm')}>
                {cfg.label}
              </p>
              {!compact && (
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                  <time>{formatDate(event.created_at)}</time>
                  {event.actor_name && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {event.actor_name}
                    </span>
                  )}
                </div>
              )}
              {event.comment && (
                <p className="mt-1 rounded-md bg-muted px-2 py-1 text-xs text-text-secondary italic">
                  "{event.comment}"
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
