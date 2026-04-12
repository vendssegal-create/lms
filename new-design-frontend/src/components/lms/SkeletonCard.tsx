import { cn } from '@/src/lib/utils'

export function SkeletonStatCard() {
  return (
    <div className="card h-32 p-6 flex flex-col justify-between">
      <div className="h-4 w-24 bg-slate-100 rounded shimmer" />
      <div className="h-10 w-32 bg-slate-100 rounded-lg shimmer" />
    </div>
  )
}

export function SkeletonCourseCard() {
  return (
    <div className="card h-64 overflow-hidden">
      {/* Banner placeholder */}
      <div className="h-[40%] w-full bg-slate-100 shimmer" />
      
      {/* Content placeholders */}
      <div className="p-6 space-y-4">
        <div className="h-5 w-3/4 bg-slate-100 rounded-lg shimmer" />
        <div className="space-y-2">
          <div className="h-3 w-1/2 bg-slate-100 rounded shimmer" />
          <div className="h-3 w-1/3 bg-slate-100 rounded shimmer" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="h-14 w-full flex items-center px-6 border-b border-border/50 gap-4">
      <div className="h-4 w-12 bg-slate-100 rounded shimmer" />
      <div className="h-4 flex-1 bg-slate-100 rounded shimmer" />
      <div className="h-4 w-24 bg-slate-100 rounded shimmer" />
      <div className="h-4 w-32 bg-slate-100 rounded shimmer" />
      <div className="h-8 w-8 bg-slate-100 rounded-lg shimmer" />
    </div>
  )
}
