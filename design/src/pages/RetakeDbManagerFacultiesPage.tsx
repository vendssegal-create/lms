import { useCallback, useEffect, useState } from 'react';
import { Building2, Check, Loader2, Shield } from 'lucide-react';
import { useAuth } from '@/src/features/auth/auth-context';
import {
  fetchRetakeDbManagersFaculties,
  fetchRetakeFacultyNames,
  saveRetakeDbManagerFaculties,
  type RetakeDbManagerRow,
} from '@/src/api/retake';
import { cn } from '@/src/lib/utils';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'REGISTRATOR']);

export default function RetakeDbManagerFacultiesPage() {
  const { session } = useAuth();
  const role = session?.user?.active_role || '';
  const allowed = ADMIN_ROLES.has(role);

  const [faculties, setFaculties] = useState<string[]>([]);
  const [managers, setManagers] = useState<RetakeDbManagerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const [editing, setEditing] = useState<RetakeDbManagerRow | null>(null);
  const [accessAll, setAccessAll] = useState(false);
  const [selectedFaculties, setSelectedFaculties] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [namesRes, mgrRes] = await Promise.all([
        fetchRetakeFacultyNames(),
        fetchRetakeDbManagersFaculties(),
      ]);
      setFaculties(namesRes.faculties);
      setManagers(mgrRes.managers);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Maʼlumot yuklanmadi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  function openEdit(m: RetakeDbManagerRow) {
    setEditing(m);
    setAccessAll(m.access_all_faculties);
    setSelectedFaculties(new Set(m.faculty_names));
  }

  function closeEdit() {
    setEditing(null);
  }

  function toggleFaculty(name: string) {
    setAccessAll(false);
    setSelectedFaculties((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function handleSave() {
    if (!editing) return;
    setSavingId(editing.id);
    setError(null);
    try {
      await saveRetakeDbManagerFaculties({
        user_id: editing.id,
        access_all_faculties: accessAll,
        faculty_names: accessAll ? [] : Array.from(selectedFaculties),
      });
      await load();
      closeEdit();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Saqlanmadi.');
    } finally {
      setSavingId(null);
    }
  }

  if (!session?.authenticated) {
    return null;
  }

  if (!allowed) {
    return (
      <div className="rounded-3xl border border-border bg-white p-8 shadow-premium">
        <p className="label-micro">Kirish</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight">Ruxsat yo&apos;q</h2>
        <p className="mt-2 text-sm font-medium text-text-secondary">
          Sahifa faqat super admin yoki registrator uchun.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-white p-8 shadow-premium">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="label-micro">Qayta topshirish</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">MB menejerlari — fakultetlar</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium text-text-secondary">
              Har bir MB menejerga qaysi fakultetlar bo‘yicha guruhlar va imtihon varaqlari ko‘rinishi belgilanadi.
              <strong className="font-bold text-text-primary"> Barchasi</strong> tanlansa, barcha fakultetlar
              uchun kirish beriladi (oldingi Django admin dagi qo‘lda kiritish o‘rniga).
            </p>
          </div>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-slate-950 text-white shadow-xl">
            <Building2 size={22} />
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-premium">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm font-bold text-text-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
            Yuklanmoqda...
          </div>
        ) : managers.length === 0 ? (
          <div className="p-10 text-center text-sm font-medium text-text-secondary">
            Hozircha <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">RET_DB_MANAGER</code> roli
            bo‘lgan foydalanuvchi yo‘q. Avval Django admin orqali yoki foydalanuvchi yaratish sahifasidan
            menejer yarating.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50 text-xs font-black uppercase tracking-wider text-text-muted">
                  <th className="px-6 py-4">Foydalanuvchi</th>
                  <th className="px-6 py-4">Fakultetlar</th>
                  <th className="px-6 py-4 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {managers.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-4">
                      <div className="font-bold text-text-primary">{m.username}</div>
                      <div className="text-xs text-text-muted">{m.full_name || '—'}</div>
                    </td>
                    <td className="px-6 py-4">
                      {m.access_all_faculties ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">
                          <Shield size={12} />
                          Barchasi
                        </span>
                      ) : m.faculty_names.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {m.faculty_names.map((f) => (
                            <span
                              key={f}
                              className="rounded-full border border-border bg-white px-2.5 py-0.5 text-xs font-semibold text-text-secondary"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-amber-700">Tayinlanmagan</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(m)}
                        className="rounded-2xl border border-border bg-white px-4 py-2 text-xs font-black text-text-primary shadow-sm transition hover:border-primary/30"
                      >
                        Tahrirlash
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {faculties.length === 0 && !loading && allowed ? (
        <p className="text-center text-xs font-medium text-text-muted">
          Ro‘yxatda fakultet nomlari yo‘q — HEMIS dan talaba sinxroni qilinganidan keyin shu yerda chiqadi.
          Yoki Django admin orqali qo‘lda biriktirish mumkin.
        </p>
      ) : null}

      {editing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal
          aria-labelledby="dbm-fac-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-white p-6 shadow-2xl">
            <h2 id="dbm-fac-title" className="text-xl font-black tracking-tight">
              {editing.username}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">{editing.full_name || editing.email || ''}</p>

            <label className="mt-6 flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={accessAll}
                onChange={(e) => {
                  setAccessAll(e.target.checked);
                  if (e.target.checked) setSelectedFaculties(new Set());
                }}
              />
              <span className="text-sm font-bold">Barchasi (barcha fakultetlar)</span>
            </label>

            <p className="mt-4 text-xs font-medium text-text-muted">
              Alohida fakultet tanlash uchun yuqoridagi «Barchasi»ni o‘chiring.
            </p>

            <div
              className={cn(
                'mt-4 space-y-2 rounded-2xl border border-border p-4',
                accessAll && 'pointer-events-none opacity-40',
              )}
            >
              {faculties.map((f) => (
                <label key={f} className="flex cursor-pointer items-center gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border"
                    checked={selectedFaculties.has(f)}
                    onChange={() => toggleFaculty(f)}
                  />
                  <span>{f}</span>
                </label>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-2xl border border-border px-4 py-2 text-sm font-bold text-text-secondary"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={savingId !== null || (!accessAll && selectedFaculties.size === 0)}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-2 text-sm font-black text-white disabled:opacity-50"
              >
                {savingId !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check size={16} />}
                Saqlash
              </button>
            </div>
            {!accessAll && selectedFaculties.size === 0 ? (
              <p className="mt-2 text-xs text-amber-700">Kamida bitta fakultet tanlang yoki «Barchasi»ni yoqing.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
