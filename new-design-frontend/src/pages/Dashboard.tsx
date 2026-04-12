import React from 'react';
import { 
  Users, 
  BookOpen, 
  Briefcase, 
  GraduationCap, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  Sparkles,
  FileText
} from 'lucide-react';
import { motion } from 'motion/react';
import { User } from '@/src/types';
import { mockCourses } from '@/src/lib/mockData';
import { cn } from '@/src/lib/utils';

interface DashboardProps {
  user: User;
}

export default function Dashboard({ user }: DashboardProps) {
  const stats = [
    { label: 'Jami foydalanuvchi', value: '1,284', icon: Users, color: 'bg-primary', trend: '+12%' },
    { label: 'Jami kurslarimiz', value: '42', icon: BookOpen, color: 'bg-success', trend: '+5%' },
    { label: "O'qituvchilar soni", value: '86', icon: Briefcase, color: 'bg-warning', trend: '0%' },
    { label: 'Talabalar soni', value: '1,198', icon: GraduationCap, color: 'bg-danger', trend: '+8%' },
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden bg-slate-900 rounded-[48px] p-10 lg:p-16 text-white shadow-2xl"
      >
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-xs font-extrabold uppercase tracking-[0.2em] mb-8 border border-white/10">
            <Sparkles size={14} className="text-primary" />
            Tizim yangilandi v2.0
          </div>
          <h2 className="text-4xl lg:text-6xl font-extrabold mb-6 tracking-tighter leading-[1.1]">
            Xush kelibsiz, <span className="text-primary">{user.first_name}</span>! 👋
          </h2>
          <p className="text-white/60 text-xl font-medium leading-relaxed mb-10 max-w-2xl">
            Tizimning umumiy nazorati, foydalanuvchilarni boshqarish va statistik ma'lumotlarni kuzatish uchun barcha vositalar shu yerda.
          </p>
          <div className="flex flex-wrap gap-5">
            <button className="btn btn-primary px-10 py-4 rounded-2xl text-base">
              Yangi kurs yaratish
            </button>
            <button className="btn bg-white/5 hover:bg-white/10 backdrop-blur-md text-white px-10 py-4 rounded-2xl border border-white/10 text-base">
              Hisobotlarni ko'rish
            </button>
          </div>
        </div>
        
        {/* Abstract animated shapes */}
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-24 -right-24 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px]"
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.5, 1],
            x: [0, 50, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-48 -left-24 w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[150px]"
        />
      </motion.div>

      {/* Stats Grid */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
      >
        {stats.map((stat, i) => (
          <motion.div key={i} variants={item} className="card p-8 group relative hover-lift">
            <div className={cn("w-16 h-16 rounded-[24px] flex items-center justify-center text-white shadow-2xl group-hover:scale-110 transition-transform duration-500 mb-6", stat.color)}>
              <stat.icon size={32} />
            </div>
            <div className="space-y-1">
              <p className="label-micro">{stat.label}</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-extrabold text-text-primary tracking-tighter">{stat.value}</p>
                <span className={cn(
                  "text-xs font-bold px-2 py-1 rounded-lg",
                  stat.trend.startsWith('+') ? "text-success bg-success/10" : "text-text-muted bg-slate-100"
                )}>
                  {stat.trend}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: 'Yangi kurs', icon: BookOpen, color: 'text-primary', bg: 'bg-primary/5' },
          { label: 'Talaba qo\'shish', icon: Users, color: 'text-success', bg: 'bg-success/5' },
          { label: 'Imtihon yaratish', icon: FileText, color: 'text-secondary', bg: 'bg-secondary/5' },
          { label: 'Hisobotlar', icon: TrendingUp, color: 'text-warning', bg: 'bg-warning/5' },
        ].map((action, i) => (
          <motion.button
            key={i}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn("p-6 rounded-[32px] border border-border/50 flex flex-col items-center gap-4 transition-all hover:border-primary/20 hover:shadow-premium group", action.bg)}
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", action.color)}>
              <action.icon size={24} />
            </div>
            <span className="text-sm font-black text-text-primary tracking-tight">{action.label}</span>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-10">
          <div className="card">
            <div className="p-10 border-b border-border/50 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-extrabold text-text-primary tracking-tight">Oxirgi yaratilgan kurslar</h3>
                <p className="text-sm text-text-secondary font-medium mt-1">Yaqinda qo'shilgan o'quv materiallari</p>
              </div>
              <button className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-text-secondary hover:bg-primary hover:text-white transition-all group">
                <ArrowRight size={20} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/30 text-[10px] font-extrabold text-text-muted uppercase tracking-[0.2em]">
                    <th className="px-10 py-5">Kurs nomi</th>
                    <th className="px-10 py-5">O'qituvchi</th>
                    <th className="px-10 py-5">Mavzular</th>
                    <th className="px-10 py-5">Holat</th>
                    <th className="px-10 py-5 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {mockCourses.map((course) => (
                    <tr key={course.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-10 py-6">
                        <p className="font-bold text-text-primary group-hover:text-primary transition-colors text-base">{course.title}</p>
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-primary">
                            {course.teacher.first_name[0]}
                          </div>
                          <span className="text-sm text-text-secondary font-bold">
                            {course.teacher.first_name} {course.teacher.last_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <span className="bg-slate-100 text-slate-600 px-4 py-1.5 rounded-xl text-[11px] font-extrabold uppercase tracking-wider">
                          {course.sections_count} mavzu
                        </span>
                      </td>
                      <td className="px-10 py-6">
                        <span className={cn(
                          "status-pill",
                          course.is_active ? "status-pill-success" : "status-pill-muted"
                        )}>
                          {course.is_active ? 'Faol' : 'Nofaol'}
                        </span>
                      </td>
                      <td className="px-10 py-6 text-right">
                        <button className="p-3 rounded-xl hover:bg-slate-100 text-text-muted transition-colors">
                          <ArrowRight size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar Area */}
        <div className="space-y-10">
          {/* Retake Stats */}
          <div className="card p-10 bg-slate-900 text-white border-none shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-colors"></div>
            
            <div className="flex items-center gap-3 mb-10 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-primary">
                <TrendingUp size={20} />
              </div>
              <h3 className="text-xl font-extrabold tracking-tight">Retake statistikasi</h3>
            </div>
            
            <div className="space-y-8 relative z-10">
              {[
                { label: "Buxgalteriya ko'rigida", value: 12, total: 45, color: 'bg-warning' },
                { label: "Tasdiqlangan arizalar", value: 28, total: 45, color: 'bg-success' },
                { label: "Jami arizalar", value: 45, total: 45, color: 'bg-primary' },
              ].map((item, i) => (
                <div key={i} className="space-y-3">
                  <div className="flex justify-between text-[10px] font-extrabold uppercase tracking-[0.15em]">
                    <span className="text-white/40">{item.label}</span>
                    <span className="text-white">{item.value}</span>
                  </div>
                  <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.value / item.total) * 100}%` }}
                      transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 + i * 0.2 }}
                      className={cn("h-full rounded-full", item.color)}
                    ></motion.div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Users */}
          <div className="card">
            <div className="p-8 border-b border-border/50">
              <h3 className="text-lg font-extrabold text-text-primary tracking-tight">Yaqinda qo'shilganlar</h3>
            </div>
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-all cursor-pointer group">
                  <div className="relative">
                    <img 
                      src={`https://ui-avatars.com/api/?name=User+${i}&background=random&color=fff`} 
                      className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-sm group-hover:scale-105 transition-transform"
                      alt=""
                    />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-success border-2 border-white rounded-full"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-text-primary truncate group-hover:text-primary transition-colors">Foydalanuvchi {i + 1}</p>
                    <p className="label-micro mt-0.5">TALABA</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-text-muted whitespace-nowrap">2 soat oldin</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 pt-0">
              <button className="w-full btn btn-outline py-3 rounded-xl text-xs">
                Barcha foydalanuvchilar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
