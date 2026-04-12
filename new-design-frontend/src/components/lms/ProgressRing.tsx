import { cn } from '@/src/lib/utils'

interface ProgressRingProps {
  percentage: number
  size?: number
  strokeWidth?: number
  color?: 'primary' | 'success' | 'warning' | 'danger'
  showLabel?: boolean
  label?: string
  animated?: boolean
}

export function ProgressRing({
  percentage,
  size = 80,
  strokeWidth = 7,
  color = 'primary',
  showLabel = true,
  label,
  animated = true
}: ProgressRingProps) {
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  const colors = {
    primary: '#4361EE',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444'
  }

  const activeColor = colors[color]

  return (
    <div 
      className="relative flex items-center justify-center" 
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-slate-100 opacity-20"
          style={{ color: activeColor }}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={cn(
            "transition-all duration-1000 ease-out",
            !animated && "transition-none"
          )}
          style={{ color: activeColor }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-lg font-bold leading-none text-text-primary">
            {Math.round(percentage)}%
          </span>
          {label && (
            <span className="text-[10px] font-semibold text-text-muted mt-0.5">
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
