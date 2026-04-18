import { ChevronRight, CreditCard, FileText, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/src/lib/utils';
import StatusBadge from './StatusBadge';

export interface ApplicationCardData {
  id: number;
  cycle_name: string;
  academic_year: string;
  status: string;
  declared_amount: string | number | null;
  accountant_amount: string | number | null;
  contract_attached: boolean;
  receipt_attached: boolean;
  items_count?: number;
  items?: Array<{
    id: number;
    subject_name: string;
    status: string;
    group_code?: string | null;
  }>;
  created_at: string;
  submitted_at: string | null;
}

function formatMoney(value: string | number | null): string {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat('uz-UZ').format(Number(value)) + " so'm";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

interface Props {
  application: ApplicationCardData;
  className?: string;
  linkTo?: string;
}

export default function ApplicationCard({ application, className, linkTo }: Props) {
  const money = application.accountant_amount
    ? formatMoney(application.accountant_amount)
    : formatMoney(application.declared_amount);

  const Wrapper = linkTo ? Link : 'div';

  return (
    <Wrapper
      to={linkTo as string}
      className={cn(
        'block rounded-2xl border border-border bg-card p-4 transition-all',
        linkTo && 'hover:border-primary/40 hover:shadow-sm',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-primary">
            {application.cycle_name}
          </p>
          <p className="text-xs text-text-secondary">{application.academic_year}</p>
        </div>
        <StatusBadge status={application.status} size="sm" />
      </div>

      {/* Items preview */}
      {application.items && application.items.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {application.items.slice(0, 3).map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <FileText size={12} className="shrink-0 text-text-secondary" />
                <span className="truncate text-xs text-text-primary">{item.subject_name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {item.group_code && (
                  <span className="flex items-center gap-1 text-xs text-text-secondary">
                    <Users size={10} />
                    {item.group_code}
                  </span>
                )}
                <StatusBadge status={item.status} size="sm" />
              </div>
            </li>
          ))}
          {application.items.length > 3 && (
            <li className="text-xs text-text-secondary">
              +{application.items.length - 3} ta fan
            </li>
          )}
        </ul>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          <CreditCard size={12} />
          <span>{money}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-secondary">
            {formatDate(application.created_at)}
          </span>
          {linkTo && <ChevronRight size={14} className="text-text-secondary" />}
        </div>
      </div>
    </Wrapper>
  );
}
