import { Link } from 'react-router-dom'
import { BookOpen, FlaskConical, ClipboardList, User2, ArrowRight } from 'lucide-react'
import { cn } from '@/src/lib/utils'

interface CourseCardProps {
  key?: number
  course: {
    id: number
    title: string
    description?: string | null
    image_url?: string | null
    teacher: { id: number; full_name: string }
    deadline?: string | null
    is_active: boolean
    sections_count: number
    tests_count: number
    assignments_count: number
    students_count?: number
    progress_percentage?: number
    completed_sections?: number
  }
  role?: string
  variant?: 'grid' | 'list'
  onClick?: () => void
  href: string
}

export function CourseCard({
  course,
  role,
  variant = 'grid',
  onClick,
  href
}: CourseCardProps) {
  const isStudent = role === 'STUDENT'
  
  // Gradient selection based on ID
  const gradients = [
    'from-blue-500 to-indigo-600',
    'from-violet-500 to-purple-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-cyan-500 to-sky-600'
  ]
  const gradientClass = gradients[course.id % 6]

  // Deadline logic
  const deadlineDate = course.deadline ? new Date(course.deadline) : null
  const isDeadlineNear = deadlineDate 
    ? (deadlineDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24) <= 7 
    : false

  const initials = course.title.substring(0, 2).toUpperCase()
  const teacherInitials = course.teacher.full_name.split(' ').map(n => n[0]).join('').substring(0, 1).toUpperCase()

  if (variant === 'list') {
    return (
      <Link 
        to={href}
        onClick={onClick}
        className="flex items-center h-20 px-6 border-b border-border hover:bg-slate-50 transition-colors group"
      >
        <div className={cn(
          "h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold shrink-0 bg-gradient-to-br",
          gradientClass
        )}>
          {initials}
        </div>
        
        <div className="ml-4 flex-1 min-w-0">
          <h4 className="font-bold text-text-primary truncate">{course.title}</h4>
          <p className="text-sm text-text-secondary truncate">{course.teacher.full_name}</p>
        </div>

        <div className="hidden md:flex items-center gap-6 px-8 text-xs font-semibold text-text-secondary">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-primary" />
            {course.sections_count}
          </div>
          <div className="flex items-center gap-1.5">
            <FlaskConical className="w-3.5 h-3.5 text-success" />
            {course.tests_count}
          </div>
          <div className="flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5 text-warning" />
            {course.assignments_count}
          </div>
        </div>

        {isStudent && course.progress_percentage !== undefined && (
          <div className="hidden lg:block w-40 px-4">
            <div className="flex justify-between text-[10px] font-bold mb-1">
              <span>PROGRES</span>
              <span>{course.progress_percentage}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500" 
                style={{ width: `${course.progress_percentage}%` }}
              />
            </div>
          </div>
        )}

        <div className="ml-auto">
          <div className="btn h-9 px-4 text-xs btn-outline opacity-0 group-hover:opacity-100 transition-opacity">
            Ko'rish
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link 
      to={href}
      onClick={onClick}
      className="card group flex flex-col hover:-translate-y-1 transition-all duration-300"
    >
      {/* Banner */}
      <div className="relative h-40 w-full overflow-hidden">
        {course.image_url ? (
          <img 
            src={course.image_url} 
            alt={course.title} 
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className={cn(
            "h-full w-full flex items-center justify-center text-white text-4xl font-black bg-gradient-to-br",
            gradientClass
          )}>
            {initials}
          </div>
        )}

        {/* Status Badges */}
        <div className="absolute top-4 left-4">
          <div className={cn(
            "status-pill",
            course.is_active ? "status-pill-success" : "status-pill-muted"
          )}>
            <span className="mr-1.5">●</span>
            {course.is_active ? "Faol" : "Nofaol"}
          </div>
        </div>

        {isDeadlineNear && (
          <div className="absolute top-4 right-4">
            <div className="status-pill status-pill-danger">
              Deadline yaqin
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col flex-1">
        <h4 className="font-bold text-lg text-text-primary line-clamp-2 leading-tight group-hover:text-primary transition-colors">
          {course.title}
        </h4>

        <div className="flex items-center gap-2 mt-3">
          <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
            {teacherInitials}
          </div>
          <span className="text-sm font-semibold text-text-secondary">
            {course.teacher.full_name}
          </span>
        </div>

        <div className="h-px w-full bg-border/60 mt-4 mb-4" />

        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-text-secondary">
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              {course.sections_count}
            </div>
            <span className="label-micro text-[8px] opacity-70">Bo'lim</span>
          </div>
          <div className="flex flex-col items-center gap-1 border-x border-border/60 px-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-text-secondary">
              <FlaskConical className="w-3.5 h-3.5 text-success" />
              {course.tests_count}
            </div>
            <span className="label-micro text-[8px] opacity-70">Test</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-text-secondary">
              <ClipboardList className="w-3.5 h-3.5 text-warning" />
              {course.assignments_count}
            </div>
            <span className="label-micro text-[8px] opacity-70">Vazifa</span>
          </div>
        </div>

        {isStudent && course.progress_percentage !== undefined && (
          <div className="mt-5 pt-4 border-t border-border/40">
            <div className="flex justify-between text-[10px] font-black tracking-wider text-text-muted mb-2">
              <span>Hozirgi progress</span>
              <span className="text-primary">{course.progress_percentage}%</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-700 ease-out" 
                style={{ width: `${course.progress_percentage}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-auto pt-5">
          <button className="btn btn-outline w-full gap-2 text-xs py-2.5">
            <span>Ko'rish</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </Link>
  )
}
