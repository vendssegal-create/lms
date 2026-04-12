import React from 'react'
import { cn } from '@/src/lib/utils'

interface StatWidgetProps {
  icon: React.ReactNode
  value: number | string
  label: string
  subtitle?: string
  color?: 'primary' | 'success' | 'warning' | 'danger'
  trend?: { value: number; isUp: boolean }
}

export function StatWidget({
  icon,
  value,
  label,
  subtitle,
  color = 'primary',
  trend
}: StatWidgetProps) {
  
  const colorClasses = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    danger: 'text-danger bg-danger/10'
  }

  return (
    <div className="card p-7 relative">
      {/* Trend Indicator */}
      {trend && (
        <div className={cn(
          "absolute top-6 right-6 flex items-center gap-1 text-xs font-bold",
          trend.isUp ? "text-success" : "text-danger"
        )}>
          <span>{trend.isUp ? '▲' : '▼'}</span>
          <span>{trend.value}%</span>
        </div>
      )}

      {/* Icon Box */}
      <div className={cn(
        "h-12 w-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110",
        colorClasses[color]
      )}>
        <div className="w-6 h-6">
          {icon}
        </div>
      </div>

      {/* Value & Label */}
      <div className="mt-5 space-y-1">
        <h4 className="text-3xl font-black text-text-primary tracking-tight">
          {value}
        </h4>
        <p className="text-sm font-semibold text-text-secondary">
          {label}
        </p>
        
        {subtitle && (
          <p className="text-xs text-text-muted mt-1">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}
