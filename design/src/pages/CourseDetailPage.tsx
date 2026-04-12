import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  FileText,
  FileUp,
  Link as LinkIcon,
  LoaderCircle,
  Paperclip,
  Video,
  BookOpen,
  FlaskConical,
  ClipboardList,
  User2,
  Calendar,
  Layers3,
  ShieldCheck,
  MessageCircle,
  Settings,
  ArrowRight,
  Plus,
  PlayCircle,
  Clock,
  X,
  CheckCircle,
  Award,
  FileDown,
  Printer,
} from 'lucide-react';
import {
  createMeeting,
  deleteMeeting,
  downloadCertificate,
  fetchCourseDetail,
  markResourceCompleted,
  markResourceViewed,
  submitAssignment,
} from '@/src/api/lms';
import type { 
  CourseDetailAssignment, 
  CourseDetailMeeting, 
  CourseDetailResource, 
  CourseDetailResponse, 
  CourseDetailSection, 
  DashboardTestItem 
} from '@/src/types';
import { SectionAccordion } from '@/src/components/lms/SectionAccordion';
import { ProgressRing } from '@/src/components/lms/ProgressRing';
import { EmbeddedResourceViewer } from '@/src/components/lms/EmbeddedResourceViewer';
import { cn } from '@/src/lib/utils';

