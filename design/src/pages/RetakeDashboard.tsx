import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  ChevronRight,
  FileText,
  CreditCard,
  CheckCircle2,
  UserCheck,
  Layers,
  PlusCircle,
  Inbox,
  Eye,
  Wallet,
  GraduationCap,
  BadgeCheck,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { fetchRetakeDashboardStats, RetakeDashboardStatsResponse } from '@/src/api/retake';

// ─── Status badge config ─────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT:              { label: "Qoralama",            className: "bg-slate-100 text-slate-600" },
  IN_REVIEW:          { label: "Ko'rib chiqilmoqda",  className: "bg-primary/10 text-primary" },
  PARTIALLY_APPROVED: { label: "Qisman tasdiqlangan", className: "bg-warning/10 text-warning" },
  APPROVED:           { label: "Tasdiqlangan",        className: "bg-success/10 text-success" },
  COMPLETED:          { label: "Yakunlangan",         className: "bg-success/10 text-success" },
  RETURNED:           { label: "Qaytarilgan",         className: "bg-danger/10 text-danger" },
  CANCELLED:          { label: "Bekor qilingan",      className: "bg-slate-100 text-slate-500" },
};

// ─── Kanban stage definition ──────────────────────────────────────────────────
interface PipelineStage {
  key: string;
  label: string;
  icon: React.ElementType;
  borderColor: string;
  bgColor: string;
  textColor: string;
  count: number;
}

// ─── Stat card definition ─────────────────────────────────────────────────────
interface StatCard {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}

