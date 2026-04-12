import { useEffect, useMemo, useState } from 'react';
import { Activity, Database, RefreshCw, ServerCog, ShieldCheck, Zap } from 'lucide-react';
import { fetchRetakeSyncPanel, runRetakeSync, testRetakeSyncConnection } from '@/src/api/retake';
import type { RetakeSyncPanelResponse, RetakeSyncTestResponse } from '@/src/types';
import { cn } from '@/src/lib/utils';

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('uz-UZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

const scopeLabels: Record<string, string> = {
  all: "Barcha ma'lumotlar",
  students: 'Talabalar',
  teachers: "O'qituvchilar",
  curriculums: "O'quv rejalari",
  rooms: 'Xonalar',
};

export default function RetakeSyncPage() {
  const [data, setData] = useState<RetakeSyncPanelResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<RetakeSyncTestResponse | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await fetchRetakeSyncPanel();
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync panel yuklanmadi.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!data?.has_running) return;
    const timer = window.setInterval(() => {
      void load();
    }, 8000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.has_running]);

  async function handleTestConnection() {
    setIsTesting(true);
    setError(null);
    setMessage(null);
    try {
      const payload = await testRetakeSyncConnection();
      setTestResult(payload);
      setMessage(payload.success ? 'Ulanish muvaffaqiyatli.' : 'Ulanishda xatolik bor.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ulanish tekshiruvi bajarilmadi.');
    } finally {
      setIsTesting(false);
    }
  }

  async function handleRun(scope: string) {
    setIsRunning(true);
    setError(null);
    setMessage(null);
    try {
      const payload = await runRetakeSync(scope);
      setMessage(payload.message || 'Sinxronlash boshlandi.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sinxronlash boshlanmadi.');
    } finally {
      setIsRunning(false);
    }
  }

  const stats = useMemo(() => {
    if (!data) return [];
    return [
      { label: 'Talabalar', value: data.db_stats.students },
      { label: "O'qituvchilar", value: data.db_stats.teachers },
      { label: 'Rejalar', value: data.db_stats.curriculums },
      { label: 'Xonalar', value: data.db_stats.rooms },
    ];
  }, [data]);

  return (
    <div className="space-y-8">
      <section className="card p-8 lg:p-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary">
              <ServerCog size={12} />
              Retake sync
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-text-primary">HEMIS sinxronlash</h2>
            <p className="mt-3 max-w-3xl text-sm font-medium text-text-secondary">
              HEMIS bilan ulanish holati, sinxronlash scope va loglar.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-bold text-text-primary"
            >
              <RefreshCw size={16} />
              Yangilash
            </button>
            <span
              className={cn(
                'rounded-2xl px-3 py-2 text-xs font-extrabold uppercase tracking-wider',
                data?.has_running ? 'bg-warning/10 text-warning' : 'bg-emerald-50 text-emerald-700'
              )}
            >
              {data?.has_running ? 'Jarayonda' : 'Tayyor'}
            </span>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger">{error}</div> : null}
      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div> : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <div className="card p-6 lg:p-8">
          <div className="flex items-center gap-3">
            <ShieldCheck size={18} className="text-primary" />
            <h3 className="text-lg font-black text-text-primary">Ulanish va sozlama</h3>
          </div>
          <div className="mt-4 space-y-2 text-sm font-semibold text-text-secondary">
            <p>
              HEMIS base URL: <span className="font-black text-text-primary">{data?.hemis_base_url || '-'}</span>
            </p>
            <p>
              Config holati:{' '}
              <span className={cn('font-black', data?.config_ok ? 'text-emerald-600' : 'text-danger')}>
                {data?.config_ok ? 'To`liq' : 'To`liq emas'}
              </span>
            </p>
          </div>
          {!data?.config_ok ? (
            <div className="mt-4 rounded-2xl bg-warning/10 px-4 py-3 text-sm font-bold text-warning">
              `HEMIS_BACKEND_API_TOKEN` va `HEMIS_REST_BASE_URL` ni tekshiring.
            </div>
          ) : null}
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleTestConnection()}
              disabled={isTesting || !data?.config_ok}
              className={cn(
                'inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white',
                isTesting || !data?.config_ok ? 'cursor-not-allowed bg-slate-300' : 'bg-primary'
              )}
            >
              <Zap size={16} />
              {isTesting ? 'Tekshirilmoqda...' : 'Ulanishni tekshirish'}
            </button>
            {testResult ? (
              <span
                className={cn(
                  'rounded-2xl px-3 py-2 text-xs font-extrabold',
                  testResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-danger/10 text-danger'
                )}
              >
                {testResult.success ? 'Ulanish OK' : 'Ulanishda xatolik'}
              </span>
            ) : null}
          </div>
          {testResult ? (
            <div className="mt-4 space-y-2 text-sm text-text-secondary">
              {Object.entries(testResult.results as Record<string, { ok: boolean; message: string }>).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between rounded-2xl border border-border px-4 py-2">
                  <span className="font-semibold">{key}</span>
                  <span className={cn('font-bold', value.ok ? 'text-emerald-600' : 'text-danger')}>{value.message}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="card p-6 lg:p-8">
          <div className="flex items-center gap-3">
            <Database size={18} className="text-primary" />
            <h3 className="text-lg font-black text-text-primary">DB statistikalar</h3>
          </div>
          <div className="mt-6 space-y-4">
            {stats.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
                <span className="text-sm font-semibold text-text-secondary">{item.label}</span>
                <span className="text-lg font-black text-text-primary">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card p-6 lg:p-8">
        <div className="flex items-center gap-3">
          <Activity size={18} className="text-primary" />
          <h3 className="text-lg font-black text-text-primary">Sinxronlashni ishga tushirish</h3>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {Object.entries(scopeLabels).map(([scope, label]) => (
            <button
              key={scope}
              type="button"
              onClick={() => void handleRun(scope)}
              disabled={!data?.config_ok || isRunning}
              className={cn(
                'rounded-2xl px-4 py-3 text-sm font-bold',
                !data?.config_ok || isRunning ? 'cursor-not-allowed bg-slate-300 text-white' : 'bg-primary text-white'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="card p-6 lg:p-8">
        <h3 className="text-lg font-black text-text-primary">Oxirgi sinxronlashlar</h3>
        {isLoading ? (
          <div className="mt-6 text-sm font-bold text-text-secondary">Yuklanmoqda...</div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs font-extrabold uppercase tracking-wider text-text-muted">
                  <th className="px-4 py-3 text-left">Scope</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Boshlanish</th>
                  <th className="px-4 py-3 text-left">Tugash</th>
                  <th className="px-4 py-3 text-left">Processed</th>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.last_syncs.length ? (
                  data.last_syncs.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-semibold text-text-primary">{scopeLabels[item.scope] || item.scope}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded-xl px-2 py-1 text-xs font-bold',
                            item.status === 'success'
                              ? 'bg-emerald-50 text-emerald-700'
                              : item.status === 'running'
                                ? 'bg-warning/10 text-warning'
                                : 'bg-danger/10 text-danger'
                          )}
                        >
                          {item.status_label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{formatDateTime(item.started_at)}</td>
                      <td className="px-4 py-3 text-text-secondary">{formatDateTime(item.finished_at)}</td>
                      <td className="px-4 py-3 text-text-secondary">{item.processed_count}</td>
                      <td className="px-4 py-3 text-text-secondary">{item.initiated_by}</td>
                      <td className="px-4 py-3 text-text-secondary">{item.message || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-text-muted">
                      Hali sinxronlash loglari yo`q.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

