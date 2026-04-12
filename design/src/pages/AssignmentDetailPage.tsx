import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, LoaderCircle, Save } from 'lucide-react';
import { fetchAssignmentDetail, gradeSubmission } from '@/src/api/lms';
import type { AssignmentDetailResponse, AssignmentSubmissionItem } from '@/src/types';
import { DeadlineExtensionModal } from '@/src/components/notifications/DeadlineExtensionModal';

const OFFICE_EXTENSIONS = new Set(['doc', 'docx', 'ppt', 'pptx']);

function formatDateTime(value: string | null) {
  if (!value) return 'Belgilanmagan';
  return new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function getFileExtension(fileUrl: string) {
  const path = fileUrl.split('?')[0].split('#')[0];
  const parts = path.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function buildPreviewUrl(fileUrl: string) {
  const extension = getFileExtension(fileUrl);
  if (extension === 'pdf') {
    return `${fileUrl}#toolbar=0`;
  }
  if (OFFICE_EXTENSIONS.has(extension)) {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;
  }
  return fileUrl;
}

function canPreviewInFrame(fileUrl: string) {
  const extension = getFileExtension(fileUrl);
  return extension === 'pdf' || OFFICE_EXTENSIONS.has(extension);
}

function SubmissionCard({
  item,
  canGrade,
  onGraded,
}: {
  item: AssignmentSubmissionItem;
  canGrade: boolean;
  onGraded: (next: AssignmentSubmissionItem) => void;
}) {
  const [score, setScore] = useState(item.score === null ? '' : String(item.score));
  const [feedback, setFeedback] = useState(item.feedback || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewable = !!item.file_url && canPreviewInFrame(item.file_url);
  const previewUrl = item.file_url ? buildPreviewUrl(item.file_url) : '';

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canGrade) return;
    setIsSaving(true);
    setError(null);
    try {
      const payload = new URLSearchParams();
      payload.set('score', score);
      payload.set('feedback', feedback);
      const response = await gradeSubmission(item.id, payload);
      if (!response.success) throw new Error("Saqlanmadi.");
      onGraded(response.submission);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-[28px] border border-border bg-slate-50 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-black text-text-primary">{item.student_name}</p>
          <p className="mt-1 text-sm font-medium text-text-secondary">Yuborilgan: {formatDateTime(item.submitted_at)}</p>
          {item.comment ? <p className="mt-3 text-sm font-medium leading-7 text-text-secondary">{item.comment}</p> : null}
        </div>
        {item.file_url ? (
          <div className="flex gap-2">
            {previewable ? (
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold text-text-primary"
              >
                Faylni ochish
                <ExternalLink size={16} />
              </button>
            ) : (
              <a href={item.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold text-text-primary">
                Faylni ochish
                <ExternalLink size={16} />
              </a>
            )}
          </div>
        ) : null}
      </div>

      {canGrade ? (
        <form className="mt-6 grid gap-3 md:grid-cols-[180px_1fr_auto]" onSubmit={(event) => void submit(event)}>
          <input
            value={score}
            onChange={(event) => setScore(event.target.value)}
            placeholder="Score"
            className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-text-primary outline-none"
          />
          <input
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder="Feedback (ixtiyoriy)"
            className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-text-primary outline-none"
          />
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-70"
          >
            {isSaving ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}
            Saqlash
          </button>
        </form>
      ) : null}
      {error ? <p className="mt-3 text-sm font-semibold text-rose-500">{error}</p> : null}

      {previewOpen && item.file_url ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-border bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
              <p className="text-sm font-black text-text-primary">Submission fayli preview</p>
              <button
                type="button"
                className="rounded-xl border border-border px-3 py-1 text-xs font-bold text-text-secondary"
                onClick={() => setPreviewOpen(false)}
              >
                Yopish
              </button>
            </div>
            <iframe
              src={previewUrl}
              title={`submission-preview-${item.id}`}
              className="h-[75vh] w-full border-none"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AssignmentDetailPage() {
  const params = useParams();
  const assignmentId = Number(params.assignmentId || 0);
  const [data, setData] = useState<AssignmentDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extOpen, setExtOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchAssignmentDetail(assignmentId);
        if (active) setData(response);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Topshiriq yuklanmadi.');
      } finally {
        if (active) setIsLoading(false);
      }
    }
    if (assignmentId) void load();
    return () => {
      active = false;
    };
  }, [assignmentId]);

  const backPath = useMemo(() => data?.course.spa_path || '/courses', [data]);
  const isOverdue = useMemo(() => {
    const dl = data?.assignment.deadline;
    if (!dl) return false;
    return new Date(dl).getTime() < Date.now();
  }, [data]);

  if (isLoading) {
    return (
      <div className="card flex min-h-[320px] items-center justify-center gap-3 p-8 text-text-secondary">
        <LoaderCircle className="animate-spin text-primary" size={20} />
        Topshiriq yuklanmoqda...
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="card p-8">
        <p className="text-lg font-black text-text-primary">Topshiriq yuklanmadi</p>
        <p className="mt-3 text-sm font-medium text-rose-500">{error || 'Nomaʼlum xatolik.'}</p>
        <Link to="/courses" className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-bold text-text-primary">
          <ArrowLeft size={16} />
          Kurslarga qaytish
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="card p-8 lg:p-10">
        <Link to={backPath} className="inline-flex items-center gap-2 text-sm font-bold text-text-secondary hover:text-text-primary">
          <ArrowLeft size={16} />
          {data.course.title}
        </Link>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-text-primary">{data.assignment.title}</h2>
        <p className="mt-3 max-w-4xl text-sm font-medium leading-7 text-text-secondary">{data.assignment.description}</p>
        <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold uppercase tracking-wide text-text-secondary">
          <span>Deadline: {formatDateTime(data.assignment.deadline)}</span>
          <span>Max score: {data.assignment.max_score}</span>
          <span>Submissions: {data.submissions.length}</span>
        </div>

        {!data.permissions.can_grade && isOverdue && data.assignment.deadline ? (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setExtOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-700 transition-colors hover:bg-amber-100"
            >
              Muddat uzaytirish so‘rovi
            </button>
          </div>
        ) : null}
      </section>

      <section className="space-y-6">
        {data.submissions.length ? (
          data.submissions.map((item) => (
            <div key={item.id}>
              <SubmissionCard
                item={item}
                canGrade={data.permissions.can_grade}
                onGraded={(next) => {
                  setData((current) => {
                    if (!current) return current;
                    return {
                      ...current,
                      submissions: current.submissions.map((sub) => (sub.id === next.id ? next : sub)),
                    };
                  });
                }}
              />
            </div>
          ))
        ) : (
          <div className="card p-8">
            <p className="text-lg font-black text-text-primary">Yuborilgan ish yo'q</p>
            <p className="mt-3 text-sm font-medium text-text-secondary">Hozircha submission topilmadi.</p>
          </div>
        )}
      </section>

      {data.assignment.deadline ? (
        <DeadlineExtensionModal
          open={extOpen}
          assignmentId={assignmentId}
          assignmentTitle={data.assignment.title}
          originalDeadline={data.assignment.deadline}
          onClose={() => setExtOpen(false)}
          onSuccess={() => {}}
        />
      ) : null}
    </div>
  );
}
