import { cn } from '@/src/lib/utils'
import { Calendar, Clock, Lock, PlayCircle, BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'

interface UpcomingItemProps {
  id: number
  name: string
  courseName: string
  startDatetime: string | null
  endDatetime: string | null
  durationMinutes: number
  status: string
  statusLabel: string
  attemptsLeft?: number
  spaPath?: string
  proctoring?: boolean
}

export function UpcomingItem({
  name,
  courseName,
  startDatetime,
  durationMinutes,
  status,
  statusLabel,
  attemptsLeft = 0,
  spaPath,
  proctoring = false
}: UpcomingItemProps) {
  
  const statusConfig: Record<string, { border: string; badge: string }> = {
    open: { border: 'border-l-success', badge: 'status-pill-success' },
    scheduled: { border: 'border-l-primary', badge: 'status-pill-primary' },
    in_progress: { border: 'border-l-warning', badge: 'status-pill-warning' },
    closed: { border: 'border-l-slate-300', badge: 'status-pill-muted' }
  }

  const config = statusConfig[status] || statusConfig.closed

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Intl.DateTimeFormat('uz-UZ', { 
      day: 'numeric', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    }).format(new Date(dateStr))
  }

  return (
    <div className={cn(
      "card p-5 border-l-4 transition-all hover:shadow-hover group bg-white",
      config.border
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
             <h4 className="font-bold text-sm text-text-primary truncate transition-colors group-hover:text-primary">
               {name}
             </h4>
             {proctoring && (
               <Lock size={12} className="text-amber-500" title="Proctoring yoqilgan" />
             )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-secondary font-semibold">
            <BookOpen size={12} className="text-primary" />
            <span className="truncate">{courseName}</span>
          </div>
        </div>
        <span className={cn("status-pill scale-75 origin-right whitespace-nowrap", config.badge)}>
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-text-secondary">
          <Calendar size={13} className="text-text-muted" />
          {formatDate(startDatetime)}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-text-secondary">
          <Clock size={13} className="text-text-muted" />
          {durationMinutes} daqiqa
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-text-secondary">
          <span className="text-text-muted">Urinish:</span>
          {attemptsLeft} ta
        </div>
      </div>

      {status === 'open' && attemptsLeft > 0 && spaPath && (
        <div className="mt-5 pt-4 border-t border-border/40">
           <Link 
            to={spaPath} 
            className="btn btn-primary w-full h-10 text-xs gap-2"
           >
             <PlayCircle size={14} />
             Testni boshlash
           </Link>
        </div>
      )}
    </div>
  )
}
