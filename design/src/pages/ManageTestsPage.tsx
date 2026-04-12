import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, LoaderCircle } from 'lucide-react';
import { createTeacherTest, fetchTeacherCourses } from '@/src/api/lms';
import { useAuth } from '@/src/features/auth/auth-context';

export default function ManageTestsPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [courses, setCourses] = useState<Array<{ id: number; title: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = Boolean(session?.authenticated && session?.user && session.user.active_role && session.user.active_role !== 'STUDENT');

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchTeacherCourses();
        if (active) setCourses(response.courses);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Kurslar yuklanmadi.');
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const defaultCourseId = useMemo(() => (courses[0]?.id ? String(courses[0].id) : ''), [courses]);
  const [courseId, setCourseId] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    if (!courseId && defaultCourseId) setCourseId(defaultCourseId);
  }, [courseId, defaultCourseId]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!canManage) {
      setError("Sizda test boshqarish ruxsati yo'q.");
      return;
    }
    if (!courseId) {
      setError('Kurs tanlang.');
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      const response = await createTeacherTest({
        course_id: Number(courseId),
        name: name || 'Yangi test',
        is_active: true,
        duration_minutes: 30,
        max_score: 100,
        attempts_allowed: 1,
        question_count: 10,
        is_random_order: false,
        proctoring_enabled: false,
        face_id_required: false,
        max_tab_switches: 3,
      });
      await navigate(response.edit_path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test yaratilmagan.');
    } finally {
      setIsCreating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="card flex min-h-[320px] items-center justify-center gap-3 p-8 text-text-secondary">
        <LoaderCircle className="animate-spin text-primary" size={20} />
        Ma'lumot yuklanmoqda...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="card p-8 lg:p-10">
        <Link to="/tests" className="inline-flex items-center gap-2 text-sm font-bold text-text-secondary hover:text-text-primary">
          <ArrowLeft size={16} />
          Testlar
        </Link>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-text-primary">Test yaratish</h2>
        <p className="mt-3 text-sm font-medium text-text-secondary">Yangi test yarating va keyin savollarni qo'shing.</p>
        {error ? <p className="mt-4 text-sm font-semibold text-rose-500">{error}</p> : null}
      </section>

      <section className="card p-8">
        <form className="grid gap-4 md:grid-cols-[1fr_2fr_auto]" onSubmit={(e) => void handleCreate(e)}>
          <select
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
            className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary"
          >
            <option value="">Kurs tanlang</option>
            {courses.map((course) => (
              <option key={course.id} value={String(course.id)}>{course.title}</option>
            ))}
          </select>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Test nomi"
            className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none"
          />
          <button
            type="submit"
            disabled={isCreating}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white disabled:opacity-70"
          >
            {isCreating ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />}
            Yaratish
          </button>
        </form>
      </section>
    </div>
  );
}

