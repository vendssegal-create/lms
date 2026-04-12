import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, LoaderCircle, Send } from 'lucide-react';
import { fetchForumTopic, replyForumTopic } from '@/src/api/lms';

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function ForumTopicPage() {
  const params = useParams();
  const topicId = Number(params.topicId || 0);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchForumTopic>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchForumTopic(topicId);
        if (active) setData(response);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Mavzu yuklanmadi.');
      } finally {
        if (active) setIsLoading(false);
      }
    }
    if (topicId) void load();
    return () => { active = false; };
  }, [topicId]);

  async function send(event: FormEvent) {
    event.preventDefault();
    setIsSending(true);
    setError(null);
    try {
      const response = await replyForumTopic(topicId, { content });
      setData((current) => current ? ({ ...current, replies: [...current.replies, response.reply] }) : current);
      setContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yuborilmadi.');
    } finally {
      setIsSending(false);
    }
  }

  if (isLoading) {
    return (
      <div className="card flex min-h-[320px] items-center justify-center gap-3 p-8 text-text-secondary">
        <LoaderCircle className="animate-spin text-primary" size={20} />
        Mavzu yuklanmoqda...
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="card p-8">
        <p className="text-lg font-black text-text-primary">Mavzu yuklanmadi</p>
        <p className="mt-3 text-sm font-medium text-rose-500">{error || 'Nomaʼlum xatolik.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="card p-8 lg:p-10">
        <Link to={`/courses/${data.topic.course.id}/forum`} className="inline-flex items-center gap-2 text-sm font-bold text-text-secondary hover:text-text-primary">
          <ArrowLeft size={16} />
          Forum
        </Link>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-text-primary">{data.topic.title}</h2>
        <p className="mt-3 text-sm font-medium text-text-secondary">{data.topic.author_name} | {formatDateTime(data.topic.created_at)}</p>
        <p className="mt-6 text-sm font-medium leading-7 text-text-secondary">{data.topic.content}</p>
      </section>

      <section className="card p-8">
        <h3 className="text-xl font-black text-text-primary">Javob yozish</h3>
        <form className="mt-6 flex flex-col gap-4 md:flex-row" onSubmit={(e) => void send(e)}>
          <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Javob matni" className="flex-1 rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none" />
          <button type="submit" disabled={isSending} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white disabled:opacity-70">
            <Send size={16} />
            Yuborish
          </button>
        </form>
      </section>

      <section className="space-y-4">
        {data.replies.length ? data.replies.map((r) => (
          <div key={r.id} className="card p-6">
            <p className="text-sm font-black text-text-primary">{r.author_name}</p>
            <p className="mt-2 text-sm font-medium leading-7 text-text-secondary">{r.content}</p>
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-text-secondary">{formatDateTime(r.created_at)}</p>
          </div>
        )) : (
          <div className="card p-8">
            <p className="text-lg font-black text-text-primary">Javob yo'q</p>
            <p className="mt-3 text-sm font-medium text-text-secondary">Birinchi bo‘lib javob yozing.</p>
          </div>
        )}
      </section>
    </div>
  );
}

