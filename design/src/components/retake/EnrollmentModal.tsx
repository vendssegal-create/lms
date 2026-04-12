import { useEffect, useState } from 'react';
import { X, UserPlus, Users, CheckCircle2, AlertCircle, Loader } from 'lucide-react';
import { fetchTeacherEnrollment, submitTeacherEnrollment } from '@/src/api/retake';

interface Props {
  groupId: number;
  groupCode: string;
  subjectName: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface HemisGroupInfo {
  group_name: string;
  faculty_name: string;
  count: number;
  enrolled_count: number;
  all_enrolled: boolean;
  students: Array<{
    full_name: string;
    student_id: string;
    is_enrolled: boolean;
    required_control_type: string;
  }>;
}

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()!.split(';').shift() ?? null;
  return null;
}

export default function EnrollmentModal({ groupId, groupCode, subjectName, onClose, onSuccess }: Props) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    void loadEnrollmentData();
  }, [groupId]);

  async function loadEnrollmentData() {
    setIsLoading(true);
    try {
      const json = await fetchTeacherEnrollment(groupId);
      setData(json);
      const notEnrolled = new Set<string>(
        (json.hemis_groups as HemisGroupInfo[])
          .filter((g: HemisGroupInfo) => !g.all_enrolled)
          .map((g: HemisGroupInfo) => g.group_name),
      );
      setSelected(notEnrolled);
    } catch {
      setMessage({ type: 'error', text: "Ma'lumot yuklanmadi" });
    } finally {
      setIsLoading(false);
    }
  }

  function toggleGroup(groupName: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set((data?.hemis_groups as HemisGroupInfo[] ?? []).map((g: HemisGroupInfo) => g.group_name)));
  }

  async function handleAction(action: 'create_course' | 'enroll') {
    if (selected.size === 0) {
      setMessage({ type: 'error', text: 'Kamida bitta HEMIS guruh tanlansin' });
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      const json = await submitTeacherEnrollment(groupId, {
        action,
        hemis_groups: Array.from(selected),
      });
      if (json.success) {
        setMessage({ type: 'success', text: json.message });
        await loadEnrollmentData();
        setTimeout(onSuccess, 1500);
      } else {
        setMessage({ type: 'error', text: json.error ?? 'Xatolik' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Server xatoligi' });
    } finally {
      setIsSaving(false);
    }
  }

  const hasCourse = Boolean(data?.group?.lms_course);
  const hemisGroups: HemisGroupInfo[] = data?.hemis_groups ?? [];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-border">
          <div>
            <h2 className="text-xl font-black text-text-primary">LMS Kursga Biriktirish</h2>
            <p className="text-sm text-text-muted mt-0.5">{subjectName} &bull; {groupCode}</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100 transition-colors">
            <X size={20} className="text-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-text-muted">
              <Loader className="animate-spin" size={20} />
              Yuklanmoqda...
            </div>
          ) : (
            <>
              {hasCourse ? (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span className="font-bold text-emerald-800 text-sm">
                      LMS Kurs: {data.group.lms_course.title}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-700 mt-1">
                    {data.group.lms_course.total_enrolled} ta talaba allaqachon biriktirilgan
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-amber-600" />
                    <span className="font-bold text-amber-800 text-sm">LMS kurs hali yaratilmagan</span>
                  </div>
                  <p className="text-xs text-amber-700 mt-1">Talabalarni biriktirish uchun avval kurs yaratiladi</p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-black text-text-primary">HEMIS Guruhlar</h3>
                  <button onClick={selectAll} className="text-xs font-bold text-primary hover:underline">Barchasini tanlash</button>
                </div>

                <div className="space-y-2">
                  {hemisGroups.map(hg => (
                    <label
                      key={hg.group_name}
                      className={`flex items-center gap-4 rounded-2xl border px-4 py-4 cursor-pointer transition-colors ${
                        selected.has(hg.group_name) ? 'border-primary bg-primary/5' : 'border-border hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(hg.group_name)}
                        onChange={() => toggleGroup(hg.group_name)}
                        className="w-4 h-4 accent-primary"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-text-primary">{hg.group_name}</span>
                          {hg.all_enrolled ? (
                            <span className="text-xs font-bold text-emerald-600">&check; Barchasi biriktirilgan</span>
                          ) : (
                            <span className="text-xs font-bold text-amber-600">{hg.enrolled_count}/{hg.count} biriktirilgan</span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted mt-0.5">{hg.faculty_name} &bull; {hg.count} ta talaba</p>
                        <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${hg.all_enrolled ? 'bg-emerald-500' : 'bg-amber-400'}`}
                            style={{ width: `${(hg.enrolled_count / hg.count) * 100}%` }}
                          />
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {message && (
                <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${
                  message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {message.text}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-8 py-6 border-t border-border bg-slate-50/50">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-border py-3 text-sm font-bold text-text-primary hover:bg-slate-100">Yopish</button>
          {!isLoading && (
            hasCourse ? (
              <button
                disabled={isSaving || selected.size === 0}
                onClick={() => void handleAction('enroll')}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {isSaving ? <Loader size={16} className="animate-spin" /> : <UserPlus size={16} />}
                {isSaving ? 'Biriktirilmoqda...' : 'Talabalarni biriktirish'}
              </button>
            ) : (
              <button
                disabled={isSaving || selected.size === 0}
                onClick={() => void handleAction('create_course')}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {isSaving ? <Loader size={16} className="animate-spin" /> : <Users size={16} />}
                {isSaving ? 'Yaratilmoqda...' : 'Kurs yaratish va biriktirish'}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
