import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Calendar,
  MoreHorizontal,
  ChevronRight,
  TrendingUp,
  FileText,
  UserCheck,
  Layers,
  CreditCard,
  Users,
  PlusCircle,
  RotateCcw,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { fetchRetakeDashboardStats, RetakeDashboardStatsResponse } from '@/src/api/retake';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT:                    { label: "Qoralama",           className: "bg-slate-100 text-slate-600" },
  IN_REVIEW:                { label: "Ko'rib chiqilmoqda", className: "bg-blue-50 text-blue-600" },
  PARTIALLY_APPROVED:       { label: "Qisman tasdiqlangan",className: "bg-amber-50 text-amber-600" },
  APPROVED:                 { label: "Tasdiqlangan",       className: "bg-success/10 text-success" },
  COMPLETED:                { label: "Yakunlangan",        className: "bg-emerald-50 text-emerald-700" },
  RETURNED:                 { label: "Qaytarilgan",        className: "bg-danger/10 text-danger" },
  CANCELLED:                { label: "Bekor qilingan",     className: "bg-slate-100 text-slate-500" },
};

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

  const STAT_COLORS = ['bg-primary', 'bg-warning', 'bg-success', 'bg-secondary'];
  const STAT_ICONS = [FileText, CreditCard, CheckCircle2, UserCheck];

  const stats = data
    ? [
        { label: 'Jami arizalar',      value: data.stats.total,   icon: FileText,    color: 'bg-primary' },
        { label: data.stats.stat1_label, value: data.stats.stat1, icon: STAT_ICONS[1], color: STAT_COLORS[1] },
        { label: data.stats.stat2_label, value: data.stats.stat2, icon: STAT_ICONS[2], color: STAT_COLORS[2] },
        { label: data.stats.stat3_label, value: data.stats.stat3, icon: STAT_ICONS[3], color: STAT_COLORS[3] },
      ]
    : Array(4).fill(null);

  return (
    <div className="space-y-12">
      {/* Header */}
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

      {/* Error */}
      {error && (
        <div className="rounded-2xl bg-danger/10 border border-danger/20 px-6 py-4 text-danger font-semibold">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading
          ? Array(4).fill(null).map((_, idx) => (
              <div key={idx} className="card p-8 animate-pulse">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 mb-6" />
                <div className="h-3 bg-slate-100 rounded w-2/3 mb-3" />
                <div className="h-8 bg-slate-100 rounded w-1/2" />
              </div>
            ))
          : stats.map((stat, idx) => stat && (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                className="card p-8 group hover-lift transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-500", stat.color)}>
                    <stat.icon size={28} />
                  </div>
                </div>
                <p className="text-[10px] font-extrabold text-text-muted uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                <h3 className="text-4xl font-black text-text-primary tracking-tighter">{stat.value}</h3>
              </motion.div>
            ))
        }
      </div>

      {/* Pipeline */}
      {!loading && data && (
        <div className="glass p-10 rounded-[40px] border-none shadow-2xl shadow-slate-200/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-center gap-4 mb-12 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Layers size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-text-primary tracking-tight">Arizalar holati</h3>
              <p className="text-sm text-text-secondary font-medium">Joriy taqsimot</p>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 relative z-10">
            {[
              { label: data.stats.stat1_label, value: data.stats.stat1, color: "bg-amber-500" },
              { label: data.stats.stat2_label, value: data.stats.stat2, color: "bg-blue-500" },
              { label: data.stats.stat3_label, value: data.stats.stat3, color: "bg-emerald-500" },
              { label: data.stats.stat4_label, value: data.stats.stat4, color: "bg-rose-500" },
              { label: "Jami",                 value: data.stats.total, color: "bg-primary" },
            ].map((stage, idx) => (
              <motion.div key={stage.label} whileHover={{ y: -6 }} className="relative group">
                <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-xl group-hover:shadow-2xl group-hover:border-primary/20 transition-all duration-500">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg mb-4", stage.color)}>
                    <span className="text-lg font-black">{stage.value}</span>
                  </div>
                  <h4 className="text-sm font-extrabold text-text-primary leading-snug">{stage.label}</h4>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Applications */}
      <div className="card border-none shadow-2xl overflow-hidden rounded-[40px]">
        <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-success/10 text-success flex items-center justify-center">
              <FileText size={24} />
            </div>
            <h3 className="text-2xl font-extrabold text-text-primary tracking-tight">Oxirgi arizalar</h3>
          </div>
          <Link to="/retake" className="text-sm font-bold text-primary hover:underline flex items-center gap-1">
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
                  <th className="px-10 py-6 text-[10px] font-extrabold text-text-muted uppercase tracking-[0.2em]">Talaba</th>
                  <th className="px-10 py-6 text-[10px] font-extrabold text-text-muted uppercase tracking-[0.2em]">Tsikl</th>
                  <th className="px-10 py-6 text-[10px] font-extrabold text-text-muted uppercase tracking-[0.2em]">Sana</th>
                  <th className="px-10 py-6 text-[10px] font-extrabold text-text-muted uppercase tracking-[0.2em]">Holat</th>
                  <th className="px-10 py-6 text-[10px] font-extrabold text-text-muted uppercase tracking-[0.2em] text-right">Ariza</th>
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
                    const statusCfg = STATUS_CONFIG[app.status] ?? { label: app.status_label, className: "bg-slate-100 text-slate-600" };
                    return (
                      <tr key={app.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-primary font-bold text-sm">
                              {app.student_name?.[0] ?? '?'}
                            </div>
                            <p className="text-sm font-extrabold text-text-primary">{app.student_name || '—'}</p>
                          </div>
                        </td>
                        <td className="px-10 py-6">
                          <p className="text-sm font-bold text-text-secondary">{app.cycle_name || '—'}</p>
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
                          <span className={cn("px-3 py-1 rounded-full text-[10px] font-black tracking-widest", statusCfg.className)}>
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
