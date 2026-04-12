import React, { useState } from 'react';
import { 
  User as UserIcon, 
  Mail, 
  Phone, 
  MapPin, 
  Camera, 
  Shield, 
  Book, 
  GraduationCap, 
  Award,
  Calendar,
  Save,
  Lock,
  ExternalLink,
  ChevronRight,
  Briefcase,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';
import { User } from '@/src/types';
import { cn } from '@/src/lib/utils';

interface ProfileProps {
  user: User;
}

export default function Profile({ user }: ProfileProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-extrabold uppercase tracking-[0.2em]">
            Shaxsiy kabinet
          </div>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-text-primary tracking-tighter">
            Profil sozlamalari
          </h2>
          <p className="text-text-secondary text-lg font-medium max-w-xl">
            Shaxsiy ma'lumotlaringizni boshqaring va akademik natijalaringizni kuzatib boring.
          </p>
        </div>
        
        <div className="flex gap-4">
          <button className="btn bg-white text-text-primary border border-slate-200 px-6 py-4 rounded-2xl gap-2 hover:bg-slate-50 shadow-sm">
            <Lock size={20} />
            Parolni o'zgartirish
          </button>
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="btn btn-primary px-8 py-4 rounded-2xl gap-2 shadow-2xl shadow-primary/30"
          >
            {isEditing ? <Save size={20} /> : <Shield size={20} />}
            {isEditing ? 'Saqlash' : 'Tahrirlash'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        {/* Left Column: Profile Card */}
        <div className="xl:col-span-4 space-y-8">
          <div className="card p-10 text-center relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-primary to-secondary opacity-10 group-hover:opacity-20 transition-opacity"></div>
            
            <div className="relative z-10">
              <div className="relative inline-block mb-8">
                <img 
                  src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=4361ee&color=fff&size=200`} 
                  alt={user.first_name}
                  className="w-40 h-40 rounded-[40px] object-cover border-8 border-white shadow-2xl"
                />
                <button className="absolute bottom-2 right-2 w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-xl hover:scale-110 transition-transform border-4 border-white">
                  <Camera size={20} />
                </button>
              </div>

              <h3 className="text-3xl font-black text-text-primary tracking-tight mb-2">
                {user.first_name} {user.last_name}
              </h3>
              <p className="text-sm font-bold text-primary uppercase tracking-[0.2em] mb-8">{user.role}</p>

              <div className="space-y-4 text-left">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm">
                    <Mail size={18} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="label-micro">Email</p>
                    <p className="text-sm font-bold text-text-primary truncate">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-secondary shadow-sm">
                    <Phone size={18} />
                  </div>
                  <div>
                    <p className="label-micro">Telefon</p>
                    <p className="text-sm font-bold text-text-primary">{user.phone || '+998 90 123 45 67'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-success shadow-sm">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <p className="label-micro">Manzil</p>
                    <p className="text-sm font-bold text-text-primary">Toshkent sh., Yunusobod</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-8 space-y-6">
            <h4 className="text-lg font-extrabold text-text-primary flex items-center gap-2">
              <Award className="text-warning" size={20} />
              Yutuqlar
            </h4>
            <div className="grid grid-cols-4 gap-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="aspect-square rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 hover:text-primary hover:border-primary/20 transition-all cursor-help" title="Yutuq nomi">
                  <Award size={24} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Details & Form */}
        <div className="xl:col-span-8 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="card p-8 border-l-8 border-l-primary">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <GraduationCap size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-extrabold text-text-primary">Akademik holat</h4>
                  <p className="text-xs text-text-secondary font-medium">Joriy o'quv yili ma'lumotlari</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-slate-50">
                  <span className="text-sm font-bold text-text-secondary">Kurs</span>
                  <span className="text-sm font-black text-text-primary">3-kurs</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-slate-50">
                  <span className="text-sm font-bold text-text-secondary">Guruh</span>
                  <span className="text-sm font-black text-text-primary">611-21</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-sm font-bold text-text-secondary">GPA</span>
                  <span className="text-sm font-black text-success">4.2 / 5.0</span>
                </div>
              </div>
            </div>

            <div className="card p-8 border-l-8 border-l-secondary">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center">
                  <Book size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-extrabold text-text-primary">Yo'nalish</h4>
                  <p className="text-xs text-text-secondary font-medium">Mutaxassislik ma'lumotlari</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-slate-50">
                  <span className="text-sm font-bold text-text-secondary">Fakultet</span>
                  <span className="text-sm font-black text-text-primary">KIF</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-slate-50">
                  <span className="text-sm font-bold text-text-secondary">Kafedra</span>
                  <span className="text-sm font-black text-text-primary">Dasturiy injiniring</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-sm font-bold text-text-secondary">Ta'lim shakli</span>
                  <span className="text-sm font-black text-text-primary">Kunduzgi</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-10">
            <h4 className="text-2xl font-extrabold text-text-primary mb-10 tracking-tight">Shaxsiy ma'lumotlar</h4>
            <form className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-3">
                <label className="label-micro ml-1">Ism</label>
                <input 
                  type="text" 
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-sm font-bold text-text-primary outline-none focus:bg-white focus:border-primary/30 transition-all"
                  defaultValue={user.first_name}
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-3">
                <label className="label-micro ml-1">Familiya</label>
                <input 
                  type="text" 
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-sm font-bold text-text-primary outline-none focus:bg-white focus:border-primary/30 transition-all"
                  defaultValue={user.last_name}
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-3">
                <label className="label-micro ml-1">Tug'ilgan sana</label>
                <div className="relative">
                  <Calendar size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-sm font-bold text-text-primary outline-none focus:bg-white focus:border-primary/30 transition-all"
                    defaultValue="15.05.2003"
                    disabled={!isEditing}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label className="label-micro ml-1">Jinsi</label>
                <select 
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-sm font-bold text-text-primary outline-none focus:bg-white focus:border-primary/30 transition-all appearance-none cursor-pointer"
                  disabled={!isEditing}
                >
                  <option>Erkak</option>
                  <option>Ayol</option>
                </select>
              </div>
              <div className="md:col-span-2 space-y-3">
                <label className="label-micro ml-1">Biografiya</label>
                <textarea 
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-sm font-bold text-text-primary outline-none focus:bg-white focus:border-primary/30 transition-all min-h-[120px]"
                  placeholder="O'zingiz haqingizda qisqacha..."
                  disabled={!isEditing}
                ></textarea>
              </div>
            </form>
          </div>

          <div className="card p-10">
            <h4 className="text-2xl font-extrabold text-text-primary mb-8 tracking-tight">Xavfsizlik va Kirish</h4>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[32px] border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-primary shadow-sm">
                    <Lock size={20} />
                  </div>
                  <div>
                    <p className="text-base font-extrabold text-text-primary">Ikki bosqichli autentifikatsiya</p>
                    <p className="text-sm text-text-secondary font-medium">Hisobingiz xavfsizligini oshiring</p>
                  </div>
                </div>
                <button className="px-6 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all">Yoqish</button>
              </div>
              <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[32px] border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-secondary shadow-sm">
                    <Shield size={20} />
                  </div>
                  <div>
                    <p className="text-base font-extrabold text-text-primary">Kirish tarixi</p>
                    <p className="text-sm text-text-secondary font-medium">Oxirgi faollikni kuzatish</p>
                  </div>
                </div>
                <button className="px-6 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all">Ko'rish</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
