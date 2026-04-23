import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Users, ClipboardList, BookOpen, ArrowLeft, Plus, Zap, Loader, X, CheckCircle2, Clock } from 'lucide-react';
import {
  fetchSubjectGroupDetail,
  fetchGroupStudentGroups,
  fetchGroupPendingStudents,
  autoAssignGroupStudents,
  removeGroupMember,
  createRetakeAssessmentForGroup,
} from '@/src/api/retake';

/* ── Types ─────────────────────────────────────────── */
interface Member {
  membership_id: number;
  student_name: string;
  student_id: string;
  required_control_type: string;
  faculty_name: string;
}

interface StudentGroupData {
  group_name: string;
  faculty_name: string;
  count: number;
  members: Member[];
  control_types_needed: string[];
}

interface PendingStudent {
  item_id: number;
  student_name: string;
  student_id: string;
  hemis_group: string;
  faculty: string;
  required_control_type: string;
}

interface Assessment {
  id: number;
  student_group_name: string;
  control_type: string;
  control_type_label: string;
  scheduled_at: string | null;
  room: string;
  status: string;
  status_label: string;
  teacher: { id: number; full_name: string } | null;
  exam_sheet: {
    id: number;
    sheet_no: string;
    status: string;
    status_label: string;
    entries_count: number;
    graded_count: number;
  } | null;
}

interface GroupDetail {
  group: {
    id: number;
    code: string;
    subject_name: string;
    subject_code: string;
    semester_name: string;
    teacher: { id: number; full_name: string } | null;
    status: string;
    status_label: string;
    capacity: number;
    total_members: number;
    lms_course_title: string;
  };
  student_groups: StudentGroupData[];
  assessments: Assessment[];
  teachers: { id: number; full_name: string }[];
}

type Tab = 'members' | 'assessments' | 'sheets';

const CONTROL_TYPES = [
  { value: '1-jn', label: '1-JN' },
  { value: '2-jn', label: '2-JN' },
  { value: '1-on', label: '1-ON' },
  { value: '2-on', label: '2-ON' },
  { value: 'final', label: 'Yakuniy' },
];

