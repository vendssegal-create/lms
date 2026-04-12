import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, LoaderCircle, Plus } from 'lucide-react';
import { createForumTopic, fetchForumTopics } from '@/src/api/lms';

export default function CourseForumPage() {
  const params = useParams();
  const navigate = useNavigate();
  const courseId = Number(params.courseId || 0);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchForumTopics>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchForumTopics(courseId);
        if (active) setData(response);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Forum yuklanmadi.');
      } finally {
        if (active) setIsLoading(false);
      }
    }
    if (courseId) void load();
    return () => { active = false; };
  }, [courseId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsCreating(true);
    setError(null);
    try {
      const response = await createForumTopic(courseId, { title, content });
      await navigate(response.spa_path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mavzu yaratilmadi.');
    } finally {
      setIsCreating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="card flex min-h-[320px] items-center justify-center gap-3 p-8 text-text-secondary">
        <LoaderCircle className="animate-spin text-primary" size={20} />
        Forum yuklanmoqda...
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="card p-8">
        <p className="text-lg font-black text-text-primary">Forum yuklanmadi</p>
        <p className="mt-3 text-sm font-medium text-rose-500">{error || 'Nomaʼlum xatolik.'}</p>
        <Link to={`/courses/${courseId}`} className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-bold text-text-primary">
          <ArrowLeft size={16} />
          Kursga qaytish
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="card p-8 lg:p-10">
        <Link to={data.course.spa_path} className="inline-flex items-center gap-2 text-sm font-bold text-text-secondary hover:text-text-primary">
          <ArrowLeft size={16} />
          {data.course.title}
        </Link>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-text-primary">Forum</h2>
        {error ? <p className="mt-4 text-sm font-semibold text-rose-500">{error}</p> : null}
      </section>

      <section className="card p-8">
        <h3 className="text-xl font-black text-text-primary">Yangi mavzu</h3>
        <form className="mt-6 space-y-4" onSubmit={(e) => void submit(e)}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sarlavha" className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Matn" className="h-40 w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none" />
          <button type="submit" disabled={isCreating} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-white disabled:opacity-70">
            <Plus size={16} />
            Yaratish
          </button>
        </form>
      </section>

      <section className="space-y-4">
        {data.topics.length ? data.topics.map((t) => (
          <Link key={t.id} to={t.spa_path} className="card block p-6 transition-all hover:-translate-y-0.5 hover:shadow-xl">
            <p className="text-sm font-black text-text-primary">{t.title}</p>
            <p className="mt-2 text-sm font-medium text-text-secondary">{t.author_name}</p>
            <p className="mt-3 text-sm font-medium leading-7 text-text-secondary line-clamp-2">{t.content}</p>
          </Link>
        )) : (
          <div className="card p-8">
            <p className="text-lg font-black text-text-primary">Mavzu yo'q</p>
            <p className="mt-3 text-sm font-medium text-text-secondary">Hozircha forum bo'sh.</p>
          </div>
        )}
      </section>
    </div>
  );
}

