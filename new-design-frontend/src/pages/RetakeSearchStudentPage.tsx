import { useState, type FormEvent } from 'react';
import { ArrowRight, Search, UserX } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchRetakeSearchStudents } from '@/src/api/retake';
import type { RetakeSearchStudentsResponse } from '@/src/types';

export default function RetakeSearchStudentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetCycleId = searchParams.get('cycle_id');
  const [query, setQuery] = useState('');
  const [searchHemis, setSearchHemis] = useState(false);
  const [data, setData] = useState<RetakeSearchStudentsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(event?: FormEvent<HTMLFormElement>) {
    if (event) event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setData(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('q', trimmed);
      if (searchHemis) params.set('hemis', '1');
      const response = await fetchRetakeSearchStudents(params.toString());
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Qidiruv bajarilmadi.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="card p-8 lg:p-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary">
              <Search size={12} />
              Retake search
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-text-primary">Talaba qidirish</h2>
            <p className="mt-3 max-w-3xl text-sm font-medium text-text-secondary">
              Qayta topshirish uchun talabani ism yoki ID raqam bo'yicha qidiring.
            </p>
          </div>
        </div>
      </section>

      <section className="card p-6 lg:p-8">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
                <Search size={18} />
              </div>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ism sharif yoki ID raqam kiriting..."
                className="input w-full pl-12"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-xl shadow-primary/20"
            >
              {isLoading ? 'Qidirilmoqda...' : 'Qidirish'}
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <input
              type="checkbox"
              checked={searchHemis}
              onChange={(event) => setSearchHemis(event.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            HEMIS bazasidan qidirish (mahalliy bazada topilmasa)
          </label>
        </form>

        {error ? <p className="mt-4 rounded-2xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger">{error}</p> : null}
        {data?.warning ? <p className="mt-4 rounded-2xl bg-warning/10 px-4 py-3 text-sm font-bold text-warning">{data.warning}</p> : null}

        {data && query.trim() ? (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs font-extrabold uppercase tracking-wider text-text-muted">
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">F.I.SH.</th>
                  <th className="px-4 py-3 text-left">ID / PINFL</th>
                  <th className="px-4 py-3 text-left">Guruh / Fakultet</th>
                  <th className="px-4 py-3 text-right">Profil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.students.length ? (
                  data.students.map((student, index) => (
                    <tr
                      key={student.id}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        navigate(
                          `/retake/students/${student.id}/debts?sync=1${presetCycleId ? `&cycle_id=${encodeURIComponent(presetCycleId)}` : ''}`,
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(
                            `/retake/students/${student.id}/debts?sync=1${presetCycleId ? `&cycle_id=${encodeURIComponent(presetCycleId)}` : ''}`,
                          );
                        }
                      }}
                      className="cursor-pointer transition-colors hover:bg-primary/5"
                    >
                      <td className="px-4 py-3 text-text-muted">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-text-primary">{student.full_name}</div>
                        <div className="text-xs text-text-muted">{student.specialty_name || '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-text-primary">
                          {student.student_id_number || '-'}
                        </div>
                        <div className="mt-1 text-[10px] text-text-muted">{student.pinfl || '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-primary">{student.group_name || '-'}</div>
                        <div className="text-xs text-text-muted">{student.faculty_name || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white">
                          Batafsil
                          <ArrowRight size={14} />
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-text-muted">
                      <UserX className="mx-auto mb-3 h-10 w-10 opacity-20" />
                      <p className="font-bold">Talaba topilmadi</p>
                      <p className="text-xs">Qidiruv so'zini tekshiring yoki HEMIS dan qidirib ko'ring.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
