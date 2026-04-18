import { cn } from '@/src/lib/utils'

// ---------------------------------------------------------------------------
// Base skeleton primitive
// ---------------------------------------------------------------------------

interface SkeletonProps {
  className?: string
  key?: string | number
}

/**
 * Single rectangular skeleton block.
 * Applies the `.shimmer` sweep animation defined in index.css on top of a
 * slate tinted background so it works in both light and dark modes.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'shimmer rounded-xl bg-slate-200 dark:bg-slate-700',
        className,
      )}
    />
  )
}

// ---------------------------------------------------------------------------
// Composed skeleton layouts
// ---------------------------------------------------------------------------

/**
 * Card skeleton: banner strip + title + two body lines + footer row.
 * Matches the `.course-card` / `.card` visual footprint used throughout the LMS.
 */
export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div
      aria-busy="true"
      aria-label="Yuklanmoqda…"
      className={cn(
        'overflow-hidden rounded-[28px] border border-border bg-card shadow-premium',
        className,
      )}
    >
      {/* image / banner strip */}
      <Skeleton className="h-40 w-full rounded-none" />

      <div className="space-y-3 p-6">
        {/* title */}
        <Skeleton className="h-5 w-3/4" />

        {/* body lines */}
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-5/6" />

        {/* footer row: pill + button placeholder */}
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}

/**
 * Stat card skeleton: large number placeholder + label line + optional icon.
 * Matches the metric/stat widgets on dashboard pages.
 */
export function SkeletonStatCard({ className }: SkeletonProps) {
  return (
    <div
      aria-busy="true"
      aria-label="Yuklanmoqda…"
      className={cn(
        'flex items-center gap-4 rounded-[28px] border border-border bg-card p-6 shadow-premium',
        className,
      )}
    >
      {/* icon block */}
      <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />

      <div className="flex-1 space-y-2">
        {/* large number */}
        <Skeleton className="h-8 w-20" />
        {/* label */}
        <Skeleton className="h-3.5 w-32" />
      </div>
    </div>
  )
}

/**
 * List item skeleton: circular avatar + two lines of text + trailing action.
 * Suitable for student lists, notification rows, message threads, etc.
 */
export function SkeletonListItem({ className }: SkeletonProps) {
  return (
    <div
      aria-busy="true"
      aria-label="Yuklanmoqda…"
      className={cn('flex items-center gap-4 px-4 py-3', className)}
    >
      {/* avatar */}
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />

      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>

      {/* trailing action / timestamp */}
      <Skeleton className="h-3.5 w-14 shrink-0" />
    </div>
  )
}

interface SkeletonTableProps {
  rows?: number
  cols?: number
  className?: string
}

/**
 * Table skeleton: renders a configurable grid of cell placeholders.
 * Includes a header row with wider cells to distinguish it from data rows.
 */
export function SkeletonTable({
  rows = 5,
  cols = 4,
  className,
}: SkeletonTableProps) {
  return (
    <div
      aria-busy="true"
      aria-label="Yuklanmoqda…"
      className={cn('w-full overflow-hidden rounded-[28px] border border-border bg-card shadow-premium', className)}
    >
      {/* header row */}
      <div className="flex gap-4 border-b border-border bg-slate-50/60 px-6 py-4 dark:bg-slate-800/30">
        {Array.from({ length: cols }).map((_, ci) => (
          <Skeleton
            key={ci}
            className={cn(
              'h-4',
              ci === 0 ? 'w-1/4' : 'flex-1',
            )}
          />
        ))}
      </div>

      {/* data rows */}
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, ri) => (
          <div key={ri} className="flex items-center gap-4 px-6 py-4">
            {Array.from({ length: cols }).map((_, ci) => (
              <Skeleton
                key={ci}
                className={cn(
                  'h-3.5',
                  ci === 0 ? 'w-1/4' : 'flex-1',
                  // vary widths slightly so adjacent rows don't look identical
                  ri % 2 === 1 && ci > 0 ? 'opacity-70' : '',
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
