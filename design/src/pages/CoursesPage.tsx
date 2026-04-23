import { FormEvent, useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  GraduationCap, 
  Search, 
  LayoutGrid, 
  List, 
  BookOpen, 
  Plus,
  LoaderCircle,
  XCircle
} from 'lucide-react';
import { fetchCourses } from '@/src/api/lms';
import { CoursesResponse } from '@/src/types';
import { CourseCard } from '@/src/components/lms/CourseCard';
import { SkeletonCourseCard, SkeletonRow } from '@/src/components/lms/SkeletonCard';
import { EmptyState } from '@/src/components/ui/empty-state';
import { StaggerItem, StaggerList } from '@/src/components/ui/stagger-list';
import { cn } from '@/src/lib/utils';

type ViewMode = 'grid' | 'list';
type CourseFilter = 'all' | 'inprogress' | 'done' | 'new';

export default function CoursesPage() {
  const [data, setData] = useState<CoursesResponse | null>(null);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('lms.courses.view') as ViewMode) || 'grid';
  });
  const [activeFilter, setActiveFilter] = useState<CourseFilter>('all');

  useEffect(() => {
    localStorage.setItem('lms.courses.view', viewMode);
  }, [viewMode]);

  const load = async (nextQuery = '') => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchCourses(nextQuery);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kurslar yuklanmadi.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void load(query.trim());
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [query]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void load(query.trim());
  };

  const isStudent = data?.role === 'STUDENT';

  const filteredCourses = useMemo(() => {
    if (!data?.courses) return [];
    
    return data.courses.filter((course) => {
      if (!isStudent || activeFilter === 'all') return true;
      
      const pct = course.progress_percentage ?? 0;
      if (activeFilter === 'inprogress') return pct > 0 && pct < 100;
      if (activeFilter === 'done') return pct === 100;
      if (activeFilter === 'new') return pct === 0;
      
      return true;
    });
  }, [data, activeFilter, isStudent]);

  const counts = useMemo(() => {
    if (!data?.courses) return { all: 0, inprogress: 0, done: 0, new: 0 };
    
    const res = { all: data.courses.length, inprogress: 0, done: 0, new: 0 };
    data.courses.forEach(course => {
      const pct = course.progress_percentage ?? 0;
      if (pct > 0 && pct < 100) res.inprogress++;
      else if (pct === 100) res.done++;
      else if (pct === 0) res.new++;
    });
    return res;
  }, [data]);

  return (
    <div className="space-y-8 animate-slideUp">
      {/* HEADER CARD */}
      <section className="card p-8 lg:p-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <GraduationCap size={28} />
              </div>
              <h2 className="text-3xl font-black tracking-tight text-text-primary">Kurslar</h2>
            </div>
            <p className="mt-4 text-base font-medium leading-7 text-text-secondary">
              {data?.role === 'STUDENT'
                ? 'Sizga biriktirilgan fanlar, o\'zlashtirish darajasi va o\'quv materiallari. O\'z bilimingizni boyitishda davom eting!'
                : 'Barcha kurslar va o\'quv jarayonlari monitoringi. Bu erda siz mavjud kurslarni ko\'rishingiz va boshqarishingiz mumkin.'}
            </p>
            {!isStudent && data?.permissions.can_manage_courses && (
              <div className="mt-6">
                <Link 
                  to="/courses/manage" 
                  className="btn btn-primary gap-2"
                >
                  <Plus size={18} />
                  Kurslarni boshqarish
                </Link>
              </div>
            )}
          </div>

          <form 
            onSubmit={handleSearch} 
            className="flex w-full max-w-md items-center gap-3 rounded-[28px] border border-border bg-slate-50/50 p-2 pl-4 focus-within:bg-white focus-within:shadow-premium transition-all"
          >
            <Search size={18} className="text-text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Kurs nomi bo'yicha qidirish"
              className="w-full bg-transparent text-sm font-semibold text-text-primary outline-none placeholder:text-text-secondary"
            />
            <button className="btn btn-primary h-10 px-5 text-sm">Qidirish</button>
          </form>
        </div>
      </section>

      {/* FILTER & TOGGLE BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {isStudent ? (
          <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-[20px] border border-border/40 overflow-x-auto no-scrollbar">
            {(['all', 'inprogress', 'done', 'new'] as const).map((filter) => {
              const labels = { all: 'Barchasi', inprogress: 'Jarayonda', done: 'Yakunlangan', new: 'Yangi' };
              const isActive = activeFilter === filter;
              return (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={cn(
                    "px-4 py-2 text-xs font-bold rounded-[14px] transition-all whitespace-nowrap flex items-center gap-2",
                    isActive 
                      ? "bg-white text-primary shadow-sm" 
                      : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  {labels[filter]}
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px]",
                    isActive ? "bg-primary/10 text-primary" : "bg-slate-200 text-text-muted transition-colors"
                  )}>
                    {counts[filter]}
                  </span>
                </button>
              );
            })}
          </div>
        ) : <div />}

        <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-[20px] border border-border/40 shrink-0">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              "p-2 px-3 rounded-[14px] transition-all flex items-center gap-2 text-xs font-bold",
              viewMode === 'grid' ? "bg-white text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
            )}
          >
            <LayoutGrid size={16} />
            <span className="hidden md:inline">Grid</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              "p-2 px-3 rounded-[14px] transition-all flex items-center gap-2 text-xs font-bold",
              viewMode === 'list' ? "bg-white text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
            )}
          >
            <List size={16} />
            <span className="hidden md:inline">List</span>
          </button>
        </div>
      </div>

      {/* COURSES CONTENT */}
      {isLoading ? (
        viewMode === 'grid' ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
             {[...Array(6)].map((_, i) => <SkeletonCourseCard key={i} />)}
          </div>
        ) : (
          <div className="card overflow-hidden">
             {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
          </div>
        )
      ) : error ? (
        <div className="card p-10 text-center border-rose-100 bg-rose-50/30">
           <XCircle className="mx-auto text-rose-500 mb-4" size={40} />
           <p className="text-xl font-black text-text-primary">Xatolik yuz berdi</p>
           <p className="mt-2 text-sm font-medium text-rose-500 max-w-sm mx-auto">{error}</p>
           <button onClick={() => void load()} className="btn btn-primary mt-6">Qayta yuklash</button>
        </div>
      ) : filteredCourses.length > 0 ? (
        viewMode === 'grid' ? (
          <StaggerList className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filteredCourses.map(course => (
              <StaggerItem key={course.id}>
                <CourseCard
                  course={course}
                  variant="grid"
                  href={course.spa_path || `/courses/${course.id}`}
                  role={data?.role || 'STUDENT'}
                />
              </StaggerItem>
            ))}
          </StaggerList>
        ) : (
          <div className="card overflow-hidden animate-slideUp">
             <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                   <div className="grid grid-cols-[1.5fr_1fr_0.6fr_0.6fr_1fr_80px] gap-4 px-8 py-4 bg-slate-50 border-b border-border text-[11px] font-black text-text-muted uppercase tracking-wider">
                      <div>Kurs nomi</div>
                      <div>O'qituvchi</div>
                      <div className="text-center">Bo'limlar</div>
                      <div className="text-center">Testlar</div>
                      <div>Progress</div>
                      <div className="text-right">Amallar</div>
                   </div>
                   <div className="divide-y divide-border/60">
                      {filteredCourses.map(course => (
                        <CourseCard 
                          key={course.id} 
                          course={course} 
                          variant="list" 
                          href={course.spa_path || `/courses/${course.id}`}
                          role={data?.role || 'STUDENT'}
                        />
                      ))}
                   </div>
                </div>
             </div>
          </div>
        )
      ) : (
        <EmptyState
          icon={BookOpen}
          title="Kurslar topilmadi"
          description="Tanlangan parametrlar bo'yicha hech qanday kurs topilmadi."
          className="animate-slideUp"
          action={
            activeFilter !== 'all'
              ? { label: "Barcha kurslarni ko'rish", onClick: () => setActiveFilter('all') }
              : query
                ? { label: 'Qidiruvni tozalash', onClick: () => { setQuery(''); void load(); } }
                : undefined
          }
        />
      )}
    </div>
  );
}
