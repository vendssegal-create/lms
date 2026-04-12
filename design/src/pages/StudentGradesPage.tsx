import { type ReactNode, useEffect, useState, useMemo } from 'react';
import { fetchStudentGrades } from '@/src/api/lms';
import { GradeRow } from '@/src/components/lms/GradeRow';
import { ProgressRing } from '@/src/components/lms/ProgressRing';
import { SkeletonRow } from '@/src/components/lms/SkeletonCard';
import { 
  GraduationCap, 
  BookOpen, 
  RotateCcw, 
  ChevronRight, 
  AlertCircle,
  TrendingUp,
  FileText,
  Calendar
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

type GradesTab = 'lms' | 'retake';

export default function StudentGradesPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchStudentGrades>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<GradesTab>('lms');

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchStudentGrades();
        if (active) setData(response);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Natijalar yuklanmadi.');
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const gpa = useMemo(() => {
    if (!data?.lms.length) return null;
    const scores = data.lms
      .map(item => item.entry?.total ?? null)
      .filter((s): s is number => s !== null);
    if (!scores.length) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10;
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-8 animate-slideUp">
        <div className="h-48 rounded-[40px] bg-slate-200 animate-pulse shimmer" />
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-border/60 flex gap-4">
             <div className="h-10 w-32 bg-slate-100 rounded-2xl shimmer" />
             <div className="h-10 w-32 bg-slate-100 rounded-2xl shimmer" />
          </div>
          <div className="p-4 space-y-4">
            {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card p-12 text-center">
        <div className="h-16 w-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
           <AlertCircle size={32} />
        </div>
        <h3 className="text-xl font-black text-text-primary">Xatolik yuz berdi</h3>
        <p className="mt-2 text-text-secondary max-w-sm mx-auto">{error || "Ma'lumotlarni yuklab bo'lmadi."}</p>
        <button onClick={() => window.location.reload()} className="btn btn-primary mt-8 px-8">Qayta urinish</button>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-slideUp">
      
      {/* SECTION 1: HEADER BANNER */}
      <section className="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-primary via-primary-hover to-[#3A0CA3] px-8 py-10 lg:px-12 lg:py-12 text-white shadow-2xl">
        {/* Subtle Pattern Overlay */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg className="h-full w-full" width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="1" fill="white" />
            <circle cx="50" cy="50" r="1" fill="white" />
            <circle cx="90" cy="90" r="1" fill="white" />
            <circle cx="10" cy="90" r="1" fill="white" />
            <circle cx="90" cy="10" r="1" fill="white" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <span className="label-micro text-white/50 tracking-[0.2em]">TALABA BAHONOMASI</span>
            <h2 className="mt-4 text-4xl font-black tracking-tight lg:text-5xl leading-tight text-white">
              Baholarim
            </h2>
            <p className="mt-4 text-base font-medium text-white/70 max-w-md">
              LMS kurslari va retake natijalari jamlangan yagona platforma.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 bg-white/5 backdrop-blur-md rounded-[32px] p-6 border border-white/10 shadow-xl min-w-[180px]">
            <ProgressRing 
              percentage={gpa ?? 0} 
              size={100} 
              strokeWidth={8} 
              color="success" 
            />
            <div className="text-center">
              <p className="text-sm font-black text-white/90">O'rtacha ball</p>
              <p className="text-2xl font-black text-success mt-1">{gpa ?? '—'}</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: TABS */}
      <div className="flex flex-col gap-6">
        <div className="flex bg-slate-100/50 p-1.5 rounded-[24px] border border-border/40 w-fit">
          <button
            onClick={() => setActiveTab('lms')}
            className={cn(
              "px-6 py-2.5 rounded-[20px] text-sm font-bold transition-all flex items-center gap-2",
              activeTab === 'lms' 
                ? "bg-white text-primary shadow-premium" 
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            <BookOpen size={16} />
            LMS baholar 
            <span className="opacity-50 font-medium tracking-normal ml-1">({data.lms.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('retake')}
            className={cn(
              "px-6 py-2.5 rounded-[20px] text-sm font-bold transition-all flex items-center gap-2",
              activeTab === 'retake' 
                ? "bg-white text-primary shadow-premium" 
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            <RotateCcw size={16} />
            Retake natijalari
            <span className="opacity-50 font-medium tracking-normal ml-1">({data.retake.length})</span>
          </button>
        </div>

        {/* CONTENT AREA */}
        <div className="card overflow-hidden">
          {activeTab === 'lms' ? (
            <div className="animate-slideUp">
              {data.lms.length > 0 ? (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <div className="min-w-[800px]">
                      <div className="grid grid-cols-[1fr_80px_80px_80px_100px_40px] gap-6 px-8 py-4 bg-slate-50 border-b border-border text-[10px] font-black text-text-muted uppercase tracking-widest items-center">
                        <div>Fan va o'qituvchi</div>
                        <div>Joriy</div>
                        <div>Oraliq</div>
                        <div>Yakuniy</div>
                        <div className="text-center">Jami ball</div>
                        <div></div>
                      </div>
                      <div className="divide-y divide-border/40">
                        {data.lms.map((item) => (
                          <GradeRow 
                            key={item.course.id}
                            courseName={item.course.title}
                            teacherName={item.course.teacher?.full_name}
                            current={item.entry?.current}
                            currentMax={item.gradebook?.current_max}
                            midterm={item.entry?.midterm}
                            midtermMax={item.gradebook?.midterm_max}
                            final={item.entry?.final}
                            finalMax={item.gradebook?.final_max}
                            total={item.entry?.total}
                            courseHref={item.course.spa_path}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden p-4 space-y-4">
                    {data.lms.map((item) => (
                      <div key={item.course.id} className="p-5 rounded-[28px] border border-border bg-slate-50/50 space-y-4">
                        <div className="flex justify-between items-start gap-3">
                          <h4 className="font-bold text-text-primary leading-tight">{item.course.title}</h4>
                          <span className={cn(
                            "px-3 py-1 rounded-xl text-xs font-black shrink-0",
                            (item.entry?.total || 0) >= 60 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-text-muted"
                          )}>
                             {item.entry?.total ?? '-'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                           <div className="bg-white p-2 rounded-xl border border-border/50 text-center">
                              <p className="text-[9px] font-bold text-text-muted uppercase">Joriy</p>
                              <p className="text-xs font-bold text-text-primary">{item.entry?.current ?? '-'}</p>
                           </div>
                           <div className="bg-white p-2 rounded-xl border border-border/50 text-center">
                              <p className="text-[9px] font-bold text-text-muted uppercase">Oraliq</p>
                              <p className="text-xs font-bold text-text-primary">{item.entry?.midterm ?? '-'}</p>
                           </div>
                           <div className="bg-white p-2 rounded-xl border border-border/50 text-center">
                              <p className="text-[9px] font-bold text-text-muted uppercase">Yakuniy</p>
                              <p className="text-xs font-bold text-text-primary">{item.entry?.final ?? '-'}</p>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState icon={<BookOpen size={48} />} title="Hali baholar mavjud emas" />
              )}
            </div>
          ) : (
            <div className="p-6 space-y-4 animate-slideUp">
              {data.retake.length > 0 ? (
                data.retake.map((item, idx) => {
                  const statusColors = {
                    approved: 'bg-emerald-500 border-emerald-500 text-emerald-600',
                    passed: 'bg-emerald-500 border-emerald-500 text-emerald-600',
                    rejected: 'bg-rose-500 border-rose-500 text-rose-600',
                    failed: 'bg-rose-500 border-rose-500 text-rose-600',
                    pending: 'bg-amber-500 border-amber-500 text-amber-600',
                    default: 'bg-slate-300 border-slate-300 text-slate-500'
                  };
                  const colorKey = item.status.toLowerCase() as keyof typeof statusColors;
                  const config = statusColors[colorKey] || statusColors.default;

                  return (
                    <div key={idx} className="relative overflow-hidden rounded-[26px] border border-border bg-white shadow-sm hover:shadow-premium transition-all">
                      <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", config.split(' ')[0])} />
                      <div className="p-5 pl-7 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-text-primary text-base mb-1 truncate">{data.retake[idx].subject_name}</h4>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-bold text-text-secondary">
                             <span className="flex items-center gap-1.5">
                               <FileText size={14} className="text-text-muted" />
                               {item.control_type}
                             </span>
                             <span className="flex items-center gap-1.5">
                               <Calendar size={14} className="text-text-muted" />
                               {item.date ? new Intl.DateTimeFormat('uz-UZ').format(new Date(item.date)) : 'Sana belgilanmagan'}
                             </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 justify-between md:justify-end">
                           <div className="text-right">
                              <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Ball</p>
                              <p className="text-lg font-black text-text-primary">
                                {item.score} <span className="text-xs text-text-muted">max</span>
                              </p>
                           </div>
                           <div className="flex flex-col items-end gap-2">
                              <span className={cn(
                                "status-pill scale-90",
                                config.split(' ')[2].replace('text-', 'status-pill-').replace('600', '')
                              )}>
                                {item.status}
                              </span>
                              {item.is_absent && (
                                <span className="status-pill status-pill-danger scale-75 origin-right">Qatnashmagan</span>
                              )}
                           </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState icon={<RotateCcw size={48} />} title="Retake natijalari topilmadi" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, title }: { icon: ReactNode, title: string }) {
  return (
    <div className="py-20 text-center flex flex-col items-center animate-slideUp">
      <div className="h-20 w-20 rounded-[32px] bg-slate-50 text-slate-200 flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-2xl font-black text-text-primary">{title}</h3>
      <p className="mt-2 text-text-secondary max-w-xs mx-auto">
        Hozircha ushbu bo'limda hech qanday ma'lumot topilmadi.
      </p>
    </div>
  );
}
