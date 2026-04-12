import React from 'react';
import { 
  ClipboardList, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Filter,
  Download,
  Calendar,
  MoreHorizontal,
  ChevronRight,
  TrendingUp,
  FileText,
  UserCheck,
  Layers,
  Repeat,
  PlusCircle,
  CreditCard,
  Users,
  BookOpen
} from 'lucide-react';
import { motion } from 'motion/react';
import { User } from '@/src/types';
import { mockRetakeApplications } from '@/src/lib/mockData';
import { cn } from '@/src/lib/utils';

interface RetakeDashboardProps {
  user: User;
}

export default function RetakeDashboard({ user }: RetakeDashboardProps) {
  const stats = [
    { label: 'Jami arizalar', value: '156', icon: FileText, color: 'bg-primary', trend: '+12%' },
    { label: 'To\'lov kutilmoqda', value: '24', icon: CreditCard, color: 'bg-warning', trend: '+5%' },
    { label: 'Boshliq tasdig\'ida', value: '18', icon: UserCheck, color: 'bg-secondary', trend: '+18%' },
    { label: 'Guruhlangan', value: '114', icon: Users, color: 'bg-success', trend: '-2%' },
  ];

  const stages = [
    { id: 'NEW', label: 'Yangi', count: 12, color: 'bg-blue-500' },
    { id: 'PENDING', label: 'Ko\'rib chiqilmoqda', count: 8, color: 'bg-amber-500' },
    { id: 'APPROVED', label: 'Tasdiqlangan', count: 15, color: 'bg-emerald-500' },
    { id: 'REJECTED', label: 'Rad etilgan', count: 5, color: 'bg-rose-500' },
  ];

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
          <button className="btn bg-white text-text-primary border border-slate-200 px-6 py-4 rounded-2xl gap-2 hover:bg-slate-50 shadow-sm">
            <Download size={20} />
            Hisobot yuklash
          </button>
          <button className="btn btn-primary px-8 py-4 rounded-2xl gap-2 shadow-2xl shadow-primary/30">
            <Filter size={20} />
            Filtrlash
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
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
              <div className={cn(
                "px-3 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1",
                stat.trend.startsWith('+') ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
              )}>
                <TrendingUp size={12} className={stat.trend.startsWith('-') ? "rotate-180" : ""} />
                {stat.trend}
              </div>
            </div>
            <p className="text-[10px] font-extrabold text-text-muted uppercase tracking-[0.2em] mb-1">{stat.label}</p>
            <h3 className="text-4xl font-black text-text-primary tracking-tighter">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      {/* Pipeline Visualization */}
      <div className="glass p-10 rounded-[40px] border-none shadow-2xl shadow-slate-200/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="flex items-center justify-between mb-12 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Layers size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-text-primary tracking-tight">Arizalar oqimi</h3>
              <p className="text-sm text-text-secondary font-medium">Jarayon bosqichlari bo'yicha taqsimot</p>
            </div>
          </div>
          <div className="flex -space-x-3">
            {[1,2,3,4].map(i => (
              <img key={i} src={`https://i.pravatar.cc/150?u=${i}`} className="w-10 h-10 rounded-full border-4 border-white shadow-sm" alt="" />
            ))}
            <div className="w-10 h-10 rounded-full bg-slate-100 border-4 border-white flex items-center justify-center text-[10px] font-bold text-text-muted">
              +12
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -translate-y-1/2 z-0 hidden lg:block"></div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 relative z-10">
            {stages.map((stage, idx) => (
              <motion.div 
                key={stage.id} 
                whileHover={{ y: -8 }}
                className="relative group"
              >
                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-xl group-hover:shadow-2xl group-hover:border-primary/20 transition-all duration-500">
                  <div className="flex items-center justify-between mb-6">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-500", stage.color)}>
                      <span className="text-lg font-black">{stage.count}</span>
                    </div>
                    <ChevronRight size={20} className="text-slate-300 group-hover:text-primary transition-colors" />
                  </div>
                  <h4 className="text-lg font-extrabold text-text-primary mb-2">{stage.label}</h4>
                  <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(stage.count / 40) * 100}%` }}
                      transition={{ duration: 1, delay: idx * 0.2 }}
                      className={cn("h-full rounded-full", stage.color)}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Applications Table */}
      <div className="card border-none shadow-2xl overflow-hidden rounded-[40px]">
        <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-success/10 text-success flex items-center justify-center">
              <FileText size={24} />
            </div>
            <h3 className="text-2xl font-extrabold text-text-primary tracking-tight">Oxirgi arizalar</h3>
          </div>
          <button className="text-sm font-bold text-primary hover:underline flex items-center gap-1">
            Barchasini ko'rish <ArrowRight size={16} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left bg-slate-50/30">
                <th className="px-10 py-6 text-[10px] font-extrabold text-text-muted uppercase tracking-[0.2em]">Talaba</th>
                <th className="px-10 py-6 text-[10px] font-extrabold text-text-muted uppercase tracking-[0.2em]">Fan</th>
                <th className="px-10 py-6 text-[10px] font-extrabold text-text-muted uppercase tracking-[0.2em]">Sana</th>
                <th className="px-10 py-6 text-[10px] font-extrabold text-text-muted uppercase tracking-[0.2em]">Holat</th>
                <th className="px-10 py-6 text-[10px] font-extrabold text-text-muted uppercase tracking-[0.2em] text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {mockRetakeApplications.slice(0, 5).map((app) => (
                <tr key={app.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-primary font-bold shadow-sm">
                        {app.student_name[0]}
                      </div>
                      <div>
                        <p className="text-base font-extrabold text-text-primary">{app.student_name}</p>
                        <p className="label-micro mt-0.5">ID: 2110045</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-6">
                    <p className="text-base font-bold text-text-secondary">{app.course_title}</p>
                    <p className="label-micro mt-0.5">Kredit: 6</p>
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-2 text-text-secondary">
                      <Calendar size={14} className="text-slate-400" />
                      <span className="text-sm font-medium">{app.applied_at}</span>
                    </div>
                  </td>
                  <td className="px-10 py-6">
                    <span className={cn(
                      "status-pill px-4 py-1.5 text-[10px] font-black tracking-widest",
                      app.status === 'APPROVED' ? "bg-success/10 text-success" : 
                      app.status === 'PENDING' ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"
                    )}>
                      {app.status}
                    </span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button className="w-10 h-10 rounded-xl bg-slate-50 text-text-secondary hover:bg-primary/10 hover:text-primary transition-all flex items-center justify-center border border-slate-100">
                        <UserCheck size={18} />
                      </button>
                      <button className="w-10 h-10 rounded-xl bg-slate-50 text-text-secondary hover:bg-slate-200 transition-all flex items-center justify-center border border-slate-100">
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
