import { cn } from '@/src/lib/utils';

export type RetakeStatus =
  | 'draft'
  | 'in_review'
  | 'partially_approved'
  | 'approved'
  | 'returned'
  | 'completed'
  | 'cancelled'
  | 'submitted_to_accounting'
  | 'payment_rejected'
  | 'payment_approved'
  | 'awaiting_supervisor'
  | 'supervisor_returned'
  | 'approved_for_grouping'
  | 'grouped'
  | 'scheduled'
  | 'grade_entry_open'
  | 'open'
  | 'closed'
  | 'archived'
  | 'submitted'
  | 'locked'
  | 'active'
  | string;

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  // RetakeCycle
  draft:                   { label: 'Qoralama',                  className: 'bg-slate-100 text-slate-600' },
  open:                    { label: 'Ochiq',                      className: 'bg-emerald-100 text-emerald-700' },
  closed:                  { label: 'Yopiq',                      className: 'bg-orange-100 text-orange-700' },
  archived:                { label: 'Arxivlangan',               className: 'bg-zinc-100 text-zinc-500' },

  // RetakeApplication
  in_review:               { label: "Ko'rib chiqilmoqda",         className: 'bg-blue-100 text-blue-700' },
  partially_approved:      { label: 'Qisman tasdiqlangan',        className: 'bg-amber-100 text-amber-700' },
  approved:                { label: 'Tasdiqlangan',               className: 'bg-green-100 text-green-700' },
  returned:                { label: 'Qaytarilgan',                className: 'bg-red-100 text-red-700' },
  completed:               { label: 'Yakunlangan',               className: 'bg-teal-100 text-teal-700' },
  cancelled:               { label: 'Bekor qilingan',            className: 'bg-gray-100 text-gray-500' },

  // RetakeApplicationItem
  submitted_to_accounting: { label: 'Buxgalteriyada',            className: 'bg-indigo-100 text-indigo-700' },
  payment_rejected:        { label: "To'lov rad etilgan",         className: 'bg-red-100 text-red-700' },
  payment_approved:        { label: "To'lov tasdiqlangan",        className: 'bg-green-100 text-green-700' },
  awaiting_supervisor:     { label: "Rahbar tasdig'ini kutmoqda", className: 'bg-amber-100 text-amber-700' },
  supervisor_returned:     { label: 'Rahbar qaytargan',           className: 'bg-orange-100 text-orange-700' },
  approved_for_grouping:   { label: 'Guruhlashga tayyor',        className: 'bg-cyan-100 text-cyan-700' },
  grouped:                 { label: 'Guruhlangan',               className: 'bg-violet-100 text-violet-700' },
  scheduled:               { label: 'Jadvalda',                  className: 'bg-purple-100 text-purple-700' },
  grade_entry_open:        { label: 'Baholash ochiq',            className: 'bg-lime-100 text-lime-700' },

  // ExamSheet
  submitted:               { label: 'Topshirilgan',              className: 'bg-sky-100 text-sky-700' },
  locked:                  { label: 'Bloklangan',                className: 'bg-zinc-200 text-zinc-600' },

  // SubjectGroup
  active:                  { label: 'Faol',                      className: 'bg-emerald-100 text-emerald-700' },
};

interface Props {
  status: RetakeStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export default function StatusBadge({ status, size = 'md', className }: Props) {
  const config = STATUS_MAP[status] ?? {
    label: status,
    className: 'bg-slate-100 text-slate-500',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
