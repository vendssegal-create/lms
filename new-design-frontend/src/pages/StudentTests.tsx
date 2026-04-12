import React from 'react';
import { 
  FileText, 
  Hourglass, 
  Trophy, 
  Play, 
  ChevronRight, 
  ShieldCheck, 
  UserCheck,
  AlertTriangle,
  Clock,
  Camera,
  Shield,
  Award,
  Zap,
  TrendingUp
} from 'lucide-react';
import { motion } from 'motion/react';
import { User } from '@/src/types';
import { mockTests } from '@/src/lib/mockData';
import { cn } from '@/src/lib/utils';

interface StudentTestsProps {
  user: User;
}

export default function StudentTests({ user }: StudentTestsProps) {
  const stats = [
    { label: 'Mavjud testlar', value: '12', icon: FileText, color: 'bg-primary' },
    { label: 'Topshirilgan', value: '8', icon: UserCheck, color: 'bg-success' },
    { label: 'O\'rtacha ball', value: '84%', icon: TrendingUp, color: 'bg-secondary' },
    { label: 'Qolgan urinishlar', value: '15', icon: Zap, color: 'bg-warning' },
  ];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="relative rounded-[48px] overflow-hidden bg-slate-900 text-white p-12 lg:p-20">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/20 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-secondary/10 rounded-full blur-[120px]"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
        </div>

        <div className="relative z-10 max-w-3xl space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/10">
            <Shield size={14} className="text-primary" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em]">Xavfsiz imtihon tizimi</span>
          </div>
          <h2 className="text-5xl lg:text-7xl font-black tracking-tighter leading-none">
            Bilimingizni <br /> <span className="text-primary">sinovdan o'tkazing</span>
          </h2>
          <p className="text-lg text-white/60 font-medium leading-relaxed">
            Barcha testlar Face ID va proktoring nazorati ostida o'tkaziladi. 
            Testni boshlashdan oldin kamerangiz ishlayotganiga ishonch hosil qiling.
          </p>
          <div className="flex flex-wrap gap-6 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
                <Camera size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-white/40 uppercase tracking-wider">Proktoring</p>
                <p className="text-sm font-black text-white">FAOL</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
                <Shield size={20} className="text-success" />
              </div>
              <div>
                <p className="text-xs font-bold text-white/40 uppercase tracking-wider">Xavfsizlik</p>
                <p className="text-sm font-black text-white">YUQORI</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="card p-8 group hover:translate-y-[-4px] transition-all"
          >
            <div className="flex items-center gap-5">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg", stat.color)}>
                <stat.icon size={28} />
              </div>
              <div>
                <p className="text-[10px] font-extrabold text-text-muted uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                <h3 className="text-3xl font-black text-text-primary tracking-tighter">{stat.value}</h3>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tests Grid */}
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-extrabold text-text-primary tracking-tight">Mavjud testlar</h3>
          <div className="flex gap-2">
            <button className="px-4 py-2 rounded-xl bg-slate-100 text-text-primary text-xs font-bold hover:bg-slate-200 transition-colors">Barchasi</button>
            <button className="px-4 py-2 rounded-xl bg-white text-text-secondary text-xs font-bold hover:bg-slate-50 transition-colors">Faol</button>
            <button className="px-4 py-2 rounded-xl bg-white text-text-secondary text-xs font-bold hover:bg-slate-50 transition-colors">Yakunlangan</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {mockTests.map((test, idx) => (
            <motion.div 
              key={test.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="card group hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 border-none"
            >
              <div className="p-10 space-y-8">
                <div className="flex items-start justify-between">
                  <div className={cn(
                    "w-16 h-16 rounded-[24px] flex items-center justify-center text-white shadow-xl",
                    "bg-primary"
                  )}>
                    <FileText size={32} />
                  </div>
                  <span className={cn(
                    "status-pill px-4 py-1.5 text-[10px] font-black tracking-widest bg-success/10 text-success"
                  )}>
                    FAOL
                  </span>
                </div>

                <div className="space-y-3">
                  <h4 className="text-2xl font-extrabold text-text-primary leading-tight group-hover:text-primary transition-colors line-clamp-2 min-h-[4rem]">
                    {test.name}
                  </h4>
                  <p className="text-sm text-text-secondary font-medium">
                    Ma'lumotlar bazasi boshqarish tizimlari
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-6 py-6 border-y border-slate-50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-text-muted">
                      <Clock size={14} />
                      <span className="label-micro">Vaqt</span>
                    </div>
                    <p className="text-base font-extrabold text-text-primary">45 daqiqa</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-text-muted">
                      <Award size={14} />
                      <span className="label-micro">Savollar</span>
                    </div>
                    <p className="text-base font-extrabold text-text-primary">30 ta</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 pt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-primary">
                      <Camera size={14} />
                    </div>
                    <span className="text-[10px] font-extrabold text-text-muted uppercase tracking-wider">Face ID</span>
                  </div>
                  <button className={cn(
                    "btn px-8 py-4 rounded-2xl gap-2 text-sm group/btn",
                    "btn-primary shadow-xl shadow-primary/20"
                  )}>
                    Boshlash
                    <Play size={16} className="group-hover/btn:scale-110 transition-transform" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
