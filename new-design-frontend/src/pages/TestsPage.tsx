import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FileCheck2, LoaderCircle, Plus, ShieldCheck } from 'lucide-react';
import { fetchTests } from '@/src/api/lms';
import { TestsResponse } from '@/src/types';

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Belgilanmagan';
  }

  return new Intl.DateTimeFormat('uz-UZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function TestsPage() {
  const [data, setData] = useState<TestsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchTests();
        if (active) {
          setData(response);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Testlar yuklanmadi.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      <section className="card p-8 lg:p-10">
        <div className="flex items-center gap-3">
          <FileCheck2 className="text-primary" size={22} />
          <h2 className="text-3xl font-black tracking-tight text-text-primary">Tests workspace</h2>
        </div>
        <p className="mt-4 max-w-3xl text-sm font-medium leading-7 text-text-secondary">
          {data?.role === 'STUDENT'
            ? 'Faol test oynalari, urinishlar soni va natijalar shu yerda boshqariladi.'
            : 'Testlar ro‘yxati va holati backend API dan olinmoqda. Keyingi bosqichda create/edit ham SPA ga ko‘chadi.'}
        </p>
        {data?.role !== 'STUDENT' && data?.permissions.can_manage_tests ? (
          <Link to="/tests/manage" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white">
            <Plus size={16} />
            Test yaratish
          </Link>
        ) : null}
      </section>

      {isLoading ? (
        <div className="card flex min-h-[240px] items-center justify-center gap-3 p-8 text-text-secondary">
          <LoaderCircle className="animate-spin text-primary" size={20} />
          Testlar yuklanmoqda...
        </div>
      ) : error ? (
        <div className="card p-8">
          <p className="text-lg font-black text-text-primary">Testlar yuklanmadi</p>
          <p className="mt-3 text-sm font-medium text-rose-500">{error}</p>
        </div>
      ) : (
        <>
          <section className="grid gap-6 md:grid-cols-3">
            {Object.entries(data?.summary || {}).map(([key, value]) => (
              <div key={key} className="card p-6">
                <p className="label-micro">{key.replaceAll('_', ' ')}</p>
                <p className="mt-3 text-3xl font-black text-text-primary">{value}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            {data?.tests.length ? (
              data.tests.map((test) => (
                <div key={test.id} className="card p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-2xl font-black tracking-tight text-text-primary">{test.name}</p>
                      <p className="mt-2 text-sm font-medium text-text-secondary">{test.course.title}</p>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-text-secondary">
                      {test.status_label}
                    </div>
                  </div>
                  <p className="mt-4 text-sm font-medium leading-7 text-text-secondary">{test.description || 'Tavsif kiritilmagan.'}</p>
                  <div className="mt-6 grid gap-3 text-sm font-semibold text-text-secondary md:grid-cols-2">
                    <span>Boshlanishi: {formatDateTime(test.start_datetime)}</span>
                    <span>Tugashi: {formatDateTime(test.end_datetime)}</span>
                    <span>Davomiyligi: {test.duration_minutes} daqiqa</span>
                    <span>Urinishlar: {test.attempts_done}/{test.attempts_allowed}</span>
                    <span>Ball: {test.max_score}</span>
                    <span>Savollar: {test.question_count}</span>
                  </div>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    {test.proctoring_enabled ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                        <ShieldCheck size={14} />
                        Proctoring
                      </span>
                    ) : null}
                    {data.role === 'STUDENT' && (test.status === 'open' || test.status === 'in_progress') ? (
                      <Link to={test.spa_take_path} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white">
                        Testni ochish
                        <ExternalLink size={16} />
                      </Link>
                    ) : null}
                    {data.role === 'STUDENT' && test.last_score !== null ? (
                      <Link to={test.spa_result_path} className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-bold text-text-primary">
                        Natijani ko'rish
                        <ExternalLink size={16} />
                      </Link>
                    ) : null}
                    {data.role !== 'STUDENT' && data.permissions.can_manage_tests ? (
                      <Link to={test.spa_edit_path || test.edit_url} className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-bold text-text-primary">
                        Testni tahrirlash
                        <ExternalLink size={16} />
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="card p-8">
                <p className="text-lg font-black text-text-primary">Test topilmadi</p>
                <p className="mt-3 text-sm font-medium text-text-secondary">Hozircha ko'rsatish uchun test yo'q.</p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