type CourseTab = 'content' | 'assignments' | 'tests' | 'forum';

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = Number(params.courseId || 0);
  
  // Existing States
  const [data, setData] = useState<CourseDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingAssignmentId, setUploadingAssignmentId] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    meeting_url: '',
    meeting_type: 'zoom',
    start_time: '',
    duration_minutes: 60,
    section_id: '',
  });
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({});
  const [certLoading, setCertLoading] = useState<'pdf' | 'docx' | null>(null);
  const [certError, setCertError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<
    | { open: false }
    | { open: true; resource: CourseDetailResource }
  >({ open: false });

  // New State
  const [activeTab, setActiveTab] = useState<CourseTab>('content');
  const currentRole = data?.role || '';
  const isStudent = currentRole === 'STUDENT';
  const isTeacher = currentRole === 'TEACHER' || currentRole === 'SUPER_ADMIN';

  // Load implementation
  const load = async (active = true) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchCourseDetail(courseId);
      if (active) {
        setData(response);
        const initial: Record<number, boolean> = {};
        response.sections.forEach((section) => {
          initial[section.id] = true;
        });
        setExpandedSections(initial);
      }
    } catch (err) {
      if (active) setError(err instanceof Error ? err.message : 'Kurs yuklanmadi.');
    } finally {
      if (active) setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (courseId) void load(active);
    return () => { active = false; };
  }, [courseId]);

  // Handlers
  const toggleSection = (sectionId: number) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const expandAll = (expand: boolean) => {
    if (!data) return;
    const next: Record<number, boolean> = {};
    data.sections.forEach((section) => {
      next[section.id] = expand;
    });
    setExpandedSections(next);
  };

  const updateResourceState = (
    resourceId: number,
    updater: (resource: CourseDetailResource) => CourseDetailResource,
  ) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map((section) => ({
          ...section,
          resources: section.resources.map((resource) => (
            resource.id === resourceId ? updater(resource) : resource
          )),
        })),
        orphans: {
          ...prev.orphans,
          resources: prev.orphans.resources.map((resource) => (
            resource.id === resourceId ? updater(resource) : resource
          )),
        },
      };
    });
  };

  const openResourceViewer = (resource: CourseDetailResource) => {
    setViewer({ open: true, resource });
  };

  useEffect(() => {
    if (!viewer.open || !isStudent) {
      return;
    }

    let active = true;
    const resource = viewer.resource;
    const startedAt = Date.now();

    void markResourceViewed(resource.id)
      .then((response) => {
        if (!active) return;
        updateResourceState(resource.id, (item) => ({
          ...item,
          view_data: {
            view_count: response.view_count,
            is_completed: item.view_data?.is_completed || false,
            completed_at: item.view_data?.completed_at || null,
            time_spent_seconds: item.view_data?.time_spent_seconds || 0,
          },
        }));
      })
      .catch(() => {});

    return () => {
      active = false;
      const timeSpentSeconds = Math.floor((Date.now() - startedAt) / 1000);
      if (timeSpentSeconds <= 3) {
        return;
      }

      void markResourceCompleted(resource.id, { time_spent_seconds: timeSpentSeconds })
        .then((response) => {
          updateResourceState(resource.id, (item) => ({
            ...item,
            view_data: {
              view_count: item.view_data?.view_count || 1,
              is_completed: true,
              completed_at: response.completed_at,
              time_spent_seconds: (item.view_data?.time_spent_seconds || 0) + timeSpentSeconds,
            },
          }));
        })
        .catch(() => {});
    };
  }, [isStudent, viewer]);

  const handleSubmitAssignment = async (assignmentId: number, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUploadingAssignmentId(assignmentId);
    setUploadError(null);
    setUploadSuccess(null);

    const form = event.currentTarget;
    const file = (form.elements.namedItem('file') as HTMLInputElement | null)?.files?.[0] || null;
    const comment = (form.elements.namedItem('comment') as HTMLInputElement | null)?.value || '';
    
    if (!file) {
      setUploadError('Fayl tanlanmagan.');
      setUploadingAssignmentId(null);
      return;
    }

    const payload = new FormData();
    payload.set('file', file);
    if (comment.trim()) payload.set('comment', comment.trim());

    try {
      await submitAssignment(assignmentId, payload);
      setUploadSuccess('Topshiriq yuborildi.');
      await load();
      form.reset();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Yuborilmadi.');
    } finally {
      setUploadingAssignmentId(null);
    }
  };

  const handleCreateMeeting = async (event: FormEvent) => {
    event.preventDefault();
    if (!data) return;
    setMeetingError(null);
    try {
      await createMeeting(courseId, {
        title: meetingForm.title,
        meeting_url: meetingForm.meeting_url,
        meeting_type: meetingForm.meeting_type,
        start_time: meetingForm.start_time,
        duration_minutes: Number(meetingForm.duration_minutes),
        section_id: meetingForm.section_id ? Number(meetingForm.section_id) : null,
      });
      await load();
      setMeetingForm({ title: '', meeting_url: '', meeting_type: 'zoom', start_time: '', duration_minutes: 60, section_id: '' });
    } catch (err) {
      setMeetingError(err instanceof Error ? err.message : 'Meeting yaratilmadi.');
    }
  };

  const handleDeleteMeeting = async (meetingId: number) => {
    if (!data) return;
    setMeetingError(null);
    try {
      await deleteMeeting(meetingId);
      await load();
    } catch (err) {
      setMeetingError(err instanceof Error ? err.message : 'Ochirilmadi.');
    }
  };

  // Aggregations
  const allAssignments = useMemo(() => {
    if (!data) return [];
    const flat = data.sections.flatMap(s => s.assignments);
    return flat.sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  }, [data]);

  const allTests = useMemo(() => {
    if (!data) return [];
    return data.sections.flatMap(s => s.tests);
  }, [data]);

  const progress = useMemo(() => {
    if (!data || data.sections.length === 0) return { completed: 0, total: 0, percentage: 0 };
    const completed = data.sections.filter(s => s.is_completed).length;
    const total = data.sections.length;
    return {
      completed,
      total,
      percentage: Math.round((completed / total) * 100)
    };
  }, [data]);

  const bannerGradient = useMemo(() => {
    const gradients = [
      'from-blue-600 to-indigo-700',
      'from-violet-600 to-purple-700',
      'from-emerald-600 to-teal-700',
      'from-amber-600 to-orange-700',
      'from-rose-600 to-pink-700',
      'from-cyan-600 to-sky-700'
    ];
    return gradients[courseId % 6];
  }, [courseId]);

  if (isLoading) {
    return (
      <div className="space-y-8 animate-slideUp">
        <div className="h-64 rounded-[40px] bg-slate-200 animate-pulse shimmer" />
        <div className="grid lg:grid-cols-[1fr_300px] gap-8">
           <div className="space-y-6">
              <div className="h-12 w-full bg-slate-100 rounded-2xl shimmer" />
              <div className="h-64 h-64 h-64 space-y-4">
                 <div className="h-20 w-full bg-slate-100 rounded-3xl shimmer" />
                 <div className="h-20 w-full bg-slate-100 rounded-3xl shimmer" />
                 <div className="h-20 w-full bg-slate-100 rounded-3xl shimmer" />
              </div>
           </div>
           <div className="space-y-6">
              <div className="h-80 w-full bg-slate-100 rounded-[32px] shimmer" />
           </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card p-10 text-center">
        <ArrowLeft className="mx-auto text-slate-300 mb-4" size={40} />
        <h3 className="text-xl font-black text-text-primary">Kurs yuklanmadi</h3>
        <p className="mt-2 text-rose-500 font-semibold">{error || "Noma'lum xatolik."}</p>
        <Link to="/courses" className="btn btn-primary mt-8 inline-flex gap-2">
          Kurslar ro'yxatiga qaytish
        </Link>
      </div>
    );
  }

  const { course, role } = data;
  const certificate = course.certificate;

  const handleCertDownload = async (fmt: 'pdf' | 'docx') => {
    setCertError(null);
    setCertLoading(fmt);
    try {
      await downloadCertificate(courseId, fmt, false);
    } catch (e) {
      setCertError(e instanceof Error ? e.message : 'Yuklab olishda xatolik');
    } finally {
      setCertLoading(null);
    }
  };

  return (
    <div className="space-y-8 animate-slideUp">
      
      {/* SECTION 1: COURSE BANNER */}
      <section className={cn(
        "relative overflow-hidden rounded-[40px] text-white shadow-2xl transition-all duration-500",
        "bg-gradient-to-br",
        bannerGradient
      )}>
        {course.image_url && (
          <div className="absolute inset-0 z-0">
            <img 
              src={course.image_url} 
              alt={course.title} 
              className="h-full w-full object-cover opacity-20" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
        )}
        
        <div className="relative z-10 px-8 py-10 lg:px-12 lg:py-14">
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-white/60 mb-6">
             <Link to="/courses" className="hover:text-white transition-colors">Kurslar</Link>
             <span>/</span>
             <span className="text-white truncate max-w-[200px]">{course.title}</span>
          </div>

          <div className="max-w-4xl">
            <h1 className="text-3xl lg:text-5xl font-black tracking-tight leading-tight">
              {course.title}
            </h1>
            <p className="mt-4 text-base lg:text-lg font-medium text-white/80 max-w-3xl leading-relaxed">
              {course.description || "Tavsif kiritilmagan."}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <div className={cn(
               "status-pill bg-white/10 border-white/20 text-white",
               course.is_active ? "shadow-[0_0_15px_rgba(255,255,255,0.2)]" : "opacity-60"
            )}>
              <span className="mr-2">●</span>
              {course.is_active ? "Faol Kurs" : "Nofaol"}
            </div>
            {course.deadline && (
              <div className="status-pill bg-amber-500/20 border-amber-500/30 text-amber-100 flex items-center gap-2">
                <Calendar size={14} />
                {new Date(course.deadline).toLocaleDateString('uz-UZ')}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 2: TABS + CONTENT */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        
        {/* MAIN CONTENT Area */}
        <div className="space-y-6">
          
          {/* TAB SWITCHER */}
          <div className="flex bg-slate-100/50 p-1.5 rounded-[24px] border border-border/40 overflow-x-auto no-scrollbar scroll-smooth">
            {(['content', 'assignments', 'tests', 'forum'] as const).map(tab => {
              const labels = { content: 'Kontent', assignments: 'Topshiriqlar', tests: 'Testlar', forum: 'Forum' };
              const icons = { content: <BookOpen size={16} />, assignments: <ClipboardList size={16} />, tests: <FlaskConical size={16} />, forum: <MessageCircle size={16} /> };
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-[20px] text-sm font-bold transition-all whitespace-nowrap",
                    isActive 
                      ? "bg-white text-primary shadow-premium" 
                      : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  {icons[tab]}
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          {/* TAB CONTENT */}
          <div className="min-h-[400px]">
            {activeTab === 'content' && (
              <div className="space-y-6 animate-slideUp">
                <div className="flex items-center justify-end gap-4 text-xs font-bold text-text-secondary">
                  <button onClick={() => expandAll(true)} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                    <ChevronDown size={14} /> Barchasini ochish
                  </button>
                  <button onClick={() => expandAll(false)} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                    <ChevronUp size={14} /> Barchasini yopish
                  </button>
                </div>
                
                {data.sections.length > 0 ? (
                  <div className="space-y-4">
                    {data.sections.map((section, index) => (
                      <SectionAccordion
                        key={section.id}
                        section={section}
                        index={index}
                        expanded={!!expandedSections[section.id]}
                        onToggle={() => toggleSection(section.id)}
                        role={role}
                        onOpenResource={openResourceViewer}
                        onSubmitAssignment={handleSubmitAssignment}
                        onDeleteMeeting={handleDeleteMeeting}
                        uploadingAssignmentId={uploadingAssignmentId}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="card p-16 text-center border-dashed">
                     <BookOpen size={48} className="mx-auto text-slate-200 mb-4" />
                     <p className="text-lg font-bold text-text-secondary">Hozircha bo'limlar yo'q.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'assignments' && (
               <div className="space-y-4 animate-slideUp">
                  <div className="flex items-center justify-between mb-2">
                     <h3 className="text-xl font-black text-text-primary">Barcha topshiriqlar</h3>
                     <span className="status-pill status-pill-muted">{allAssignments.length} ta</span>
                  </div>
                  {allAssignments.length > 0 ? allAssignments.map(assignment => (
                    <AssignmentRow 
                      key={assignment.id} 
                      assignment={assignment} 
                      isStudent={isStudent}
                      isTeacher={isTeacher}
                      uploading={uploadingAssignmentId === assignment.id}
                      onSubmit={(e) => handleSubmitAssignment(assignment.id, e)}
                    />
                  )) : (
                    <div className="card p-16 text-center border-dashed">
                       <ClipboardList size={48} className="mx-auto text-slate-200 mb-4" />
                       <p className="text-lg font-bold text-text-secondary">Topshiriqlar mavjud emas.</p>
                    </div>
                  )}
               </div>
            )}

            {activeTab === 'tests' && (
               <div className="space-y-6 animate-slideUp">
                  <div className="flex items-center justify-between mb-2">
                     <h3 className="text-xl font-black text-text-primary">Kurs testlari</h3>
                     <span className="status-pill status-pill-muted">{allTests.length} ta</span>
                  </div>
                  {allTests.length > 0 ? (
                    <div className="space-y-4">
                      {allTests.map(test => (
                        <TestRow key={test.id} test={test} isStudent={isStudent} />
                      ))}
                    </div>
                  ) : (
                    <div className="card p-16 text-center border-dashed">
                       <FlaskConical size={48} className="mx-auto text-slate-200 mb-4" />
                       <p className="text-lg font-bold text-text-secondary">Testlar mavjud emas.</p>
                    </div>
                  )}
               </div>
            )}

            {activeTab === 'forum' && (
               <div className="card p-12 text-center animate-slideUp">
                  <div className="h-20 w-20 bg-primary/10 text-primary rounded-[32px] flex items-center justify-center mx-auto mb-6">
                     <MessageCircle size={40} />
                  </div>
                  <h3 className="text-2xl font-black text-text-primary">Fikr mulohazalar forumi</h3>
                  <p className="mt-3 text-text-secondary max-w-sm mx-auto">
                    Kurs bo'yicha savollaringizni bering va boshqalarning savollariga javob toping.
                  </p>
                  <Link 
                    to={`/courses/${courseId}/forum`}
                    className="btn btn-primary mt-8 gap-2"
                  >
                    Forumga o'tish
                    <ArrowRight size={16} />
                  </Link>
               </div>
            )}
          </div>
        </div>

        {/* SIDEBAR */}
        <aside className="space-y-6">
           
           {/* PROGRESS & ABOUT */}
           <div className="card p-6">
              {isStudent && (
                <div className="flex flex-col items-center gap-4 mb-6 pb-6 border-b border-border/60 text-center">
                   <ProgressRing 
                    percentage={progress.percentage} 
                    size={100} 
                    strokeWidth={8}
                    color="primary"
                   />
                   <div>
                     <p className="text-sm font-black text-text-primary">{progress.percentage}% tugatildi</p>
                     <p className="text-[11px] font-bold text-text-muted uppercase mt-1">
                       {progress.completed} / {progress.total} bo'lim
                     </p>
                   </div>
                </div>
              )}

              <div className="space-y-5">
                 <div>
                    <span className="label-micro opacity-60">O'qituvchi</span>
                    <div className="flex items-center gap-3 mt-2">
                       <div className="h-10 w-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                          {course.teacher.full_name.substring(0, 1).toUpperCase()}
                       </div>
                       <p className="text-sm font-bold text-text-primary truncate">
                          {course.teacher.full_name}
                       </p>
                    </div>
                 </div>

                 {course.deadline && (
                    <div>
                       <span className="label-micro opacity-60">Matematik muddati</span>
                       <div className="flex items-center gap-2 mt-2 text-danger">
                          <Calendar size={16} />
                          <p className="text-sm font-bold">
                             {new Date(course.deadline).toLocaleDateString('uz-UZ', { dateStyle: 'medium' })}
                          </p>
                       </div>
                    </div>
                 )}

                 <div className="h-px bg-border/60" />

                 <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-primary">
                          <BookOpen size={14} />
                       </div>
                       <div className="flex flex-col">
                          <span className="text-xs font-black text-text-primary">{course.sections_count}</span>
                          <span className="text-[9px] font-bold text-text-muted uppercase">Mavzu</span>
                       </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-success">
                          <FlaskConical size={14} />
                       </div>
                       <div className="flex flex-col">
                          <span className="text-xs font-black text-text-primary">{course.tests_count}</span>
                          <span className="text-[9px] font-bold text-text-muted uppercase">Test</span>
                       </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-warning">
                          <ClipboardList size={14} />
                       </div>
                       <div className="flex flex-col">
                          <span className="text-xs font-black text-text-primary">{course.assignments_count}</span>
                          <span className="text-[9px] font-bold text-text-muted uppercase">Vazifa</span>
                       </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-indigo-500">
                          <Layers3 size={14} />
                       </div>
                       <div className="flex flex-col">
                          <span className="text-xs font-black text-text-primary">{data.sections.reduce((acc, s) => acc + s.resources.length, 0)}</span>
                          <span className="text-[9px] font-bold text-text-muted uppercase">Material</span>
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           {certificate && (isStudent || certificate.is_preview) && (
             <div className="card overflow-hidden border border-amber-100/80 p-0">
               <div className="bg-gradient-to-r from-amber-500 to-yellow-400 px-5 py-4">
                 <div className="flex items-center gap-3">
                   <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                     <Award className="text-white" size={22} />
                   </div>
                   <div>
                     <p className="text-sm font-black text-white">
                       {certificate.is_preview ? 'Namuna sertifikat' : 'Sertifikat'}
                     </p>
                     <p className="text-xs font-semibold text-white/85">
                       {certificate.is_preview
                         ? (certificate.message || 'Shablon va chop etishni tekshirish')
                         : certificate.is_available
                           ? certificate.is_generated
                             ? 'Yuklab olishga tayyor'
                             : (certificate.message || 'Shartlarni bajaring')
                           : (certificate.message || "Hozircha mavjud emas")}
                     </p>
                   </div>
                 </div>
               </div>
               {certificate.is_preview && certificate.is_available ? (
                 <div className="space-y-3 p-5">
                   <p className="text-[11px] font-semibold text-text-secondary">
                     Bu rasmiy talaba sertifikati emas; faqat chop etish orqali shablonni ko‘rish. Yuklab olish talaba
                     hisobi va shartlar bajarilganda mumkin.
                   </p>
                   {certificate.print_url ? (
                     <a
                       href={certificate.print_url}
                       target="_blank"
                       rel="noreferrer"
                       className="flex w-full min-w-[140px] items-center justify-center gap-2 rounded-2xl border-2 border-amber-400/80 bg-amber-50/80 px-4 py-3 text-sm font-bold text-amber-900 transition-colors hover:bg-amber-100"
                     >
                       <Printer size={16} />
                       Namunani chop etish
                     </a>
                   ) : null}
                 </div>
               ) : certificate.is_available ? (
                 <div className="space-y-3 p-5">
                   <p className="text-[11px] font-semibold text-text-secondary">
                     DOCX — serverda konvertor talab qilinmaydi. PDF uchun LibreOffice yoki (Windows/macOS)
                     Microsoft Word kerak bo‘lishi mumkin. «Chop etish» — brauzer orqali qurilmangizda PDF ga
                     saqlash (serverda LO shart emas).
                   </p>
                   {certError && (
                     <p className="text-xs font-bold text-rose-600">{certError}</p>
                   )}
                   <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                     <button
                       type="button"
                       disabled={certLoading !== null}
                       onClick={() => void handleCertDownload('docx')}
                       className="btn btn-primary flex flex-1 items-center justify-center gap-2 py-3 min-w-[140px]"
                     >
                       {certLoading === 'docx' ? (
                         <LoaderCircle className="animate-spin" size={16} />
                       ) : (
                         <FileText size={16} />
                       )}
                       DOCX
                     </button>
                     <button
                       type="button"
                       disabled={certLoading !== null}
                       onClick={() => void handleCertDownload('pdf')}
                       className="flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold text-text-primary transition-colors hover:bg-slate-50 disabled:opacity-50"
                     >
                       {certLoading === 'pdf' ? (
                         <LoaderCircle className="animate-spin" size={16} />
                       ) : (
                         <FileDown size={16} />
                       )}
                       PDF
                     </button>
                     {certificate.print_url ? (
                       <a
                         href={certificate.print_url}
                         target="_blank"
                         rel="noreferrer"
                         className="flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-2xl border-2 border-amber-400/80 bg-amber-50/80 px-4 py-3 text-sm font-bold text-amber-900 transition-colors hover:bg-amber-100"
                       >
                         <Printer size={16} />
                         Chop etish
                       </a>
                     ) : null}
                   </div>
                 </div>
               ) : (
                 <div className="p-5">
                   <p className="text-xs font-medium text-text-secondary">
                     {certificate.message || 'Sertifikat olish uchun kurs talablarini bajaring.'}
                   </p>
                 </div>
               )}
             </div>
           )}

           {/* ACTIONS */}
           <div className="card p-6">
              <h4 className="text-sm font-black text-text-primary mb-4">Tezkor amallar</h4>
              <div className="space-y-3">
                 <Link to={`/courses/${courseId}/forum`} className="flex items-center justify-between p-3 rounded-2xl border border-border/60 hover:border-primary hover:bg-primary/5 text-sm font-bold text-text-secondary hover:text-primary transition-all group">
                    <div className="flex items-center gap-3">
                       <MessageCircle size={18} />
                       Forum
                    </div>
                    <ChevronRight size={16} />
                 </Link>
                 
                 {isTeacher && (
                    <>
                       <Link to={`/courses/${courseId}/manage`} className="flex items-center justify-between p-3 rounded-2xl border border-border/60 hover:border-primary hover:bg-primary/5 text-sm font-bold text-text-secondary hover:text-primary transition-all">
                          <div className="flex items-center gap-3">
                             <Settings size={18} />
                             Boshqarish
                          </div>
                          <ChevronRight size={16} />
                       </Link>
                       <Link to={`/courses/${courseId}/gradebook`} className="flex items-center justify-between p-3 rounded-2xl border border-border/60 hover:border-primary hover:bg-primary/5 text-sm font-bold text-text-secondary hover:text-primary transition-all">
                          <div className="flex items-center gap-3">
                             <Layers3 size={18} />
                             Baholar
                          </div>
                          <ChevronRight size={16} />
                       </Link>
                    </>
                 )}
              </div>
           </div>

           {/* Teacher Meeting Form */}
           {isTeacher && (
             <div className="card p-6 border-l-4 border-l-indigo-500">
                <div className="flex items-center gap-3 mb-4">
                  <CalendarClock className="text-indigo-600" size={18} />
                  <h4 className="text-sm font-black text-text-primary">Meeting yaratish</h4>
                </div>
                {meetingError && <p className="text-xs font-bold text-rose-500 mb-4">{meetingError}</p>}
                <form onSubmit={handleCreateMeeting} className="space-y-3">
                   <input 
                    value={meetingForm.title} 
                    onChange={(e) => setMeetingForm(c => ({...c, title: e.target.value}))}
                    placeholder="Sarlavha" 
                    className="input text-xs" 
                    required 
                   />
                   <input 
                    value={meetingForm.meeting_url} 
                    onChange={(e) => setMeetingForm(c => ({...c, meeting_url: e.target.value}))}
                    placeholder="Havola (URL)" 
                    className="input text-xs" 
                    required 
                   />
                   <input 
                    type="datetime-local" 
                    value={meetingForm.start_time} 
                    onChange={(e) => setMeetingForm(c => ({...c, start_time: e.target.value}))}
                    className="input text-xs" 
                    required 
                   />
                   <div className="grid grid-cols-2 gap-2">
                      <select 
                        value={meetingForm.meeting_type} 
                        onChange={(e) => setMeetingForm(c => ({...c, meeting_type: e.target.value}))}
                        className="input text-xs"
                      >
                         <option value="zoom">Zoom</option>
                         <option value="meet">Google Meet</option>
                      </select>
                      <input 
                        type="number" 
                        value={meetingForm.duration_minutes} 
                        onChange={(e) => setMeetingForm(c => ({...c, duration_minutes: Number(e.target.value)}))}
                        placeholder="Daqiqa" 
                        className="input text-xs" 
                      />
                   </div>
                   <select 
                    value={meetingForm.section_id} 
                    onChange={(e) => setMeetingForm(c => ({...c, section_id: e.target.value}))}
                    className="input text-xs"
                   >
                     <option value="">Bo'lim (ixtiyoriy)</option>
                     {data.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                   </select>
                   <button type="submit" className="btn btn-primary w-full h-10 text-xs">
                      Yaratish
                   </button>
                </form>
             </div>
           )}

        </aside>
      </div>

      <EmbeddedResourceViewer
        open={viewer.open}
        resource={viewer.open ? viewer.resource : null}
        onClose={() => setViewer({ open: false })}
        accentClassName={cn('bg-gradient-to-r', bannerGradient)}
      />

      {/* GLOBAL TOASTS (Success/Error Feedbacks) */}
      {(uploadSuccess || uploadError) && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[110] flex flex-col gap-3 max-w-md w-full px-4 animate-slideUp">
           {uploadSuccess && (
             <div className="p-4 rounded-3xl bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-2xl flex items-center gap-3">
                <CheckCircle size={20} />
                <span className="text-sm font-bold">{uploadSuccess}</span>
                <button onClick={() => setUploadSuccess(null)} className="ml-auto opacity-50"><X size={16} /></button>
             </div>
           )}
           {uploadError && (
             <div className="p-4 rounded-3xl bg-rose-50 text-rose-700 border border-rose-100 shadow-2xl flex items-center gap-3">
                <ShieldCheck size={20} />
                <span className="text-sm font-bold">{uploadError}</span>
                <button onClick={() => setUploadError(null)} className="ml-auto opacity-50"><X size={16} /></button>
             </div>
           )}
        </div>
      )}
    </div>
  );
}

/* LOCAL HELPERS */

function AssignmentRow({ 
  assignment, 
  isStudent, 
  isTeacher,
  uploading,
  onSubmit
}: { 
  key?: number;
  assignment: CourseDetailAssignment, 
  isStudent: boolean,
  isTeacher: boolean,
  uploading: boolean,
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}) {
  const deadlineDate = assignment.deadline ? new Date(assignment.deadline) : null;
  const now = new Date();
  const isPassed = deadlineDate ? deadlineDate < now : false;
  const isNear = deadlineDate ? (deadlineDate.getTime() - now.getTime()) / (1000 * 3600 * 24) <= 3 && !isPassed : false;
  const submission = assignment.latest_submission;

  return (
    <div className="card overflow-hidden hover:border-primary/20 transition-all group">
       <div className="bg-slate-50/50 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex gap-4">
             <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <ClipboardList size={24} />
             </div>
             <div>
                <h4 className="font-bold text-text-primary group-hover:text-primary transition-colors">{assignment.title}</h4>
                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                   <div className={cn(
                     "flex items-center gap-1.5 text-xs font-bold",
                     isPassed ? "text-danger" : isNear ? "text-warning" : "text-text-secondary"
                   )}>
                      <Calendar size={14} />
                      Deadline: {assignment.deadline ? new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(assignment.deadline)) : 'Muddatsiz'}
                   </div>
                   {isPassed && <span className="status-pill status-pill-danger scale-75 origin-left">Muddati o'tgan</span>}
                   {isNear && <span className="status-pill status-pill-warning scale-75 origin-left">Yaqin deadline</span>}
                </div>
             </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
             <div className="text-right">
                <p className="text-[10px] font-black text-text-muted uppercase">Ball</p>
                <p className="text-sm font-black text-text-primary">{assignment.max_score}</p>
             </div>
             {(isTeacher || isStudent) && (
                <Link to={assignment.spa_path} className="btn btn-outline h-10 px-5 text-xs gap-2">
                   Ko'rish <ArrowRight size={14} />
                </Link>
             )}
          </div>
       </div>

       {isStudent && (
          <div className="px-6 py-6 bg-white border-t border-border/40">
             {!submission ? (
               <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
                  <div className="relative group">
                    <input name="file" type="file" required className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className="input flex items-center gap-2 group-hover:border-primary transition-colors py-3">
                       <Paperclip size={16} className="text-text-muted" />
                       <span className="text-sm text-text-muted font-semibold truncate">Fayl tanlang...</span>
                    </div>
                  </div>
                  <input name="comment" placeholder="Izoh (ixtiyoriy)" className="input py-3" />
                  <button 
                    type="submit" 
                    disabled={uploading || isPassed} 
                    className="btn btn-primary sm:col-span-2 h-12 gap-2"
                  >
                    {uploading ? <LoaderCircle className="animate-spin" size={18} /> : <FileUp size={18} />}
                    Faylni topshirish
                  </button>
                  {isPassed && <p className="sm:col-span-2 text-center text-xs font-bold text-danger">Muddati o'tganligi sababli topshirib bo'lmaydi.</p>}
               </form>
             ) : (
                <div className="flex items-center justify-between gap-4 p-4 rounded-[20px] bg-emerald-50/50 border border-emerald-100">
                   <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                         <CheckCircle size={20} />
                      </div>
                      <div>
                         <p className="text-sm font-black text-emerald-700">Topshiriq yuborilgan</p>
                         <p className="text-xs font-bold text-text-muted mt-0.5">
                            {new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(submission.submitted_at))}
                         </p>
                      </div>
                   </div>
                   {submission.score !== null && (
                      <div className="text-right">
                         <p className="text-[10px] font-black text-text-muted uppercase">Baholandi</p>
                         <p className="text-lg font-black text-emerald-600">{submission.score} / {assignment.max_score}</p>
                      </div>
                   )}
                </div>
             )}
          </div>
       )}
    </div>
  );
}

function TestRow({ test, isStudent }: { key?: number; test: DashboardTestItem, isStudent: boolean }) {
  const statusLabels = {
    open: { label: 'Ochiq', color: 'status-pill-success' },
    scheduled: { label: 'Rejalashtirilgan', color: 'status-pill-primary' },
    closed: { label: 'Yopilgan', color: 'status-pill-muted' },
    inactive: { label: 'Nofaol', color: 'status-pill-muted' },
    in_progress: { label: 'Jarayonda', color: 'status-pill-warning' }
  };
  const config = statusLabels[test.status as keyof typeof statusLabels] || statusLabels.closed;

  return (
     <div className="card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:border-primary/20 transition-all">
        <div className="flex gap-4">
           <div className="h-12 w-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
              <FlaskConical size={24} />
           </div>
           <div>
              <h4 className="font-bold text-text-primary leading-tight">{test.name}</h4>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                 <span className={cn("status-pill scale-90 origin-left whitespace-nowrap", config.color)}>
                    {test.status_label}
                 </span>
                 <span className="text-xs font-bold text-text-muted flex items-center gap-1.5 whitespace-nowrap">
                    <Clock size={14} />
                    {test.duration_minutes} daqiqa
                 </span>
                 <span className="text-xs font-bold text-text-muted flex items-center gap-1.5 whitespace-nowrap">
                    <Calendar size={14} />
                    {new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'medium' }).format(new Date(test.end_datetime))} gacha
                 </span>
              </div>
           </div>
        </div>

        <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
           {isStudent && test.last_score !== null && (
             <div className="text-right">
                <p className="text-[10px] font-black text-text-muted uppercase">Natija</p>
                <p className="text-sm font-black text-primary">{test.last_score} / {test.max_score}</p>
             </div>
           )}
           {isStudent && test.status === 'open' && test.attempts_left > 0 ? (
             <Link 
              to={test.spa_take_path || test.take_url}
              className="btn btn-primary h-11 px-6 text-xs gap-2"
             >
               <PlayCircle size={16} />
               Boshlash
             </Link>
           ) : isStudent && test.attempts_done > 0 ? (
             <Link 
              to={test.spa_result_path || test.result_url}
              className="btn btn-outline h-11 px-6 text-xs"
             >
               Natija
             </Link>
           ) : null}
        </div>
     </div>
  );
}

function ChevronRight({ size, className }: { size?: number, className?: string }) {
  return <ArrowRight size={size} className={cn("rotate-[-45deg]", className)} />;
}
