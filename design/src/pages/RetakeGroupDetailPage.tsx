import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Users, ClipboardList, BookOpen, ArrowLeft, Plus, Zap, Loader, X } from 'lucide-react';
import {
  fetchSubjectGroupDetail,
  fetchGroupStudentGroups,
  createRetakeAssessmentForGroup,
} from '@/src/api/retake';

type Tab = 'members' | 'assessments' | 'sheets';

export default function RetakeGroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [tab, setTab] = useState<Tab>('members');
  const [data, setData] = useState<any>(null);
  const [studentGroups, setStudentGroups] = useState<any[]>([]);
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
      setData(detail);
      setStudentGroups(sg.student_groups || []);
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => { void loadData(); }, [loadData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 gap-3 text-text-muted">
        <Loader className="animate-spin" size={20} />
        Yuklanmoqda...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-32 text-text-muted">
        Ma'lumot topilmadi
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6">
        <Link to="/retake/groups" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-primary mb-3">
          <ArrowLeft size={16} /> Fan Guruhlariga qaytish
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-text-primary">
              {data.group.subject_name}
            </h1>
            <p className="text-sm text-text-muted mt-1">
              {data.group.code} &bull; {data.group.semester_name} &bull;{' '}
              {data.group.total_members} ta talaba
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-text-secondary">
              O'qituvchi: {data.group.teacher?.full_name || 'Tayinlanmagan'}
            </p>
            <span className={`mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-bold ${
              data.group.status === 'active'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}>
              {data.group.status_label}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border px-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'members' && <MembersTab studentGroups={data.student_groups || []} />}
      {tab === 'assessments' && (
        <AssessmentsTab
          groupId={Number(groupId)}
          assessments={data.assessments || []}
          studentGroups={studentGroups}
          teachers={data.teachers || []}
          onRefresh={loadData}
        />
      )}
      {tab === 'sheets' && <ExamSheetsTab assessments={data.assessments || []} />}
    </div>
  );
}

/* ───── Members tab ───── */

function MembersTab({ studentGroups }: { studentGroups: any[] }) {
  if (!studentGroups.length) {
    return <div className="card p-12 text-center text-text-muted text-sm">A'zolar topilmadi</div>;
  }
  return (
    <div className="space-y-3">
      {studentGroups.map((sg: any) => (
        <details key={sg.group_name} className="card overflow-hidden" open={studentGroups.length === 1}>
          <summary className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 select-none">
            <div className="flex items-center gap-3">
              <span className="font-black text-text-primary text-base">{sg.group_name}</span>
              <span className="text-sm text-text-muted">{sg.faculty_name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-text-secondary">{sg.count} talaba</span>
              <div className="flex gap-1">
                {(sg.control_types_needed as string[]).map((ct: string) => (
                  <span key={ct} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{ct}</span>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sg.members.map((m: any) => (
                  <tr key={m.membership_id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-bold text-text-primary">{m.student_name}</td>
                    <td className="px-4 py-3 text-text-muted font-mono text-xs">{m.student_id}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">{m.required_control_type}</span>
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs">{m.faculty_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </div>
  );
}

/* ───── Assessments tab ───── */

const CONTROL_TYPES = [
  { value: '1-jn', label: '1-JN' },
  { value: '2-jn', label: '2-JN' },
  { value: '1-on', label: '1-ON' },
  { value: '2-on', label: '2-ON' },
  { value: 'final', label: 'Yakuniy' },
];

function AssessmentsTab({
  groupId, assessments, studentGroups, teachers, onRefresh,
}: {
  groupId: number;
  assessments: any[];
  studentGroups: any[];
  teachers: any[];
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
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

  const assessmentMap: Record<string, Record<string, any>> = {};
  for (const a of assessments) {
    const key = a.student_group_name || '__all__';
    if (!assessmentMap[key]) assessmentMap[key] = {};
    assessmentMap[key][a.control_type] = a;
  }

  async function handleCreate() {
    if (!form.student_group_name || !form.scheduled_at) return;
    setIsSaving(true);
    setError('');
    try {
      const res = await createRetakeAssessmentForGroup(groupId, {
        student_group_name: form.student_group_name,
        control_type: form.control_type,
        scheduled_at: form.scheduled_at,
        room: form.room,
        pair_number: form.pair_number,
        teacher_id: form.teacher_id ? Number(form.teacher_id) : undefined,
      });
      if (res.success) {
        setShowForm(false);
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

  return (
    <div className="space-y-6">
      {/* Matrix */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-black text-text-primary">Nazorat holati</h3>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white">
            <Plus size={14} /> Nazorat qo'shish
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-black text-text-muted uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">HEMIS Guruh</th>
                {CONTROL_TYPES.map(ct => (
                  <th key={ct.value} className="px-3 py-3 text-center">{ct.label}</th>
                ))}
                <th className="px-3 py-3 text-center">Talabalar</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {studentGroups.map((sg: any) => (
                <tr key={sg.group_name} className="hover:bg-slate-50/50">
                  <td className="px-4 py-4">
                    <p className="font-black text-text-primary">{sg.group_name}</p>
                  </td>
                  {CONTROL_TYPES.map(ct => {
                    const needed = (sg.control_types_needed as string[]).includes(ct.value);
                    const assessment = assessmentMap[sg.group_name]?.[ct.value];
                    return (
                      <td key={ct.value} className="px-3 py-4 text-center">
                        {!needed ? (
                          <span className="text-slate-300 text-lg">&mdash;</span>
                        ) : assessment ? (
                          <div>
                            <span className="text-emerald-600 text-sm font-bold">&check;</span>
                            {assessment.exam_sheet && (
                              <Link to={`/retake/exam-sheets/${assessment.exam_sheet.id}`} className="block text-xs text-primary hover:underline mt-0.5">
                                {assessment.exam_sheet.sheet_no}
                              </Link>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setForm(f => ({ ...f, student_group_name: sg.group_name, control_type: ct.value }));
                              setShowForm(true);
                            }}
                            className="text-xs text-amber-600 hover:text-amber-800 font-bold hover:underline"
                          >
                            + Qo'shish
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-4 text-center text-text-muted">{sg.student_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assessment form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md p-8 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-text-primary">Nazorat qo'shish</h3>
              <button onClick={() => setShowForm(false)} className="rounded-xl p-2 hover:bg-slate-100">
                <X size={18} className="text-text-muted" />
              </button>
            </div>

            {error && <p className="text-sm font-bold text-danger bg-danger/10 rounded-xl px-4 py-2">{error}</p>}

            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-wider text-text-muted">HEMIS Guruh</label>
              <select value={form.student_group_name} onChange={e => setForm(f => ({ ...f, student_group_name: e.target.value }))} className="input">
                <option value="">Guruh tanlang</option>
                {studentGroups.map((sg: any) => (
                  <option key={sg.group_name} value={sg.group_name}>{sg.group_name} ({sg.student_count} talaba)</option>
                ))}
              </select>

              <label className="text-xs font-black uppercase tracking-wider text-text-muted">Nazorat turi</label>
              <select value={form.control_type} onChange={e => setForm(f => ({ ...f, control_type: e.target.value }))} className="input">
                {CONTROL_TYPES.map(ct => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>

              <label className="text-xs font-black uppercase tracking-wider text-text-muted">Sana va vaqt</label>
              <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} className="input" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-text-muted">Xona</label>
                  <input type="text" value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} className="input" placeholder="201-xona" />
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-text-muted">Para</label>
                  <input type="number" min="1" max="6" value={form.pair_number} onChange={e => setForm(f => ({ ...f, pair_number: Number(e.target.value) }))} className="input" />
                </div>
              </div>

              <label className="text-xs font-black uppercase tracking-wider text-text-muted">O'qituvchi</label>
              <select value={form.teacher_id} onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))} className="input">
                <option value="">Guruh o'qituvchisi</option>
                {teachers.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 rounded-2xl border border-border py-3 text-sm font-bold">Bekor</button>
              <button
                disabled={isSaving || !form.student_group_name || !form.scheduled_at}
                onClick={() => void handleCreate()}
                className="flex-1 rounded-2xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {isSaving ? 'Saqlanmoqda...' : 'Yaratish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───── ExamSheets tab ───── */

function ExamSheetsTab({ assessments }: { assessments: any[] }) {
  const sheetsWithExam = assessments.filter((a: any) => a.exam_sheet);

  if (!sheetsWithExam.length) {
    return (
      <div className="card p-12 text-center text-sm text-text-muted">
        Hali qaydnoma yaratilmagan. Nazorat jadvali tabida nazorat qo'shing.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-border px-6 py-4">
        <h3 className="font-black text-text-primary">Qaydnomalar holati</h3>
      </div>
      <div className="divide-y">
        {sheetsWithExam.map((a: any) => (
          <div key={a.id} className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="font-black text-text-primary">
                {a.student_group_name || 'Barcha talabalar'} &mdash; {a.control_type_label}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {new Date(a.scheduled_at).toLocaleDateString('uz')} &bull; {a.room || '—'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right text-sm">
                <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-bold ${
                  a.exam_sheet.status === 'locked' ? 'bg-emerald-50 text-emerald-700' :
                  a.exam_sheet.status === 'submitted' ? 'bg-amber-50 text-amber-700' :
                  'bg-blue-50 text-blue-700'
                }`}>
                  {a.exam_sheet.status_label}
                </span>
                <p className="text-xs text-text-muted mt-1">
                  {a.exam_sheet.graded_count}/{a.exam_sheet.entries_count} baholangan
                </p>
              </div>
              <Link
                to={`/retake/exam-sheets/${a.exam_sheet.id}`}
                className="rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-primary/5 hover:border-primary/20 transition-colors"
              >
                {a.exam_sheet.sheet_no} &rarr;
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
