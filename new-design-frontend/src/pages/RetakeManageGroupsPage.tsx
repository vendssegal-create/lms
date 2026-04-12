import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Save, Trash2, Users, ChevronRight } from 'lucide-react';
import { createRetakeGroup, deleteRetakeGroup, fetchRetakeGroups, updateRetakeGroup } from '@/src/api/retake';
import type { RetakeGroupManageItem, RetakeGroupsResponse } from '@/src/types';

export default function RetakeManageGroupsPage() {
  const [data, setData] = useState<RetakeGroupsResponse | null>(null);
  const [selected, setSelected] = useState<RetakeGroupManageItem | null>(null);
  const [createForm, setCreateForm] = useState({ subject_id: 0, code: '', teacher_id: 0, capacity: 25 });
  const [editForm, setEditForm] = useState({ teacher_id: 0, capacity: 25, status: 'active' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchRetakeGroups();
      setData(response);
      if (!selected && response.groups[0]) {
        handleSelect(response.groups[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Groups yuklanmadi.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSelect(group: RetakeGroupManageItem) {
    setSelected(group);
    setEditForm({
      teacher_id: group.teacher.id || 0,
      capacity: group.capacity,
      status: group.status,
    });
  }

  async function handleCreate() {
    setError(null);
    setSuccess(null);
    try {
      const response = await createRetakeGroup({
        subject_id: Number(createForm.subject_id),
        code: createForm.code,
        teacher_id: createForm.teacher_id || null,
        capacity: Number(createForm.capacity),
      });
      await load();
      if (response.group) {
        handleSelect(response.group);
      }
      setSuccess('Guruh yaratildi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Guruh yaratilmadi.');
    }
  }

  async function handleUpdate() {
    if (!selected) return;
    setError(null);
    setSuccess(null);
    try {
      const response = await updateRetakeGroup(selected.id, {
        teacher_id: editForm.teacher_id || null,
        capacity: Number(editForm.capacity),
        status: editForm.status,
      });
      if (response.group) {
        setData((current) =>
          current ? { ...current, groups: current.groups.map((item) => (item.id === response.group?.id ? response.group : item)) } : current,
        );
        handleSelect(response.group);
      }
      setSuccess('Guruh yangilandi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Guruh yangilanmadi.');
    }
  }

  async function handleDelete() {
    if (!selected) return;
    setError(null);
    setSuccess(null);
    try {
      await deleteRetakeGroup(selected.id);
      setSelected(null);
      await load();
      setSuccess('Guruh o‘chirildi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Guruh o‘chirilmadi.');
    }
  }

  return (
    <div className="space-y-8">
      <section className="card p-8 lg:p-10">
        <div className="flex items-center gap-3">
          <Users size={20} className="text-primary" />
          <h2 className="text-3xl font-black tracking-tight text-text-primary">Retake group management</h2>
        </div>
        <p className="mt-3 max-w-3xl text-sm font-medium text-text-secondary">
          DB manager uchun retake guruhlarini yaratish, o‘qituvchi biriktirish va status boshqaruvi.
        </p>
        {error ? <p className="mt-4 rounded-2xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger">{error}</p> : null}
        {success ? <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{success}</p> : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <div className="card overflow-hidden">
          <div className="border-b border-border/60 px-6 py-5">
            <h3 className="text-xl font-black tracking-tight text-text-primary">Mavjud guruhlar</h3>
          </div>
          {isLoading ? (
            <div className="px-6 py-16 text-sm font-bold text-text-secondary">Yuklanmoqda...</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data?.groups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => handleSelect(group)}
                  className={`grid w-full gap-4 px-6 py-5 text-left transition-all hover:bg-slate-50 cursor-pointer lg:grid-cols-[minmax(0,1.3fr)_1fr_1fr_auto_auto] ${selected?.id === group.id ? 'bg-primary/5' : ''}`}
                >
                  <div>
                    <p className="text-base font-black tracking-tight text-text-primary">{group.subject.name}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wider text-text-muted">{group.code}</p>
                  </div>
                  <div className="text-sm font-bold text-text-secondary">
                    <p>{group.members_count} talaba</p>
                    <p className="mt-1">{group.assessments_count} assessment</p>
                  </div>
                  <div className="text-sm font-bold text-text-secondary">
                    <p>{group.teacher.full_name || 'Teacher yo‘q'}</p>
                    <p className="mt-1">Cap: {group.capacity}</p>
                  </div>
                  <div className="text-right">
                    <span className="status-pill status-pill-primary">{group.status_label}</span>
                  </div>
                  <Link
                    to={`/retake/groups/${group.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold text-text-muted hover:text-primary hover:border-primary/30 transition-colors self-center"
                  >
                    Batafsil <ChevronRight size={14} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-2">
              <Plus size={16} className="text-primary" />
              <h3 className="text-lg font-black text-text-primary">Yangi guruh</h3>
            </div>
            <div className="mt-4 space-y-4">
              <select value={createForm.subject_id} onChange={(e) => setCreateForm((c) => ({ ...c, subject_id: Number(e.target.value) }))} className="input">
                <option value={0}>Fan tanlang</option>
                {data?.pending_subjects.map((subject) => (
                  <option key={subject.subject_id} value={subject.subject_id}>{subject.subject_name} ({subject.items_count})</option>
                ))}
              </select>
              <input value={createForm.code} onChange={(e) => setCreateForm((c) => ({ ...c, code: e.target.value }))} className="input" placeholder="Group code" />
              <select value={createForm.teacher_id} onChange={(e) => setCreateForm((c) => ({ ...c, teacher_id: Number(e.target.value) }))} className="input">
                <option value={0}>Teacher tanlanmagan</option>
                {data?.teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>
                ))}
              </select>
              <input type="number" value={createForm.capacity} onChange={(e) => setCreateForm((c) => ({ ...c, capacity: Number(e.target.value) }))} className="input" placeholder="Capacity" />
              <button type="button" onClick={() => void handleCreate()} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white">
                <Plus size={16} />
                Guruh yaratish
              </button>
            </div>
          </div>

          {selected ? (
            <div className="card p-6">
              <h3 className="text-lg font-black text-text-primary">Tanlangan guruh</h3>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-text-primary">
                  {selected.subject.name} • {selected.code}
                </div>
                <select value={editForm.teacher_id} onChange={(e) => setEditForm((c) => ({ ...c, teacher_id: Number(e.target.value) }))} className="input">
                  <option value={0}>Teacher tanlanmagan</option>
                  {data?.teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>
                  ))}
                </select>
                <input type="number" value={editForm.capacity} onChange={(e) => setEditForm((c) => ({ ...c, capacity: Number(e.target.value) }))} className="input" />
                <select value={editForm.status} onChange={(e) => setEditForm((c) => ({ ...c, status: e.target.value }))} className="input">
                  {data?.subject_statuses.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => void handleUpdate()} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white">
                    <Save size={16} />
                    Saqlash
                  </button>
                  <button type="button" onClick={() => void handleDelete()} className="inline-flex items-center gap-2 rounded-2xl bg-danger px-4 py-3 text-sm font-bold text-white">
                    <Trash2 size={16} />
                    O‘chirish
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
