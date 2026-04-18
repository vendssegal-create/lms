import { cn } from '@/src/lib/utils'

export type StatusVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'accent'
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'cancelled'
  | 'returned'

export interface StatusBadgeProps {
  variant?: StatusVariant
  label: string
  size?: 'sm' | 'md'
  dot?: boolean
  className?: string
}

// Maps semantic LMS status variants to their CSS class sets.
// Resolved variants (draft, in_review, etc.) are aliased to base variants
// so the style map stays flat and easy to extend.
const RESOLVED_VARIANT: Record<StatusVariant, string> = {
  // base variants
  default:   'status-pill status-pill-muted',
  primary:   'status-pill status-pill-primary',
  secondary: 'status-pill bg-secondary/10 text-secondary',
  success:   'status-pill status-pill-success',
  warning:   'status-pill status-pill-warning',
  danger:    'status-pill status-pill-danger',
  info:      'status-pill status-info',
  accent:    'status-pill status-accent',
  // LMS-specific semantic aliases
  draft:     'status-pill status-pill-muted',
  in_review: 'status-pill status-info',
  approved:  'status-pill status-pill-success',
  completed: 'status-pill status-pill-success',
  rejected:  'status-pill status-pill-danger',
  cancelled: 'status-pill status-pill-danger',
  returned:  'status-pill status-pill-warning',
}

// Dot colors follow the same semantic grouping as the badge background tints.
const DOT_COLOR: Record<StatusVariant, string> = {
  default:   'bg-slate-400',
  primary:   'bg-primary',
  secondary: 'bg-secondary',
  success:   'bg-success',
  warning:   'bg-warning',
  danger:    'bg-danger',
  info:      'bg-info',
  accent:    'bg-accent',
  draft:     'bg-slate-400',
  in_review: 'bg-info',
  approved:  'bg-success',
  completed: 'bg-success',
  rejected:  'bg-danger',
  cancelled: 'bg-danger',
  returned:  'bg-warning',
}

const SIZE_CLASS: Record<NonNullable<StatusBadgeProps['size']>, string> = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-xs px-3 py-1',
}

export function StatusBadge({
  variant = 'default',
  label,
  size = 'md',
  dot = false,
  className,
}: StatusBadgeProps) {
  // The base `.status-pill` class provides rounded-full + font-extrabold +
  // uppercase + tracking-widest. Size overrides the padding/text-size defaults.
  const baseClasses = RESOLVED_VARIANT[variant]
  const sizeClasses = SIZE_CLASS[size]

  return (
    <span
      className={cn(
        baseClasses,
        sizeClasses,
        'gap-1.5',
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', DOT_COLOR[variant])}
        />
      )}
      {label}
    </span>
  )
}

/**
 * Maps common LMS status strings (from model TextChoices) to StatusVariant.
 * Performs a case-insensitive lookup so both 'APPROVED' and 'approved' resolve.
 *
 * @example
 * <StatusBadge variant={getStatusVariant(application.status)} label={application.status} />
 */
export function getStatusVariant(status: string): StatusVariant {
  switch (status.toLowerCase()) {
    case 'draft':
      return 'draft'
    case 'pending':
    case 'in_review':
    case 'under_review':
    case 'submitted':
      return 'in_review'
    case 'approved':
    case 'active':
    case 'published':
      return 'approved'
    case 'completed':
    case 'passed':
    case 'graded':
      return 'completed'
    case 'rejected':
    case 'failed':
    case 'overdue':
      return 'rejected'
    case 'cancelled':
    case 'canceled':
    case 'deleted':
      return 'cancelled'
    case 'returned':
    case 'revision':
    case 'needs_revision':
      return 'returned'
    case 'info':
    case 'new':
      return 'info'
    case 'warning':
      return 'warning'
    default:
      return 'default'
  }
}
