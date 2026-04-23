import React from 'react'
import { 
  Award,
  BookOpen,
  CheckCircle2, 
  Lock, 
  Circle, 
  ChevronDown, 
  ChevronUp, 
  Paperclip, 
  Video, 
  Link2, 
  FileText, 
  CalendarClock, 
  Trash2, 
  ExternalLink, 
  ClipboardList, 
  Clock, 
  AlertCircle,
  FlaskConical,
  FolderOpen,
  Package,
  PlayCircle,
  CheckCircle,
  FileUp,
  LoaderCircle,
  ArrowRight,
  Search
} from 'lucide-react'
import { cn } from '@/src/lib/utils'
import type { 
  CourseDetailAssignment, 
  CourseDetailMeeting,
  CourseDetailResource,
  CourseDetailSection,
  DashboardTestItem,
  ResourceStatsResponse,
  ResourceStatStudent
} from '@/src/types'
import { Link } from 'react-router-dom'
import { fetchResourceStats, markSectionComplete } from '@/src/api/lms'
import { BarChart2, CheckCircle2 as CheckIcon, XCircle, Info } from 'lucide-react'

interface SectionAccordionProps {
  key?: number
  section: CourseDetailSection
  index: number
  expanded: boolean
  onToggle: () => void
  role: string
  onOpenResource: (resource: CourseDetailResource) => void
  onSubmitAssignment: (assignmentId: number, event: React.FormEvent<HTMLFormElement>) => Promise<void>
  onDeleteMeeting: (meetingId: number) => void
  onDeleteResource?: (resourceId: number) => void
  uploadingAssignmentId: number | null
  onSectionComplete?: (sectionId: number, newProgress: number) => void
}

function formatDateTime(value: string | null) {
  if (!value) return 'Belgilanmagan'
  return new Intl.DateTimeFormat('uz-UZ', { 
    dateStyle: 'medium', 
    timeStyle: 'short' 
  }).format(new Date(value))
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins < 60) return `${mins}m ${secs}s`
  const hrs = Math.floor(mins / 60)
  const rmins = mins % 60
  return `${hrs}s ${rmins}m`
}

