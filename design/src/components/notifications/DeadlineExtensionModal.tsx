import { AnimatePresence, motion } from 'motion/react';
import { CalendarClock, SendHorizonal, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { createExtensionRequest } from '@/src/api/lms';
import { useToast } from '@/src/components/notifications/ToastProvider';

interface Props {
  open: boolean;
  assignmentId: number;
  assignmentTitle: string;
  originalDeadline: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeadlineExtensionModal({ open, assignmentId, assignmentTitle, originalDeadline, onClose, onSuccess }: Props) {
  const { success, error } = useToast();
  const [reason, setReason] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim() || !newDeadline) return;
    setLoading(true);
    try {
      await createExtensionRequest(assignmentId, {
        reason,
        requested_deadline: new Date(newDeadline).toISOString(),
      });
      success("So'rov yuborildi", "Admin ko'rib chiqadi va sizga xabar beradi");
      onSuccess();
      onClose();
    } catch (err) {
      error('Xatolik', err instanceof Error ? err.message : "So'rov yuborilmadi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.25 }}
            className="fixed left-1/2 top-1/2 z-[81] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-white p-6 shadow-[0_24px_72px_rgba(0,0,0,0.16)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50">
                  <CalendarClock className="text-amber-500" size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-text-primary">Muddat uzaytirish</h3>
                  <p className="text-xs font-medium text-text-secondary">So'rov yuborish</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-text-secondary transition-colors hover:bg-slate-50"
              >
                <X size={15} />
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-bold text-amber-700">{assignmentTitle}</p>
              <p className="mt-0.5 text-[11px] font-medium text-amber-600">
                Asl muddat: {new Date(originalDeadline).toLocaleString('uz-UZ')}
              </p>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
              <div>
                <label className="label-micro mb-2 block">Sabab *</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Muddat o'tib ketgani uchun sababingizni yozing..."
                  rows={3}
                  required
                  className="input w-full resize-none"
                />
              </div>
              <div>
                <label className="label-micro mb-2 block">So'ralgan yangi muddat *</label>
                <input
                  type="datetime-local"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  required
                  className="input w-full"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold text-text-primary transition-colors hover:bg-slate-50"
                >
                  Bekor qilish
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary flex-1">
                  <span className="inline-flex items-center justify-center gap-2">
                    {loading ? <span className="animate-spin text-lg">⏳</span> : <SendHorizonal size={15} />}
                    Yuborish
                  </span>
                </button>
              </div>
            </form>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