/* ── Main Page ─────────────────────────────────────── */
export default function RetakeGroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [tab, setTab] = useState<Tab>('members');
  const [data, setData] = useState<GroupDetail | null>(null);
  const [studentGroupsForAssessment, setStudentGroupsForAssessment] = useState<unknown[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const tabs = [
    { id: 'members' as Tab, label: "A'zolar", icon: Users },
    { id: 'assessments' as Tab, label: 'Nazorat jadvali', icon: ClipboardList },
    { id: 'sheets' as Tab, label: 'Qaydnomalar', icon: BookOpen },
  ];

  const loadData = useCallback(async () => {
    if (!groupId) return;
    setIsLoading(true);
    try {
      const [detail, sg] = await Promise.all([
        fetchSubjectGroupDetail(Number(groupId)),
        fetchGroupStudentGroups(Number(groupId)),
      ]);
      setData(detail as GroupDetail);
      setStudentGroupsForAssessment((sg as { student_groups?: unknown[] }).student_groups || []);
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 gap-3 text-text-muted">
        <Loader className="animate-spin" size={20} />
        Yuklanmoqda...
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-32 text-text-muted">Ma'lumot topilmadi</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6">
        <Link
          to="/retake/groups"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-primary mb-4"
        >
          <ArrowLeft size={16} /> Fan Guruhlariga qaytish
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-text-primary">{data.group.subject_name}</h1>
            <p className="text-sm text-text-muted mt-1">
              {data.group.code} &bull; {data.group.semester_name} &bull; {data.group.total_members} ta talaba
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-text-secondary">
              O'qituvchi: {data.group.teacher?.full_name || <span className="text-warning">Tayinlanmagan</span>}
            </p>
            <span
              className={`mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-bold ${
                data.group.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {data.group.status_label}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border px-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <t.icon size={15} />
            {t.label}
            {t.id === 'members' && data.group.total_members > 0 && (
              <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-black text-primary">
                {data.group.total_members}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'members' && (
        <MembersTab groupId={Number(groupId)} studentGroups={data.student_groups} onRefresh={loadData} />
      )}
      {tab === 'assessments' && (
        <AssessmentsTab
          groupId={Number(groupId)}
          assessments={data.assessments}
          studentGroups={studentGroupsForAssessment}
          teachers={data.teachers}
          defaultTeacher={data.group.teacher}
          onRefresh={loadData}
        />
      )}
      {tab === 'sheets' && <ExamSheetsTab assessments={data.assessments} />}
    </div>
  );
}

/* ── MembersTab ────────────────────────────────────── */
function MembersTab({
  groupId,
  studentGroups,
  onRefresh,
}: {
  groupId: number;
  studentGroups: StudentGroupData[];
  onRefresh: () => void;
}) {
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingByGroup, setPendingByGroup] = useState<{ hemis_group: string; students: PendingStudent[] }[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isRemoving, setIsRemoving] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchGroupPendingStudents(groupId)
      .then((d) => {
        setPendingCount(d.pending_count);
        setPendingByGroup(d.by_hemis_group || []);
      })
      .catch(() => {});
  }, [groupId]);

  async function handleAutoAssign() {
    setIsAssigning(true);
    setError('');
    setSuccess('');
    try {
      const res = await autoAssignGroupStudents(groupId);
      if (res.success) {
        setSuccess(res.message);
        setPendingCount(0);
        setPendingByGroup([]);
        onRefresh();
      }
    } catch {
      setError('Server xatoligi yuz berdi');
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleRemove(membershipId: number) {
    setIsRemoving(membershipId);
    setError('');
    try {
      await removeGroupMember(groupId, membershipId);
      onRefresh();
    } catch {
      setError("O'chirishda xatolik");
    } finally {
      setIsRemoving(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Pending students panel */}
      {pendingCount > 0 && (
        <div className="card border-2 border-amber-200 bg-amber-50/50 p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-black text-amber-900 text-base">{pendingCount} ta talaba guruhga biriktirilmagan</h3>
              <p className="text-xs text-amber-700 mt-0.5">
                Quyidagi talabalar HEMIS guruhlari bo'yicha ko'rsatilgan. "Barcha talabalarni biriktir" tugmasini
                bosing.
              </p>
            </div>
            <button
              onClick={handleAutoAssign}
              disabled={isAssigning}
              className="shrink-0 btn btn-primary gap-2 text-sm"
            >
              {isAssigning ? (
                <>
                  <Loader size={14} className="animate-spin" /> Biriktirilmoqda...
                </>
              ) : (
                <>
                  <Zap size={14} /> {pendingCount} tasini biriktir
                </>
              )}
            </button>
          </div>

          {/* HEMIS guruhlar preview */}
          <div className="grid gap-2">
            {pendingByGroup.map((pg) => (
              <div key={pg.hemis_group} className="rounded-xl bg-white border border-amber-200 px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-black text-sm text-amber-900">{pg.hemis_group}</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                    {pg.students.length} talaba
                  </span>
                </div>
                <p className="text-xs text-amber-700">{pg.students.map((s) => s.student_name).join(' • ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-bold text-emerald-700">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-danger/5 border border-danger/20 px-4 py-3 text-sm text-danger font-bold">
          {error}
        </div>
      )}

      {/* Guruh a'zolari — HEMIS guruhlar bo'yicha (imtihon guruhlari) */}
      {studentGroups.length === 0 ? (
        pendingCount === 0 && <div className="card p-12 text-center text-text-muted text-sm">Hali hech bir talaba biriktirilmagan</div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-black text-text-primary text-sm uppercase tracking-wider">Imtihon guruhlari</h3>
            <span className="text-xs text-text-muted">{studentGroups.length} ta HEMIS guruh</span>
          </div>

          {studentGroups.map((sg) => (
            <details key={sg.group_name} className="card overflow-hidden" open={studentGroups.length === 1}>
              <summary className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 select-none">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center">
                    <Users size={14} className="text-violet-600" />
                  </div>
                  <div>
                    <span className="font-black text-text-primary">{sg.group_name}</span>
                    <p className="text-xs text-text-muted">{sg.faculty_name}</p>
                  </div>
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-bold text-violet-700">
                    Imtihon guruhi
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-text-secondary">{sg.count} talaba</span>
                  <div className="flex gap-1">
                    {sg.control_types_needed.map((ct) => (
                      <span key={ct} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                        {ct}
                      </span>
                    ))}
                  </div>
                </div>
              </summary>

              <div className="border-t border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-text-muted">
                    <tr>
                      <th className="px-4 py-3 text-left">F.I.O</th>
                      <th className="px-4 py-3 text-left">Talaba ID</th>
                      <th className="px-4 py-3 text-left">Nazorat turi</th>
                      <th className="px-4 py-3 text-left">Fakultet</th>
                      <th className="px-4 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sg.members.map((m) => (
                      <tr key={m.membership_id} className="hover:bg-slate-50/50 group">
                        <td className="px-4 py-3 font-bold text-text-primary">{m.student_name}</td>
                        <td className="px-4 py-3 text-text-muted font-mono text-xs">{m.student_id}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                            {m.required_control_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-text-muted text-xs">{m.faculty_name}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRemove(m.membership_id)}
                            disabled={isRemoving === m.membership_id}
                            className="opacity-0 group-hover:opacity-100 text-danger hover:bg-danger/10 rounded-lg p-1.5 transition-all"
                            title="Guruhdan chiqarish"
                          >
                            {isRemoving === m.membership_id ? (
                              <Loader size={14} className="animate-spin" />
                            ) : (
                              <X size={14} />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── AssessmentsTab ─────────────────────────────────── */
function AssessmentsTab({
  groupId,
  assessments,
  studentGroups,
  teachers,
  defaultTeacher,
  onRefresh,
}: {
  groupId: number;
  assessments: Assessment[];
  studentGroups: unknown[];
  teachers: { id: number; full_name: string }[];
  defaultTeacher: { id: number; full_name: string } | null;
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [overrideTeacher, setOverrideTeacher] = useState(false);
  const [form, setForm] = useState({
    student_group_name: '',
    control_type: 'final',
    scheduled_at: '',
    room: '',
    pair_number: 1,
    teacher_id: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!showForm) return;
    if (!defaultTeacher?.id) return;
    if (overrideTeacher) return;
    setForm((f) => ({ ...f, teacher_id: String(defaultTeacher.id) }));
  }, [defaultTeacher?.id, overrideTeacher, showForm]);

  // Matritsa uchun map: hemis_group → control_type → assessment
  const assessmentMap: Record<string, Record<string, Assessment>> = {};
  for (const a of assessments) {
    const key = a.student_group_name || '__all__';
    if (!assessmentMap[key]) assessmentMap[key] = {};
    assessmentMap[key][a.control_type] = a;
  }

  async function handleCreate() {
    if (!form.student_group_name || !form.scheduled_at) {
      setError('Guruh va sana kiritilishi shart');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const res = await createRetakeAssessmentForGroup(groupId, {
        student_group_name: form.student_group_name,
        control_type: form.control_type,
        scheduled_at: form.scheduled_at,
        room: form.room,
        pair_number: form.pair_number,
        // teacher_id yuborilmasa backend avtomatik group.teacher_profile ni oladi
        teacher_id:
          overrideTeacher && form.teacher_id ? Number(form.teacher_id) : undefined,
      });
      if (res.success) {
        setShowForm(false);
        setOverrideTeacher(false);
        setForm((f) => ({ ...f, student_group_name: '', scheduled_at: '' }));
        onRefresh();
      } else {
        setError(res.error || 'Xatolik');
      }
    } catch {
      setError('Server xatoligi');
    } finally {
      setIsSaving(false);
    }
  }

  const allCoveredForGroup = (gName: string) => {
    const a = assessmentMap[gName] || {};
    return CONTROL_TYPES.every((ct) => a[ct.value]);
  };

  const typedStudentGroups = studentGroups as { group_name: string; faculty_name: string; student_count: number }[];

  return (
    <div className="space-y-5">
      {/* Matritsa: Imtihon guruhlari × Nazorat turlari */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-black text-text-primary">Nazorat holati</h3>
            <p className="text-xs text-text-muted mt-0.5">Har bir imtihon guruhi uchun nazorat turlari</p>
          </div>
          <button onClick={() => setShowForm((v) => !v)} className="btn btn-primary gap-2 text-sm">
            <Plus size={14} />
            Nazorat qo'shish
          </button>
        </div>

        {typedStudentGroups.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm">
            Hali talabalar biriktirilmagan. Avval A'zolar bo'limiga o'ting.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="px-5 py-3 text-left">Imtihon guruhi</th>
                  {CONTROL_TYPES.map((ct) => (
                    <th key={ct.value} className="px-3 py-3 text-center min-w-[100px]">
                      {ct.label}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {typedStudentGroups.map((sg) => (
                  <tr key={sg.group_name} className="hover:bg-slate-50/40">
                    <td className="px-5 py-3.5">
                      <p className="font-black text-text-primary">{sg.group_name}</p>
                      <p className="text-xs text-text-muted">
                        {sg.student_count} talaba &bull; {sg.faculty_name}
                      </p>
                    </td>
                    {CONTROL_TYPES.map((ct) => {
                      const assessment = assessmentMap[sg.group_name]?.[ct.value];
                      return (
                        <td key={ct.value} className="px-3 py-3.5 text-center">
                          {assessment ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                  assessment.status === 'open'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : assessment.status === 'closed'
                                      ? 'bg-slate-100 text-slate-500'
                                      : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {assessment.status_label}
                              </span>
                              {assessment.exam_sheet && (
                                <span className="text-[10px] text-text-muted">
                                  {assessment.exam_sheet.graded_count}/{assessment.exam_sheet.entries_count}
                                </span>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setForm((f) => ({
                                  ...f,
                                  student_group_name: sg.group_name,
                                  control_type: ct.value,
                                }));
                                setShowForm(true);
                              }}
                              className="text-text-muted hover:text-primary text-xs font-bold hover:bg-primary/5 rounded-lg px-2 py-1 transition-colors"
                            >
                              + Ochish
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-3.5 text-center">
                      {allCoveredForGroup(sg.group_name) ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                          <CheckCircle2 size={12} /> To'liq
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                          <Clock size={12} /> Qisman
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Nazorat qo'shish formasi */}
      {showForm && (
        <div className="card p-6 border-2 border-primary/20">
          <h4 className="font-black text-text-primary mb-4">Nazorat qo'shish</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label-micro mb-1.5">Imtihon guruhi *</label>
              <select
                value={form.student_group_name}
                onChange={(e) => setForm((f) => ({ ...f, student_group_name: e.target.value }))}
                className="input w-full"
              >
                <option value="">— Guruh tanlang —</option>
                {typedStudentGroups.map((sg) => (
                  <option key={sg.group_name} value={sg.group_name}>
                    {sg.group_name} ({sg.student_count} talaba)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-micro mb-1.5">Nazorat turi *</label>
              <select
                value={form.control_type}
                onChange={(e) => setForm((f) => ({ ...f, control_type: e.target.value }))}
                className="input w-full"
              >
                {CONTROL_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>
                    {ct.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-micro mb-1.5">Sana va vaqt *</label>
              <input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))}
                className="input w-full"
              />
            </div>

            <div>
              <label className="label-micro mb-1.5">Xona</label>
              <input
                type="text"
                placeholder="masalan: 301-xona"
                value={form.room}
                onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
                className="input w-full"
              />
            </div>

            <div>
              <label className="label-micro mb-1.5">O'qituvchi</label>
              {defaultTeacher ? (
                <div className="rounded-2xl border border-border px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-text-primary truncate">{defaultTeacher.full_name}</p>
                      <p className="text-xs text-text-muted">Fan guruhi o'qituvchisi (default)</p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline text-xs h-8 px-3"
                      onClick={() => setOverrideTeacher((v) => !v)}
                    >
                      {overrideTeacher ? 'Defaultga qaytish' : "Almashtirish"}
                    </button>
                  </div>

                  {overrideTeacher ? (
                    <div className="mt-3">
                      <select
                        value={form.teacher_id}
                        onChange={(e) => setForm((f) => ({ ...f, teacher_id: e.target.value }))}
                        className="input w-full"
                      >
                        <option value="">— Tanlang —</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.full_name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] font-semibold text-text-muted">
                        Agar tanlamasangiz, backend default o‘qituvchini qo‘yadi.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <select
                  value={form.teacher_id}
                  onChange={(e) => setForm((f) => ({ ...f, teacher_id: e.target.value }))}
                  className="input w-full"
                >
                  <option value="">— Tanlang —</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="label-micro mb-1.5">Para raqami</label>
              <input
                type="number"
                min={1}
                max={6}
                value={form.pair_number}
                onChange={(e) => setForm((f) => ({ ...f, pair_number: Number(e.target.value) }))}
                className="input w-full"
              />
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-danger font-bold">{error}</p>}

          <div className="flex gap-3 mt-5">
            <button onClick={handleCreate} disabled={isSaving} className="btn btn-primary gap-2">
              {isSaving ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />}
              Saqlash
            </button>
            <button onClick={() => { setShowForm(false); setError(''); }} className="btn btn-outline">
              Bekor qilish
            </button>
          </div>
        </div>
      )}

      {/* Nazoratlar ro'yxati */}
      {assessments.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-black text-text-primary">Barcha nazoratlar</h3>
          </div>
          <div className="divide-y divide-border">
            {assessments.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50">
                <div>
                  <p className="font-bold text-text-primary text-sm">
                    {a.student_group_name || 'Umumiy'} — {a.control_type_label}
                  </p>
                  <p className="text-xs text-text-muted">
                    {a.scheduled_at ? new Date(a.scheduled_at).toLocaleString('uz-UZ') : '—'}
                    {a.room && ` • ${a.room}`}
                    {a.teacher && ` • ${a.teacher.full_name}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {a.exam_sheet && (
                    <span className="text-xs text-text-muted">
                      {a.exam_sheet.graded_count}/{a.exam_sheet.entries_count} baholangan
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      a.status === 'open'
                        ? 'bg-emerald-50 text-emerald-700'
                        : a.status === 'closed'
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {a.status_label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── ExamSheetsTab ──────────────────────────────────── */
function ExamSheetsTab({ assessments }: { assessments: Assessment[] }) {
  const sheets = assessments.filter((a) => a.exam_sheet);

  if (!sheets.length) {
    return <div className="card p-12 text-center text-text-muted text-sm">Hali qaydnoma mavjud emas</div>;
  }

  return (
    <div className="space-y-3">
      {sheets.map((a) => {
        const sheet = a.exam_sheet!;
        return (
          <div key={sheet.id} className="card px-6 py-4 flex items-center justify-between">
            <div>
              <p className="font-black text-text-primary">
                {a.student_group_name || 'Umumiy'} — {a.control_type_label}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                Qaydnoma № {sheet.sheet_no} &bull; {sheet.graded_count}/{sheet.entries_count} baholangan
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  sheet.status === 'open'
                    ? 'bg-emerald-50 text-emerald-700'
                    : sheet.status === 'submitted'
                      ? 'bg-blue-50 text-blue-700'
                      : sheet.status === 'locked'
                        ? 'bg-slate-100 text-slate-500'
                        : 'bg-amber-50 text-amber-700'
                }`}
              >
                {sheet.status_label}
              </span>
              <Link to={`/retake/exam-sheets/${sheet.id}`} className="btn btn-outline text-xs h-8 px-3">
                Ko'rish
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

