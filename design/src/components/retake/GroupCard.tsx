import { BookOpen, Calendar, ChevronRight, User, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/src/lib/utils';
import StatusBadge from './StatusBadge';

export interface GroupCardData {
  id: number;
  code: string;
  subject_name: string;
  subject_code?: string;
  status: string;
  capacity: number;
  members_count: number;
  teacher_name: string | null;
  cycle_name: string;
  lms_course_id?: number | null;
  next_assessment?: string | null;
}

interface Props {
  group: GroupCardData;
  linkTo?: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'danger' | 'ghost';
  }>;
  className?: string;
}

export default function GroupCard({ group, linkTo, actions, className }: Props) {
  const fill = group.capacity > 0 ? (group.members_count / group.capacity) * 100 : 0;

  const Wrapper = linkTo ? Link : 'div';

  return (
    <Wrapper
      to={linkTo as string}
      className={cn(
        'block rounded-2xl border border-border bg-card overflow-hidden transition-all',
        linkTo && 'hover:border-primary/40 hover:shadow-sm',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 p-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <BookOpen size={16} className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-text-primary">{group.subject_name}</p>
            <p className="text-xs text-text-secondary">
              {group.code}{group.subject_code ? ` · ${group.subject_code}` : ''}
            </p>
          </div>
        </div>
        <StatusBadge status={group.status} size="sm" />
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-2 px-4 pb-3 text-xs text-text-secondary">
        <div className="flex items-center gap-1.5">
          <User size={12} />
          <span className="truncate">{group.teacher_name ?? "O'qituvchi belgilanmagan"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users size={12} />
          <span>{group.members_count} / {group.capacity || '∞'} talaba</span>
        </div>
        {group.next_assessment && (
          <div className="col-span-2 flex items-center gap-1.5">
            <Calendar size={12} />
            <span>Keyingi: {group.next_assessment}</span>
          </div>
        )}
      </div>

      {/* Capacity bar */}
      {group.capacity > 0 && (
        <div className="px-4 pb-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                fill >= 90 ? 'bg-danger' : fill >= 60 ? 'bg-warning' : 'bg-primary',
              )}
              style={{ width: `${Math.min(fill, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      {(actions && actions.length > 0) || linkTo ? (
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <div className="flex gap-2">
            {actions?.map((action, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
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
          {linkTo && <ChevronRight size={14} className="text-text-secondary" />}
        </div>
      ) : null}
    </Wrapper>
  );
}
