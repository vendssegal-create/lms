import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, LoaderCircle, Plus, Settings2, UserPlus, Users, Pencil, Trash2, FileText } from 'lucide-react';
import { createCourse, deleteCourse, fetchCourses } from '@/src/api/lms';
import type { CoursesResponse } from '@/src/types';

export default function ManageCoursesPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<CoursesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    deadline: '',
    is_active: true,
  });

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchCourses('');
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kurslar yuklanmadi.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsCreating(true);
    setError(null);
    try {
      const response = await createCourse({
        title: form.title,
        description: form.description,
        deadline: form.deadline || undefined,
        is_active: form.is_active,
      });
      await navigate(response.manage_path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kurs yaratilmadi.');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(courseId: number) {
    if (!window.confirm("Kursni o'chirmoqchimisiz?")) return;
    setError(null);
    try {
      await deleteCourse(courseId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kurs o'chirilmadi.");
    }
  }

  if (isLoading) {
    return (
      <div className="card flex min-h-[320px] items-center justify-center gap-3 p-8 text-text-secondary">
        <LoaderCircle className="animate-spin text-primary" size={20} />
        Kurslar yuklanmoqda...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="card p-8 lg:p-10">
        <Link to="/courses" className="inline-flex items-center gap-2 text-sm font-bold text-text-secondary hover:text-text-primary">
          <ArrowLeft size={16} />
          Kurslar
        </Link>
        <div className="section-header mt-4">
          <h3 className="flex items-center gap-2">
            <BookOpen size={18} className="text-primary" />
            Kurslar galereyasi
          </h3>
          {data?.permissions.can_manage_courses ? (
            <button
              type="button"
              onClick={() => document.getElementById('create-course-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="btn btn-primary"
            >
              <Plus size={16} />
              Yangi kurs
            </button>
          ) : null}
        </div>
        {error ? <p className="mt-4 text-sm font-semibold text-rose-500">{error}</p> : null}
      </section>

      {data?.permissions.can_manage_courses ? (
        <section id="create-course-form" className="card p-8">
          <h3 className="text-xl font-black text-text-primary">Yangi kurs</h3>
          <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={(e) => void submit(e)}>
            <label className="space-y-2 md:col-span-2">
              <span className="label-micro">Title</span>
              <input value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} className="input" />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="label-micro">Description</span>
              <textarea value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} className="input h-28" />
            </label>
            <label className="space-y-2">
              <span className="label-micro">Deadline</span>
              <input type="date" value={form.deadline} onChange={(e) => setForm((c) => ({ ...c, deadline: e.target.value }))} className="input" />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-bold text-text-primary">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((c) => ({ ...c, is_active: e.target.checked }))} className="h-5 w-5 accent-primary" />
              Active
            </label>
            <button type="submit" disabled={isCreating} className="md:col-span-2 btn btn-primary">
              {isCreating ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />}
              Yaratish
            </button>
          </form>
        </section>
      ) : null}

      <section className="course-grid">
        {data?.courses?.length ? data.courses.map((course) => (
          <div key={course.id} className="course-card">
            <div className="course-card-img">
              {course.image_url ? (
                <img src={course.image_url} alt={course.title} loading="lazy" />
              ) : (
                <div className="card-placeholder">
                  <BookOpen size={28} />
                </div>
              )}
              <div className="course-card-overlay">
                <span className={`status-pill ${course.is_active ? 'status-pill-success' : 'status-pill-muted'}`}>
                  {course.is_active ? 'Faol' : 'Nofaol'}
                </span>
              </div>
            </div>
            <div className="course-card-body">
              <h4 className="text-lg font-black text-text-primary">{course.title}</h4>
              <div className="card-teacher">
                <Users size={14} />
                {course.teacher?.full_name || 'Teacher'}
              </div>
              <div className="course-card-stats">
                <div className="stat-item"><Users size={14} /> {course.students_count} talaba</div>
                <div className="stat-item"><FileText size={14} /> {course.tests_count} test</div>
                <div className="stat-item"><BookOpen size={14} /> {course.sections_count} bolim</div>
              </div>
              <div className="course-card-actions">
                <Link to={`/courses/${course.id}`} className="btn btn-primary">
                  Kirish
                  <Settings2 size={16} />
                </Link>
                {data.permissions.can_manage_courses ? (
                  <Link to={`/courses/${course.id}/manage`} className="btn btn-outline">
                    <Pencil size={16} />
                    Tahrirlash
                  </Link>
                ) : null}
                {data.permissions.can_manage_courses ? (
                  <Link to={`/courses/${course.id}/gradebook`} className="btn btn-ghost">
                    <FileText size={16} />
                    Gradebook
                  </Link>
                ) : null}
                {data.permissions.can_manage_courses ? (
                  <Link to={`/courses/${course.id}/manage`} className="btn btn-ghost">
                    <UserPlus size={16} />
                    Biriktirish
                  </Link>
                ) : null}
                {data.permissions.can_manage_courses ? (
                  <button type="button" onClick={() => void handleDelete(course.id)} className="btn btn-ghost text-danger">
                    <Trash2 size={16} />
                    O'chirish
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )) : (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <div className="empty-icon">
              <BookOpen size={24} />
            </div>
            <p>Kurslar topilmadi.</p>
            {data?.permissions.can_manage_courses ? (
              <button type="button" onClick={() => document.getElementById('create-course-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="btn btn-primary">
                <Plus size={16} />
                Birinchi kursni yarating
              </button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