export function SectionAccordion({
  section,
  index,
  expanded,
  onToggle,
  role,
  onOpenResource,
  onSubmitAssignment,
  onDeleteMeeting,
  onDeleteResource,
  uploadingAssignmentId,
  onSectionComplete,
}: SectionAccordionProps) {
  const isStudent = role === 'STUDENT'
  const isTeacher = role === 'TEACHER' || role === 'SUPER_ADMIN'
  const [isCompleting, setIsCompleting] = React.useState(false)

  const [statsResource, setStatsResource] = React.useState<CourseDetailResource | null>(null)
  const [statsData, setStatsData] = React.useState<ResourceStatsResponse | null>(null)
  const [isStatsLoading, setIsStatsLoading] = React.useState(false)

  const handleOpenStats = async (resource: CourseDetailResource) => {
    setStatsResource(resource)
    setIsStatsLoading(true)
    try {
      const data = await fetchResourceStats(resource.id)
      setStatsData(data)
    } catch (err) {
      console.error(err)
    } finally {
      setIsStatsLoading(false)
    }
  }

  const formattedIndex = (index + 1).toString().padStart(2, '0')
  const totalMaterials = section.resources.length + section.meetings.length + section.assignments.length + section.tests.length

  async function handleMarkComplete() {
    if (isCompleting || section.is_completed || section.is_locked) return
    setIsCompleting(true)
    try {
      const res = await markSectionComplete(section.id)
      if (res.success && onSectionComplete) {
        onSectionComplete(section.id, res.progress_percentage)
      }
    } catch {
      // silent fail
    } finally {
      setIsCompleting(false)
    }
  }

  return (
    <div className={cn(
      "card overflow-hidden transition-all duration-300",
      expanded ? "ring-2 ring-primary/10 shadow-hover" : ""
    )}>
      {/* HEADER */}
      <div 
        onClick={onToggle}
        className={cn(
          "flex items-center gap-4 px-6 py-5 cursor-pointer select-none transition-colors",
          expanded ? "bg-white" : "bg-slate-50/50 hover:bg-slate-50"
        )}
      >
        {/* Index Number */}
        <div className={cn(
          "h-10 w-10 flex-shrink-0 rounded-2xl flex items-center justify-center text-sm font-bold transition-colors",
          expanded ? "bg-primary text-white" : "bg-slate-100 text-text-secondary"
        )}>
          {formattedIndex}
        </div>

        {/* Status Icon */}
        <div className="flex-shrink-0">
          {section.is_completed ? (
            <CheckCircle2 className="h-5 w-5 text-success" />
          ) : section.is_locked ? (
            <Lock className="h-5 w-5 text-slate-400" title="Oldingi bo'limni bajaring" />
          ) : (
            <Circle className="h-5 w-5 text-slate-300" />
          )}
        </div>

        {/* Title and Description */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn(
              "text-base font-bold transition-colors",
              expanded ? "text-primary" : "text-text-primary"
            )}>
              {section.name}
            </h3>
            {!section.is_published && (
              <span className="status-pill status-pill-warning scale-75 origin-left">Qoralama</span>
            )}
          </div>
          {section.description && (
            <p className="text-sm text-text-secondary truncate mt-0.5">
              {section.description}
            </p>
          )}
        </div>

        {/* Badges and Toggle */}
        <div className="flex items-center gap-4">
          {isStudent && expanded && !section.is_completed && !section.is_locked && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); void handleMarkComplete() }}
              disabled={isCompleting || section.is_completed}
              className={cn(
                "ml-auto shrink-0 flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition-all",
                section.is_completed
                  ? "bg-success/10 text-success cursor-default"
                  : "bg-primary/10 text-primary hover:bg-primary hover:text-white"
              )}
            >
              {isCompleting ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <CheckCircle2 size={14} />
              )}
              {section.is_completed ? "Tugatildi" : "Tugatdim"}
            </button>
          )}
          {totalMaterials > 0 && !expanded && (
            <span className="hidden sm:inline-flex status-pill status-pill-muted lowercase font-medium tracking-normal px-3">
              {totalMaterials} ta material
            </span>
          )}
          <div className={cn(
            "h-8 w-8 rounded-xl flex items-center justify-center transition-transform duration-300",
            expanded ? "bg-primary/10 text-primary rotate-180" : "text-text-muted"
          )}>
            <ChevronDown size={18} />
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className={cn(
        "overflow-hidden transition-all duration-300 ease-in-out",
        expanded ? "max-height-2000 opacity-100" : "max-height-0 opacity-0"
      )} style={{ maxHeight: expanded ? '2000px' : '0' }}>
        <div className="px-6 pb-6 pt-2 divide-y divide-border/40">
          
          {/* RESOURCES */}
          {section.resources.length > 0 && (
            <div className="py-4 first:pt-0">
              <h4 className="label-micro mb-4 opacity-50 flex items-center gap-2">
                <div className="h-px flex-1 bg-border/60" />
                Materiallar
                <div className="h-px flex-1 bg-border/60" />
              </h4>
              <div className="space-y-3">
                {section.resources.map(resource => (
                  <ResourceItem 
                    key={resource.id} 
                    resource={resource} 
                    onOpen={() => onOpenResource(resource)}
                    onDelete={onDeleteResource ? () => onDeleteResource(resource.id) : undefined}
                    onShowStats={() => handleOpenStats(resource)}
                    showDelete={isTeacher}
                    showStats={isTeacher}
                  />
                ))}
              </div>
            </div>
          )}

          {/* MEETINGS */}
          {section.meetings.length > 0 && (
            <div className="py-4">
              <h4 className="label-micro mb-4 opacity-50 flex items-center gap-2">
                <div className="h-px flex-1 bg-border/60" />
                Darslar (Meetings)
                <div className="h-px flex-1 bg-border/60" />
              </h4>
              <div className="space-y-3">
                {section.meetings.map(meeting => (
                  <MeetingItem 
                    key={meeting.id} 
                    meeting={meeting} 
                    onDelete={() => onDeleteMeeting(meeting.id)}
                    showDelete={!isStudent}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ASSIGNMENTS */}
          {section.assignments.length > 0 && (
            <div className="py-4">
              <h4 className="label-micro mb-4 opacity-50 flex items-center gap-2">
                <div className="h-px flex-1 bg-border/60" />
                Topshiriqlar
                <div className="h-px flex-1 bg-border/60" />
              </h4>
              <div className="space-y-4">
                {section.assignments.map(assignment => (
                  <AssignmentItem 
                    key={assignment.id} 
                    assignment={assignment} 
                    isStudent={isStudent}
                    isTeacher={isTeacher}
                    onSubmit={(e) => onSubmitAssignment(assignment.id, e)}
                    uploading={uploadingAssignmentId === assignment.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* TESTS */}
          {section.tests.length > 0 && (
            <div className="py-4 last:pb-0">
              <h4 className="label-micro mb-4 opacity-50 flex items-center gap-2">
                <div className="h-px flex-1 bg-border/60" />
                Testlar
                <div className="h-px flex-1 bg-border/60" />
              </h4>
              <div className="space-y-3">
                {section.tests.map(test => (
                  <TestItem 
                    key={test.id} 
                    test={test} 
                    isStudent={isStudent}
                  />
                ))}
              </div>
            </div>
          )}

          {/* EMPTY STATE */}
          {totalMaterials === 0 && (
            <div className="py-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-border mt-4">
               <p className="text-sm text-text-muted">Bu bo'limda hali materiallar yo'q.</p>
            </div>
          )}
        </div>
      </div>

      {/* STATS MODAL */}
      {statsResource && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-scaleUp">
            {/* Header */}
            <div className="px-8 py-6 border-b border-border/60 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-text-primary capitalize">{statsResource.title}</h3>
                <p className="text-sm font-bold text-text-muted mt-1">Talabalar o'zlashtirishi statistikasi</p>
              </div>
              <button 
                onClick={() => { setStatsResource(null); setStatsData(null); }}
                className="h-10 w-10 rounded-2xl bg-slate-100 text-text-secondary hover:bg-slate-200 transition-colors flex items-center justify-center"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {isStatsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <LoaderCircle className="h-10 w-10 text-primary animate-spin" />
                  <p className="text-sm font-bold text-text-muted">Ma'lumotlar yuklanmoqda...</p>
                </div>
              ) : statsData ? (
                <div className="space-y-8">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-5 rounded-3xl bg-blue-50/50 border border-blue-100">
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Enrolled</p>
                      <p className="text-2xl font-black text-blue-700 mt-1">{statsData.total_enrolled}</p>
                    </div>
                    <div className="p-5 rounded-3xl bg-indigo-50/50 border border-indigo-100">
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Seen</p>
                      <p className="text-2xl font-black text-indigo-700 mt-1">{statsData.viewed_count}</p>
                    </div>
                    <div className="p-5 rounded-3xl bg-emerald-50/50 border border-emerald-100">
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Completed</p>
                      <p className="text-2xl font-black text-emerald-700 mt-1">{statsData.completed_count}</p>
                    </div>
                    <div className="p-5 rounded-3xl bg-amber-50/50 border border-amber-100">
                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Avg Time</p>
                      <p className="text-2xl font-black text-amber-700 mt-1">{formatDuration(statsData.avg_time_seconds)}</p>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-text-primary">Talabalar ro'yxati</h4>
                      <span className="status-pill status-pill-muted">{statsData.students.length} ta yozuv</span>
                    </div>
                    <div className="border border-border/60 rounded-3xl overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 text-[10px] uppercase font-black text-text-muted tracking-widest">
                          <tr>
                            <th className="px-6 py-4">F.I.SH</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Ko'rishlar</th>
                            <th className="px-6 py-4">Sarf. Vaqt</th>
                            <th className="px-6 py-4">Sana</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 text-xs font-bold">
                          {statsData.students.map(std => (
                            <tr key={std.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4 text-text-primary">{std.name}</td>
                              <td className="px-6 py-4">
                                {std.is_completed ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-600">
                                    <CheckIcon size={12} /> Tugatgan
                                  </span>
                                ) : std.view_count > 0 ? (
                                  <span className="text-sky-600">Ko'rilgan</span>
                                ) : (
                                  <span className="text-text-muted">Ko'rilmagan</span>
                                )}
                              </td>
                              <td className="px-6 py-4">{std.view_count} marta</td>
                              <td className="px-6 py-4">{formatDuration(std.time_spent_seconds)}</td>
                              <td className="px-6 py-4 text-text-muted">
                                {std.completed_at ? formatDateTime(std.completed_at) : '-'}
                              </td>
                            </tr>
                          ))}
                          {statsData.students.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-6 py-12 text-center text-text-muted italic">
                                Hozircha ma'lumotlar mavjud emas.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 text-rose-500">
                  Xatolik: Ma'lumotlarni yuklab bo'lmadi.
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="px-8 py-6 bg-slate-50 border-t border-border/60 flex justify-end">
               <button 
                onClick={() => { setStatsResource(null); setStatsData(null); }}
                className="btn btn-primary h-11 px-8 rounded-2xl"
               >
                 Yopish
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* HELPER COMPONENTS */

function ResourceItem({ 
  resource, 
  onOpen, 
  onDelete, 
  onShowStats,
  showDelete,
  showStats
}: { 
  key?: number
  resource: CourseDetailResource, 
  onOpen: () => void,
  onDelete?: () => void,
  onShowStats?: () => void,
  showDelete?: boolean,
  showStats?: boolean
}) {
  const types = {
    file: { icon: Paperclip, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Fayl' },
    video: { icon: Video, color: 'text-purple-600', bg: 'bg-purple-50', label: 'Video' },
    link: { icon: Link2, color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Havola' },
    text: { icon: FileText, color: 'text-slate-600', bg: 'bg-slate-50', label: 'Matn' },
    audio: { icon: PlayCircle, color: 'text-pink-600', bg: 'bg-pink-50', label: 'Audio' },
    embed: { icon: ExternalLink, color: 'text-cyan-600', bg: 'bg-cyan-50', label: 'Embed' },
    h5p: { icon: FlaskConical, color: 'text-orange-600', bg: 'bg-orange-50', label: 'H5P' },
    scorm: { icon: Package, color: 'text-amber-600', bg: 'bg-amber-50', label: 'SCORM' },
    folder: { icon: FolderOpen, color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Papka' },
    book: { icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Kitob' },
    glossary: { icon: Search, color: 'text-teal-600', bg: 'bg-teal-50', label: 'Glossariy' },
    certificate: { icon: Award, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Sertifikat' },
  }
  const config = types[resource.resource_type as keyof typeof types] || types.text
  const viewData = resource.view_data
  const isCompleted = !!viewData?.is_completed
  const estimatedTime = resource.estimated_time_minutes
  
  return (
    <div className="flex items-center gap-4 group p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-border/50">
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", config.bg, config.color)}>
        <config.icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-text-primary truncate">{resource.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{config.label}</span>
          {estimatedTime ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-text-secondary">
              {estimatedTime} daqiqa
            </span>
          ) : null}
          {resource.require_completion ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
              Majburiy
            </span>
          ) : null}
          {isCompleted ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
              <CheckCircle2 size={11} />
              Tugallandi
            </span>
          ) : viewData?.view_count ? (
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-700">
              {viewData.view_count}x ochilgan
            </span>
          ) : null}
          {!resource.is_visible ? (
            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700">
              Yashirin
            </span>
          ) : null}
        </div>
        {resource.description ? (
          <p className="mt-1 truncate text-xs font-medium text-text-secondary">{resource.description}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {showStats && (
          <button 
            onClick={onShowStats}
            title="Statistika"
            className="h-9 w-9 flex items-center justify-center rounded-xl text-text-secondary hover:bg-slate-200"
          >
            <BarChart2 size={16} />
          </button>
        )}
        <button 
          onClick={onOpen}
          className="btn btn-ghost h-9 px-4 text-xs font-bold text-primary hover:bg-primary/5"
        >
          Ochish
        </button>
        {showDelete && onDelete && (
          <button 
            onClick={onDelete}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-danger hover:bg-danger/5"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

function MeetingItem({ 
  meeting, 
  onDelete, 
  showDelete 
}: { 
  key?: number
  meeting: CourseDetailMeeting, 
  onDelete: () => void,
  showDelete?: boolean 
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl bg-emerald-50/30 border border-emerald-100/50">
      <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-50 text-emerald-600">
        <CalendarClock size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-text-primary truncate">{meeting.title}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
          <span className="text-[11px] font-semibold text-text-secondary flex items-center gap-1">
            <Clock size={10} />
            {formatDateTime(meeting.start_time)}
          </span>
          <span className="text-[11px] font-semibold text-text-muted">
             {meeting.duration_minutes} daqiqa
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {meeting.meeting_type === 'zoom' && (
          <span className="status-pill status-pill-primary scale-90">Zoom</span>
        )}
        <a 
          href={meeting.meeting_url} 
          target="_blank" 
          rel="noreferrer" 
          className="btn btn-primary h-9 px-4 text-xs"
        >
          Kirish
          <ExternalLink size={14} className="ml-1.5" />
        </a>
        {showDelete && (
          <button 
            onClick={onDelete}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-danger hover:bg-danger/5"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

function AssignmentItem({ 
  assignment, 
  isStudent, 
  isTeacher,
  onSubmit,
  uploading
}: { 
  key?: number
  assignment: CourseDetailAssignment, 
  isStudent: boolean,
  isTeacher: boolean,
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void,
  uploading: boolean
}) {
  const [selectedFile, setSelectedFile] = React.useState<string>('')

  const deadlineDate = assignment.deadline ? new Date(assignment.deadline) : null
  const now = new Date()
  const isPassed = deadlineDate ? deadlineDate < now : false
  const isNear = deadlineDate ? (deadlineDate.getTime() - now.getTime()) / (1000 * 3600 * 24) <= 3 && !isPassed : false

  const submission = assignment.latest_submission
  
  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      <div className="bg-slate-50/50 p-4 flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-50 text-amber-600">
            <ClipboardList size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-text-primary">{assignment.title}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
              <span className={cn(
                "text-[11px] font-bold flex items-center gap-1",
                isPassed ? "text-danger" : isNear ? "text-warning" : "text-text-secondary"
              )}>
                Deadline: {formatDateTime(assignment.deadline)}
              </span>
              {isPassed && <span className="status-pill status-pill-danger scale-75 origin-left">Muddati o'tgan</span>}
              {isNear && <span className="status-pill status-pill-warning scale-75 origin-left">Yaqin deadline</span>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs font-black text-text-primary">{assignment.max_score} BALL</span>
        </div>
      </div>

      <div className="p-4 bg-white">
        {isStudent && !submission && (
           <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
              <div className="relative group">
                <input 
                  name="file" 
                  type="file" 
                  required
                  onChange={(e) => setSelectedFile(e.target.files?.[0]?.name || '')}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                />
                <div className="input flex items-center gap-2 group-hover:border-primary transition-colors">
                  <Paperclip size={14} className="text-text-muted" />
                  <span className={cn(
                    "text-sm truncate font-semibold",
                    selectedFile ? "text-text-primary" : "text-text-muted"
                  )}>
                    {selectedFile || 'Fayl tanlang...'}
                  </span>
                </div>
              </div>
              <input 
                name="comment" 
                placeholder="Izoh (ixtiyoriy)" 
                className="input" 
              />
              <button 
                type="submit" 
                disabled={uploading || isPassed} 
                className="btn btn-primary sm:col-span-2 gap-2"
              >
                {uploading ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <FileUp size={16} />
                )}
                Topshiriqni yuborish
              </button>
              {isPassed && (
                <p className="sm:col-span-2 text-[10px] font-bold text-danger text-center uppercase tracking-wider">
                  Topshiriqni yuborish muddati tugagan
                </p>
              )}
           </form>
        )}

        {isStudent && submission && (
          <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-success/5 border border-success/20">
            <div className="flex items-center gap-3">
               <div className="h-8 w-8 rounded-lg bg-success/10 text-success flex items-center justify-center">
                  <CheckCircle size={18} />
               </div>
               <div>
                 <p className="text-xs font-bold text-success">Muvaffaqiyatli yuborildi</p>
                 <p className="text-[10px] font-semibold text-text-secondary mt-0.5">
                   {submission.submitted_at ? formatDateTime(submission.submitted_at) : ''}
                 </p>
               </div>
            </div>
            {submission.score !== null && (
               <div className="text-right">
                 <p className="text-[10px] font-bold text-text-muted uppercase">Baholangan</p>
                 <p className="text-sm font-black text-success">{submission.score} / {assignment.max_score}</p>
               </div>
            )}
          </div>
        )}

        {isTeacher && (
           <Link 
            to={assignment.spa_path}
            className="btn btn-outline w-full text-xs gap-2 py-2.5"
           >
             Submissionlarni ko'rish
             <ArrowRight size={14} />
           </Link>
        )}
      </div>
    </div>
  )
}

function TestItem({ 
  test, 
  isStudent 
}: { 
  key?: number
  test: DashboardTestItem, 
  isStudent: boolean 
}) {
  const statusColors = {
    open: 'status-pill-success',
    scheduled: 'status-pill-primary',
    closed: 'status-pill-muted',
    inactive: 'status-pill-muted',
    in_progress: 'status-pill-warning'
  }
  
  const statusBadgeClass = statusColors[test.status as keyof typeof statusColors] || 'status-pill-muted'

  return (
    <div className="p-4 rounded-2xl border border-border hover:border-primary/20 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-green-50 text-green-600">
            <FlaskConical size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-text-primary">{test.name}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="status-pill status-pill-muted scale-90 origin-left lowercase font-semibold tracking-normal">
                {test.control_type_label}
              </span>
              <span className={cn("status-pill scale-90 origin-left", statusBadgeClass)}>
                {test.status_label}
              </span>
            </div>
          </div>
        </div>
        
        {isStudent && test.last_score !== null && (
          <div className="bg-success/5 border border-success/10 rounded-xl p-2 px-3 text-right">
             <p className="text-[9px] font-black text-success uppercase tracking-widest">Natija</p>
             <p className="text-sm font-black text-text-primary">{test.last_score} / {test.max_score}</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
           <div className="flex flex-col">
              <span className="label-micro text-[9px] opacity-60">Vaqt</span>
              <span className="text-[11px] font-bold text-text-secondary">
                 {test.duration_minutes} daqiqa
              </span>
           </div>
           <div className="flex flex-col">
              <span className="label-micro text-[9px] opacity-60">Muddati</span>
              <span className="text-[11px] font-bold text-text-secondary">
                 {formatDateTime(test.end_datetime)} gacha
              </span>
           </div>
           <div className="flex flex-col">
              <span className="label-micro text-[9px] opacity-60">Urinishlar</span>
              <span className="text-[11px] font-bold text-text-secondary">
                 {test.attempts_done} / {test.attempts_allowed}
              </span>
           </div>
        </div>

        {isStudent && (
          <div className="flex items-center gap-2">
            {test.status === 'open' && test.attempts_left > 0 ? (
              <Link 
                to={test.spa_take_path || test.take_url}
                className="btn btn-primary h-9 px-5 text-xs gap-2"
              >
                <PlayCircle size={14} />
                Testni boshlash
              </Link>
            ) : test.attempts_done > 0 ? (
              <Link 
                to={test.spa_result_path || test.result_url}
                className="btn btn-outline h-9 px-5 text-xs"
              >
                Natijani ko'rish
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
