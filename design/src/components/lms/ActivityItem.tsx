import { cn } from '@/src/lib/utils'
import { Link } from 'react-router-dom'

interface ActivityItemProps {
  testName: string
  studentName?: string
  score: number
  maxScore: number
  finishedAt: string | null
  testPath?: string
}

export function ActivityItem({
  testName,
  studentName,
  score,
  maxScore,
  finishedAt,
  testPath
}: ActivityItemProps) {
  
  const percentage = (score / maxScore) * 100

  const getScoreColor = (p: number) => {
    if (p >= 86) return 'border-emerald-400 bg-emerald-50 text-emerald-700'
    if (p >= 71) return 'border-blue-400 bg-blue-50 text-blue-700'
    if (p >= 56) return 'border-amber-400 bg-amber-50 text-amber-700'
    return 'border-rose-400 bg-rose-50 text-rose-700'
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Intl.DateTimeFormat('uz-UZ', { 
      day: 'numeric', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    }).format(new Date(dateStr))
  }

  const Content = (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-transparent hover:border-border/60 hover:shadow-premium transition-all">
      {/* Score Circle */}
      <div className={cn(
        "h-12 w-12 rounded-full border-4 flex items-center justify-center font-black text-sm shrink-0",
        getScoreColor(percentage)
      )}>
        {score}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-sm text-text-primary truncate" title={testName}>
          {testName}
        </h4>
        {studentName && (
          <p className="text-[11px] font-semibold text-text-secondary truncate mt-0.5">
            {studentName}
          </p>
        )}
        <p className="text-[11px] font-bold text-text-muted mt-0.5">
          {score} / {maxScore} ball
        </p>
      </div>

      {/* Timestamp */}
      <div className="text-right shrink-0">
        <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
          {formatDate(finishedAt)}
        </p>
      </div>
    </div>
  )

  if (testPath) {
    return (
      <Link to={testPath} className="block no-underline">
        {Content}
      </Link>
    )
  }

  return Content
}
