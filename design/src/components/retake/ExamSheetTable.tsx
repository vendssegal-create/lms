import { AlertCircle, CheckCircle2, Lock, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/src/lib/utils';
import StatusBadge from './StatusBadge';

export interface ExamSheetEntry {
  id: number;
  student_name: string;
  student_id: string;
  score: number | null;
  max_score: number;
  is_absent: boolean;
  is_passed: boolean | null;
  grade_label: string | null;
}

export interface ExamSheetTableProps {
  entries: ExamSheetEntry[];
  sheetStatus: string;
  maxScore?: number;
  readOnly?: boolean;
  onSave?: (entries: Array<{ id: number; score: number | null; is_absent: boolean }>) => Promise<void>;
  saving?: boolean;
}

interface EntryEdit {
  score: string;
  is_absent: boolean;
  dirty: boolean;
}

export default function ExamSheetTable({
  entries,
  sheetStatus,
  maxScore,
  readOnly,
  onSave,
  saving,
}: ExamSheetTableProps) {
  const isEditable = !readOnly && sheetStatus === 'open';

  const [edits, setEdits] = useState<Record<number, EntryEdit>>(() => {
    const init: Record<number, EntryEdit> = {};
    for (const e of entries) {
      init[e.id] = {
        score: e.score !== null ? String(e.score) : '',
        is_absent: e.is_absent,
        dirty: false,
      };
    }
    return init;
  });

  useEffect(() => {
    setEdits((prev) => {
      const next = { ...prev };
      for (const e of entries) {
        if (!next[e.id]) {
          next[e.id] = { score: e.score !== null ? String(e.score) : '', is_absent: e.is_absent, dirty: false };
        }
      }
      return next;
    });
  }, [entries]);

  const handleScore = (id: number, val: string) => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], score: val, dirty: true },
    }));
  };

  const handleAbsent = (id: number, checked: boolean) => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], is_absent: checked, score: checked ? '' : prev[id].score, dirty: true },
    }));
  };

  const handleSave = async () => {
    if (!onSave) return;
    const payload = entries.map((e) => {
      const edit = edits[e.id];
      return {
        id: e.id,
        score: edit.score !== '' ? Number(edit.score) : null,
        is_absent: edit.is_absent,
      };
    });
    await onSave(payload);
    setEdits((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        next[Number(id)] = { ...next[Number(id)], dirty: false };
      }
      return next;
    });
  };

  const hasDirty = Object.values(edits).some((e) => e.dirty);
  const effective = maxScore ?? entries[0]?.max_score ?? 100;

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      {/* Toolbar */}
      {isEditable && onSave && (
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
          <p className="text-xs text-text-secondary">
            Max ball: <span className="font-semibold text-text-primary">{effective}</span>
          </p>
          <button
            onClick={handleSave}
            disabled={!hasDirty || saving}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              hasDirty && !saving
                ? 'bg-primary text-white hover:bg-primary/90'
                : 'bg-muted text-text-secondary cursor-not-allowed',
            )}
          >
            <Save size={12} />
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-text-secondary">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Talaba</th>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3 text-center">Ball</th>
              <th className="px-4 py-3 text-center">Kelmadi</th>
              <th className="px-4 py-3 text-center">Natija</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((entry, idx) => {
              const edit = edits[entry.id];
              const scoreNum = edit ? (edit.score !== '' ? Number(edit.score) : null) : entry.score;
              const isOver = scoreNum !== null && scoreNum > effective;
              const isNeg = scoreNum !== null && scoreNum < 0;
              const absent = edit ? edit.is_absent : entry.is_absent;

              return (
                <tr key={entry.id} className={cn('transition-colors', absent && 'bg-muted/30')}>
                  <td className="px-4 py-2.5 text-xs text-text-secondary">{idx + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-text-primary">{entry.student_name}</td>
                  <td className="px-4 py-2.5 text-xs text-text-secondary font-mono">{entry.student_id}</td>
                  <td className="px-4 py-2.5 text-center">
                    {isEditable ? (
                      <input
                        type="number"
                        min={0}
                        max={effective}
                        value={edit?.score ?? ''}
                        disabled={absent}
                        onChange={(e) => handleScore(entry.id, e.target.value)}
                        className={cn(
                          'w-16 rounded-lg border px-2 py-1 text-center text-sm outline-none transition-colors',
                          'border-border bg-background focus:border-primary',
                          (isOver || isNeg) && 'border-danger text-danger',
                          absent && 'opacity-40 cursor-not-allowed',
                        )}
                      />
                    ) : (
                      <span className={cn('font-mono', entry.score === null && 'text-text-secondary')}>
                        {entry.score !== null ? entry.score : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {isEditable ? (
                      <input
                        type="checkbox"
                        checked={absent}
                        onChange={(e) => handleAbsent(entry.id, e.target.checked)}
                        className="h-4 w-4 accent-danger"
                      />
                    ) : (
                      absent && <AlertCircle size={14} className="mx-auto text-danger" />
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {absent ? (
                      <span className="text-xs text-danger">Kelmagan</span>
                    ) : entry.grade_label ? (
                      <span className={cn(
                        'inline-flex items-center gap-1 text-xs font-medium',
                        entry.is_passed ? 'text-success' : 'text-danger',
                      )}>
                        {entry.is_passed
                          ? <CheckCircle2 size={12} />
                          : <AlertCircle size={12} />}
                        {entry.grade_label}
                      </span>
                    ) : (
                      <span className="text-xs text-text-secondary">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Locked notice */}
      {sheetStatus === 'locked' && (
        <div className="flex items-center gap-2 border-t border-border bg-zinc-50 px-4 py-2 text-xs text-zinc-500">
          <Lock size={12} />
          Varaqa bloklangan — o'zgartirish mumkin emas
        </div>
      )}
    </div>
  );
}
