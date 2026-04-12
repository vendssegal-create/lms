import { cn } from '@/src/lib/utils'
import { ArrowUpRight, User } from 'lucide-react'
import { Link } from 'react-router-dom'

interface GradeRowProps {
  key?: number
  courseName: string
  teacherName?: string
  current?: number | null
  currentMax?: number
  midterm?: number | null
  midtermMax?: number
  final?: number | null
  finalMax?: number
  total?: number | null
  courseHref: string
}

export function GradeRow({
  courseName,
  teacherName,
  current,
  currentMax = 30,
  midterm,
  midtermMax = 30,
  final,
  finalMax = 40,
  total,
  courseHref
}: GradeRowProps) {
  
  const getProgressWidth = (val: number | null | undefined, max: number) => {
    if (val === null || val === undefined) return '0%'
    return `${Math.min((val / max) * 100, 100)}%`
  }

  const getTotalColor = (score: number | null | undefined) => {
    if (score === null || score === undefined) return 'bg-slate-100 text-slate-500'
    if (score >= 86) return 'bg-emerald-100 text-emerald-700'
    if (score >= 71) return 'bg-blue-100 text-blue-700'
    if (score >= 56) return 'bg-amber-100 text-amber-700'
    return 'bg-rose-100 text-rose-700'
  }

  return (
    <div className="flex flex-col md:flex-row items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors border-b border-border/40 last:border-0 group">
      {/* Course Info */}
      <div className="flex-1 min-w-0 w-full">
        <h4 className="font-bold text-text-primary truncate max-w-[200px]" title={courseName}>
          {courseName}
        </h4>
        <div className="flex items-center gap-1.5 mt-0.5 opacity-70">
          <User size={12} className="text-text-muted" />
          <span className="text-[11px] font-semibold text-text-secondary truncate">
            {teacherName || 'O\'qituvchi belgilanmagan'}
          </span>
        </div>
      </div>

      {/* Scores Grid */}
      <div className="flex flex-wrap items-center gap-3 md:gap-6 w-full md:w-auto">
        {/* Current */}
        <div className="flex flex-col min-w-[60px]">
          <span className="label-micro text-[9px] opacity-60">Joriy</span>
          <span className="text-xs font-bold text-text-primary">{current ?? '-'}/{currentMax}</span>
          <div className="h-1.5 w-full bg-slate-100 rounded-full mt-1 overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500" 
              style={{ width: getProgressWidth(current, currentMax) }}
            />
          </div>
        </div>

        {/* Midterm */}
        <div className="flex flex-col min-w-[60px]">
          <span className="label-micro text-[9px] opacity-60">Oraliq</span>
          <span className="text-xs font-bold text-text-primary">{midterm ?? '-'}/{midtermMax}</span>
          <div className="h-1.5 w-full bg-slate-100 rounded-full mt-1 overflow-hidden">
            <div 
              className="h-full bg-success transition-all duration-500" 
              style={{ width: getProgressWidth(midterm, midtermMax) }}
            />
          </div>
        </div>

        {/* Final */}
        <div className="flex flex-col min-w-[60px]">
          <span className="label-micro text-[9px] opacity-60">Yakuniy</span>
          <span className="text-xs font-bold text-text-primary">{final ?? '-'}/{finalMax}</span>
          <div className="h-1.5 w-full bg-slate-100 rounded-full mt-1 overflow-hidden">
            <div 
              className="h-full bg-warning transition-all duration-500" 
              style={{ width: getProgressWidth(final, finalMax) }}
            />
          </div>
        </div>

        {/* Total Score Badge */}
        <div className="flex flex-col items-center">
          <span className="label-micro text-[9px] opacity-60 mb-1">JAMI</span>
          <div className={cn(
            "h-9 min-w-[50px] flex items-center justify-center rounded-xl px-3 text-sm font-black",
            getTotalColor(total)
          )}>
            {total !== null && total !== undefined ? total.toFixed(1) : '-'}
          </div>
        </div>
      </div>

      {/* Link */}
      <Link 
        to={courseHref}
        className="h-10 w-10 flex items-center justify-center rounded-xl border border-border bg-white text-text-muted hover:text-primary hover:border-primary transition-all group-hover:shadow-premium"
      >
        <ArrowUpRight size={18} />
      </Link>
    </div>
  )
}