export default function RetakeDashboard() {
  const [data, setData] = useState<RetakeDashboardStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchRetakeDashboardStats()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch(() => {
        setError("Ma'lumotlarni yuklashda xatolik yuz berdi.");
        setLoading(false);
      });
  }, []);

  // ── Top stats (4 summary cards) ────────────────────────────────────────────
  const stats: StatCard[] = data
    ? [
        { label: 'Jami arizalar',       value: data.stats.total,  icon: FileText,    color: 'bg-primary' },
        { label: data.stats.stat1_label, value: data.stats.stat1, icon: CreditCard,  color: 'bg-warning' },
        { label: data.stats.stat2_label, value: data.stats.stat2, icon: CheckCircle2, color: 'bg-success' },
        { label: data.stats.stat3_label, value: data.stats.stat3, icon: UserCheck,   color: 'bg-secondary' },
      ]
    : [];

  // ── Kanban pipeline stages ─────────────────────────────────────────────────
  // stat1 → Yangi/To'lovda, stat2 → Ko'rilmoqda, stat3 → Tasdiqlangan,
  // stat4 → Yakunlangan, total → Jami.
  // We expose all 5 meaningful stages so the pipeline is always informative.
  const pipelineStages: PipelineStage[] = data
    ? [
        {
          key: 'new',
          label: data.stats.stat1_label,
          icon: Inbox,
          borderColor: 'var(--color-warning)',
          bgColor: 'bg-warning/10',
          textColor: 'text-warning',
          count: data.stats.stat1,
        },
        {
          key: 'review',
          label: data.stats.stat2_label,
          icon: Eye,
          borderColor: 'var(--color-primary)',
          bgColor: 'bg-primary/10',
          textColor: 'text-primary',
          count: data.stats.stat2,
        },
        {
          key: 'payment',
          label: data.stats.stat3_label,
          icon: Wallet,
          borderColor: 'var(--color-secondary)',
          bgColor: 'bg-secondary/10',
          textColor: 'text-secondary',
          count: data.stats.stat3,
        },
        {
          key: 'approved',
          label: data.stats.stat4_label,
          icon: BadgeCheck,
          borderColor: 'var(--color-success)',
          bgColor: 'bg-success/10',
          textColor: 'text-success',
          count: data.stats.stat4,
        },
        {
          key: 'total',
          label: 'Jami',
          icon: GraduationCap,
          borderColor: 'var(--color-text-primary)',
          bgColor: 'bg-slate-100',
          textColor: 'text-text-primary',
          count: data.stats.total,
        },
      ]
    : [];

  return (
    <div className="space-y-12">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-secondary/10 text-secondary rounded-lg text-[10px] font-extrabold uppercase tracking-[0.2em]">
            Qayta o'qish tizimi
          </div>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-text-primary tracking-tighter">
            Retake Boshqaruvi
          </h2>
          <p className="text-text-secondary text-lg font-medium max-w-xl">
            Akademik qarzdorligi bor talabalarning arizalarini ko'rib chiqish va jarayonni nazorat qilish.
          </p>
        </div>

        <div className="flex gap-4">
          <Link
            to="/retake/search-student"
            className="btn btn-primary px-8 py-4 rounded-2xl gap-2 shadow-2xl shadow-primary/30 flex items-center"
          >
            <PlusCircle size={20} />
            Yangi ariza
          </Link>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-2xl bg-danger/10 border border-danger/20 px-6 py-4 text-danger font-semibold">
          {error}
        </div>
      )}

      {/* ── Summary stats grid ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading
          ? Array(4).fill(null).map((_, idx) => (
              <div key={idx} className="card p-8 animate-pulse">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 mb-6" />
                <div className="h-3 bg-slate-100 rounded w-2/3 mb-3" />
                <div className="h-8 bg-slate-100 rounded w-1/2" />
              </div>
            ))
          : stats.map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.07 }}
                className="card p-8 group hover-lift transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg",
                    "group-hover:scale-110 transition-transform duration-500",
                    stat.color,
                  )}>
                    <stat.icon size={28} />
                  </div>
                </div>
                <p className="text-[10px] font-extrabold text-text-muted uppercase tracking-[0.2em] mb-1">
                  {stat.label}
                </p>
                <h3 className="text-4xl font-black text-text-primary tracking-tighter">
                  {stat.value}
                </h3>
              </motion.div>
            ))
        }
      </div>

      {/* ── Kanban pipeline row ──────────────────────────────────────────────── */}
      {!loading && data && (
        <div className="card p-8 rounded-[32px]">
          {/* Section header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <Layers size={22} />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-text-primary tracking-tight">
                Arizalar holati — jarayon quvuri
              </h3>
              <p className="text-sm text-text-secondary font-medium mt-0.5">
                Har bir bosqichdagi arizalar soni
              </p>
            </div>
          </div>

          {/* Pipeline stages */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {pipelineStages.map((stage, idx) => (
              <motion.div
                key={stage.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + idx * 0.07 }}
                className="relative group"
              >
                {/* Arrow connector — only between stages, not after last */}
                {idx < pipelineStages.length - 1 && (
                  <div className="hidden lg:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-4 h-4">
                    <ChevronRight size={14} className="text-slate-300" />
                  </div>
                )}

                <div
                  className="card p-5 border-l-4 h-full group-hover:shadow-lg transition-all duration-300"
                  style={{ borderLeftColor: stage.borderColor }}
                >
                  {/* Icon badge */}
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center mb-4",
                    stage.bgColor,
                    stage.textColor,
                  )}>
                    <stage.icon size={18} />
                  </div>

                  {/* Count */}
                  <div className="text-3xl font-black text-text-primary tracking-tighter leading-none mb-1">
                    {stage.count}
                  </div>

                  {/* Label */}
                  <div className="text-[11px] font-bold text-text-secondary leading-snug mt-1">
                    {stage.label}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Completion ratio bar */}
          {data.stats.total > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-text-muted uppercase tracking-widest">
                  Yakunlanish darajasi
                </span>
                <span className="text-xs font-extrabold text-text-primary">
                  {Math.round((data.stats.stat4 / data.stats.total) * 100)}%
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(data.stats.stat4 / data.stats.total) * 100}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }}
                  className="h-full bg-success rounded-full"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Recent applications table ────────────────────────────────────────── */}
      <div className="card border-none shadow-2xl overflow-hidden rounded-[40px]">
        <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-success/10 text-success flex items-center justify-center">
              <FileText size={24} />
            </div>
            <h3 className="text-2xl font-extrabold text-text-primary tracking-tight">
              Oxirgi arizalar
            </h3>
          </div>
          <Link
            to="/retake"
            className="text-sm font-bold text-primary hover:underline flex items-center gap-1"
          >
            Barchasini ko'rish <ArrowRight size={16} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-10 space-y-4">
              {Array(5).fill(null).map((_, i) => (
                <div key={i} className="h-12 bg-slate-50 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left bg-slate-50/30">
                  <th className="px-10 py-6 text-[10px] font-extrabold text-text-muted uppercase tracking-[0.2em]">
                    Talaba
                  </th>
                  <th className="px-10 py-6 text-[10px] font-extrabold text-text-muted uppercase tracking-[0.2em]">
                    Tsikl
                  </th>
                  <th className="px-10 py-6 text-[10px] font-extrabold text-text-muted uppercase tracking-[0.2em]">
                    Sana
                  </th>
                  <th className="px-10 py-6 text-[10px] font-extrabold text-text-muted uppercase tracking-[0.2em]">
                    Holat
                  </th>
                  <th className="px-10 py-6 text-[10px] font-extrabold text-text-muted uppercase tracking-[0.2em] text-right">
                    Ariza
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(data?.recent_applications ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-10 py-12 text-center text-text-muted font-medium">
                      Hozircha arizalar mavjud emas
                    </td>
                  </tr>
                ) : (
                  (data?.recent_applications ?? []).map((app) => {
                    const statusCfg =
                      STATUS_CONFIG[app.status] ??
                      { label: app.status_label, className: "bg-slate-100 text-slate-600" };
                    return (
                      <tr
                        key={app.id}
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
                              {app.student_name?.[0] ?? '?'}
                            </div>
                            <p className="text-sm font-extrabold text-text-primary">
                              {app.student_name || '—'}
                            </p>
                          </div>
                        </td>
                        <td className="px-10 py-6">
                          <p className="text-sm font-bold text-text-secondary">
                            {app.cycle_name || '—'}
                          </p>
                        </td>
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-2 text-text-secondary">
                            <Calendar size={14} className="text-slate-400" />
                            <span className="text-sm font-medium">
                              {new Date(app.created_at).toLocaleDateString('uz-UZ')}
                            </span>
                          </div>
                        </td>
                        <td className="px-10 py-6">
                          <span
                            className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-black tracking-widest",
                              statusCfg.className,
                            )}
                          >
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-10 py-6 text-right">
                          <Link
                            to={`/retake?app_id=${app.id}`}
                            className="w-10 h-10 rounded-xl bg-slate-50 text-text-secondary hover:bg-primary/10 hover:text-primary transition-all inline-flex items-center justify-center border border-slate-100"
                          >
                            <ChevronRight size={18} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
