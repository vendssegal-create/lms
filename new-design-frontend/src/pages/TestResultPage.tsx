import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { fetchTestResult } from '@/src/api/lms';

function formatDateTime(value: string | null) {
  if (!value) return 'Belgilanmagan';
  return new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function TestResultPage() {
  const params = useParams();
  const testId = Number(params.testId || 0);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchTestResult>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchTestResult(testId);
        if (active) setData(response);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Natija yuklanmadi.');
      } finally {
        if (active) setIsLoading(false);
      }
    }
    if (testId) void load();
    return () => {
      active = false;
    };
  }, [testId]);

  if (isLoading) {
    return (
      <div className="card flex min-h-[320px] items-center justify-center gap-3 p-8 text-text-secondary">
        <LoaderCircle className="animate-spin text-primary" size={20} />
        Natija yuklanmoqda...
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="card p-8">
        <p className="text-lg font-black text-text-primary">Natija yuklanmadi</p>
        <p className="mt-3 text-sm font-medium text-rose-500">{error || 'Nomaʼlum xatolik.'}</p>
        <Link to="/tests" className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-bold text-text-primary">
          <ArrowLeft size={16} />
          Testlar ro'yxati
        </Link>
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
        <h2 className="mt-3 text-3xl font-black tracking-tight text-text-primary">{data.test.name}</h2>
        <p className="mt-3 text-sm font-medium text-text-secondary">{data.test.course.title}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">
            {data.attempt.score} / {data.attempt.max_score}
          </div>
          <div className="rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold text-text-primary">
            To'g'ri: {data.attempt.correct_count} / {data.attempt.total_questions}
          </div>
          <div className="rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold text-text-primary">
            Tugagan: {formatDateTime(data.attempt.finished_at)}
          </div>
        </div>
      </section>

      <section className="space-y-6">
        {data.items.map((item) => (
          <div key={item.question_id} className="card p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="label-micro text-text-secondary">Savol {item.number}</p>
                <p className="mt-2 text-lg font-black leading-7 text-text-primary">{item.question_text}</p>
              </div>
              <div className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide ${item.is_correct ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {item.is_correct ? 'Correct' : 'Wrong'}
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-border bg-slate-50 p-5">
                <p className="label-micro">Sizning javob</p>
                <p className="mt-3 text-sm font-bold text-text-primary">{item.user_answer_text || 'Javob berilmagan'}</p>
              </div>
              <div className="rounded-[24px] border border-border bg-slate-50 p-5">
                <p className="label-micro">To'g'ri javob</p>
                <p className="mt-3 text-sm font-bold text-text-primary">{item.correct_answer_text}</p>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
