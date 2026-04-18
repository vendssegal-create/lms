import { CheckCircle2, FileText, Upload, XCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { cn } from '@/src/lib/utils';
import StatusBadge from './StatusBadge';

export interface PaymentSectionData {
  status: string;
  declared_amount: string | number | null;
  accountant_amount: string | number | null;
  contract_file_url: string | null;
  receipt_file_url: string | null;
  accountant_comment: string | null;
}

function formatMoney(val: string | number | null): string {
  if (val === null || val === undefined || val === '') return '—';
  return new Intl.NumberFormat('uz-UZ').format(Number(val)) + " so'm";
}

interface Props {
  data: PaymentSectionData;
  canUpload?: boolean;
  canAccountingAction?: boolean;
  onUploadContract?: (file: File) => Promise<void>;
  onUploadReceipt?: (file: File) => Promise<void>;
  onAccountingApprove?: (amount: string, comment: string) => Promise<void>;
  onAccountingReject?: (comment: string) => Promise<void>;
  className?: string;
}

function FileRow({
  label,
  url,
  canUpload,
  onUpload,
}: {
  label: string;
  url: string | null;
  canUpload?: boolean;
  onUpload?: (file: File) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm">
        <FileText size={14} className={url ? 'text-success' : 'text-text-secondary'} />
        <span className="text-text-primary">{label}</span>
        {url ? (
          <CheckCircle2 size={13} className="text-success" />
        ) : (
          <XCircle size={13} className="text-text-secondary" />
        )}
      </div>
      <div className="flex items-center gap-2">
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            Ko'rish
          </a>
        )}
        {canUpload && onUpload && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleFile}
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-muted/80 disabled:opacity-50"
            >
              <Upload size={11} />
              {uploading ? 'Yuklanmoqda...' : url ? 'Yangilash' : 'Yuklash'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentSection({
  data,
  canUpload,
  canAccountingAction,
  onUploadContract,
  onUploadReceipt,
  onAccountingApprove,
  onAccountingReject,
  className,
}: Props) {
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [mode, setMode] = useState<'idle' | 'approve' | 'reject'>('idle');
  const [busy, setBusy] = useState(false);

  const handleApprove = async () => {
    if (!onAccountingApprove || !amount) return;
    setBusy(true);
    try {
      await onAccountingApprove(amount, comment);
      setMode('idle');
      setAmount('');
      setComment('');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!onAccountingReject || !rejectComment.trim()) return;
    setBusy(true);
    try {
      await onAccountingReject(rejectComment);
      setMode('idle');
      setRejectComment('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('rounded-2xl border border-border bg-card p-4 space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">To'lov</h3>
        <StatusBadge status={data.status} size="sm" />
      </div>

      {/* Amounts */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-xs text-text-secondary">Talaba e'lon qilgan</p>
          <p className="mt-0.5 font-semibold text-text-primary">
            {formatMoney(data.declared_amount)}
          </p>
        </div>
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-xs text-text-secondary">Buxgalter tasdiqlagan</p>
          <p className="mt-0.5 font-semibold text-text-primary">
            {formatMoney(data.accountant_amount)}
          </p>
        </div>
      </div>

      {/* Documents */}
      <div className="space-y-2 rounded-xl bg-muted/30 p-3">
        <p className="mb-2 text-xs font-medium text-text-secondary">Hujjatlar</p>
        <FileRow
          label="Shartnoma"
          url={data.contract_file_url}
          canUpload={canUpload}
          onUpload={onUploadContract}
        />
        <FileRow
          label="Kvitansiya"
          url={data.receipt_file_url}
          canUpload={canUpload}
          onUpload={onUploadReceipt}
        />
      </div>

      {/* Accountant comment */}
      {data.accountant_comment && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <p className="font-medium mb-1">Buxgalter izohi:</p>
          <p className="italic">"{data.accountant_comment}"</p>
        </div>
      )}

      {/* Accounting actions */}
      {canAccountingAction && data.status === 'in_review' && (
        <div className="space-y-3 border-t border-border pt-4">
          {mode === 'idle' && (
            <div className="flex gap-2">
              <button
                onClick={() => setMode('approve')}
                className="flex-1 rounded-xl bg-success/10 py-2 text-sm font-medium text-success hover:bg-success/20"
              >
                Tasdiqlash
              </button>
              <button
                onClick={() => setMode('reject')}
                className="flex-1 rounded-xl bg-danger/10 py-2 text-sm font-medium text-danger hover:bg-danger/20"
              >
                Rad etish
              </button>
            </div>
          )}

          {mode === 'approve' && (
            <div className="space-y-2">
              <input
                type="number"
                placeholder="Tasdiqlangan summa (so'm)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <textarea
                placeholder="Izoh (ixtiyoriy)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary resize-none"
              />
              <div className="flex gap-2">
                <button onClick={() => setMode('idle')} className="flex-1 rounded-xl bg-muted py-2 text-sm text-text-secondary">
                  Bekor
                </button>
                <button
                  onClick={handleApprove}
                  disabled={!amount || busy}
                  className="flex-1 rounded-xl bg-success py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? '...' : 'Tasdiqlash'}
                </button>
              </div>
            </div>
          )}

          {mode === 'reject' && (
            <div className="space-y-2">
              <textarea
                placeholder="Rad etish sababi *"
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-danger resize-none"
              />
              <div className="flex gap-2">
                <button onClick={() => setMode('idle')} className="flex-1 rounded-xl bg-muted py-2 text-sm text-text-secondary">
                  Bekor
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectComment.trim() || busy}
                  className="flex-1 rounded-xl bg-danger py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? '...' : 'Rad etish'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
