import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  MoreVertical, 
  Users, 
  FileText, 
  Layers, 
  ExternalLink,
  Edit,
  Trash2,
  UserPlus,
  Clock,
  Calendar,
  ArrowUpRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { User, Course } from '@/src/types';
import { mockCourses } from '@/src/lib/mockData';
import { cn } from '@/src/lib/utils';

interface CoursesProps {
  user: User;
}

export default function Courses({ user }: CoursesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const isManagement = user.role === 'ADMIN' || user.role === 'TEACHER';

  const filteredCourses = mockCourses.filter(course => 
    course.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-extrabold uppercase tracking-[0.2em]">
            Akademik Resurslar
          </div>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-text-primary tracking-tighter">
            {isManagement ? 'Kurslarni boshqarish' : 'Mening kurslarim'}
          </h2>
          <p className="text-text-secondary text-lg font-medium max-w-xl">
            {isManagement ? 'Tizimdagi barcha o\'quv kurslarini nazorat qilish va yangilarini qo\'shish.' : 'Siz biriktirilgan barcha o\'quv kurslari va materiallar.'}
          </p>
        </div>
        
        {isManagement && (
          <button className="btn btn-primary px-10 py-4 rounded-2xl gap-3 shadow-2xl shadow-primary/30 text-base group">
            <Plus size={22} className="group-hover:rotate-90 transition-transform duration-300" />
            Yangi kurs yaratish
          </button>
        )}
      </div>

      {/* Featured Course */}
      {!isManagement && filteredCourses.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-[48px] overflow-hidden bg-slate-900 text-white min-h-[400px] flex items-center p-12 lg:p-20 group"
        >
          <div className="absolute inset-0 z-0">
            <img 
              src={filteredCourses[0].image_url} 
              className="w-full h-full object-cover opacity-30 group-hover:scale-105 transition-transform duration-1000"
              alt=""
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/60 to-transparent"></div>
          </div>
          
          <div className="relative z-10 max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary rounded-full text-[10px] font-black uppercase tracking-widest">
              Tavsiya etiladi
            </div>
            <h3 className="text-4xl lg:text-6xl font-black tracking-tighter leading-none">
              {filteredCourses[0].title}
            </h3>
            <p className="text-lg text-white/60 font-medium line-clamp-2">
              {filteredCourses[0].description}
            </p>
            <div className="flex items-center gap-8 pt-4">
              <button className="btn btn-primary px-10 py-4 rounded-2xl text-base">
                O'qishni davom ettirish
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
                  <Users size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white/40 uppercase tracking-wider">Talabalar</p>
                  <p className="text-sm font-black text-white">{filteredCourses[0].students_count}+</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <div className="glass p-5 rounded-[32px] flex flex-col md:flex-row gap-5">
        <div className="relative flex-1 group">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors">
            <Search size={20} />
          </div>
          <input 
            type="text" 
            className="w-full rounded-2xl border border-transparent bg-slate-100/50 px-6 py-4 pl-14 text-sm outline-none focus:bg-white focus:border-primary/20 transition-all"
            placeholder="Kurs nomini qidiring..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <select className="rounded-2xl border border-transparent bg-slate-100/50 px-6 py-4 text-sm font-bold text-text-secondary outline-none focus:bg-white focus:border-primary/20 transition-all cursor-pointer">
            <option>Barcha holatlar</option>
            <option>Faol</option>
            <option>Nofaol</option>
          </select>
          <select className="rounded-2xl border border-transparent bg-slate-100/50 px-6 py-4 text-sm font-bold text-text-secondary outline-none focus:bg-white focus:border-primary/20 transition-all cursor-pointer">
            <option>Eng yangilari</option>
            <option>A-Z</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
        {filteredCourses.map((course, idx) => (
          <motion.div 
            key={course.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="card group border-none shadow-xl hover:shadow-2xl hover:shadow-primary/10 hover-lift"
          >
            {/* Image */}
            <div className="relative h-64 overflow-hidden">
              <img 
                src={course.image_url} 
                alt={course.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent"></div>
              
              <div className="absolute top-6 right-6">
                <span className={cn(
                  "status-pill shadow-2xl backdrop-blur-md border border-white/20",
                  course.is_active ? "bg-success/80 text-white" : "bg-danger/80 text-white"
                )}>
                  {course.is_active ? 'FAOL' : 'NOFAOL'}
                </span>
              </div>

              <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                    <Clock size={14} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider">48 soat o'quv</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider">8.5/10</span>
                  <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 text-warning">
                    ★
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-10 space-y-8">
              <div className="space-y-4">
                <h4 className="text-2xl font-extrabold text-text-primary leading-tight group-hover:text-primary transition-colors line-clamp-2 min-h-[4rem]">
                  {course.title}
                </h4>
                <p className="text-sm text-text-secondary font-medium line-clamp-2 leading-relaxed">
                  {course.description}
                </p>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <img 
                  src={course.teacher.avatar_url} 
                  className="w-10 h-10 rounded-xl object-cover border-2 border-white shadow-sm"
                  alt=""
                />
                <div>
                  <p className="text-xs font-extrabold text-text-primary">{course.teacher.first_name} {course.teacher.last_name}</p>
                  <p className="label-micro mt-0.5">O'QITUVCHI</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6 py-6 border-y border-slate-50">
                <div className="space-y-1">
                  <p className="label-micro">Talabalar</p>
                  <p className="text-lg font-extrabold text-text-primary tracking-tight">{course.students_count}</p>
                </div>
                <div className="space-y-1 border-x border-slate-50 px-6">
                  <p className="label-micro">Testlar</p>
                  <p className="text-lg font-extrabold text-text-primary tracking-tight">5</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="label-micro">Bo'limlar</p>
                  <p className="text-lg font-extrabold text-text-primary tracking-tight">{course.sections_count}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <button className="flex-1 btn btn-primary py-4 rounded-2xl gap-2 text-base group/btn">
                  {isManagement ? 'Boshqarish' : 'O\'qishni boshlash'}
                  <ArrowUpRight size={20} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                </button>
                
                {isManagement && (
                  <div className="flex gap-3">
                    <button className="w-14 h-14 rounded-2xl bg-slate-50 text-text-secondary hover:bg-primary/10 hover:text-primary transition-all flex items-center justify-center border border-slate-100" title="Tahrirlash">
                      <Edit size={20} />
                    </button>
                    <button className="w-14 h-14 rounded-2xl bg-slate-50 text-text-secondary hover:bg-danger/10 hover:text-danger transition-all flex items-center justify-center border border-slate-100" title="O'chirish">
                      <Trash2 size={20} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
