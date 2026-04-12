import React, { useState } from 'react';
import { GraduationCap, User as UserIcon, Lock, ArrowRight, University, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { User } from '@/src/types';
import { mockUser, mockStudent } from '@/src/lib/mockData';

interface LoginProps {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'admin') onLogin(mockUser);
    else onLogin(mockStudent);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Immersive Background Elements */}
      <div className="absolute inset-0 z-0">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-primary/20 rounded-full blur-[120px]"
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-secondary/10 rounded-full blur-[150px]"
        />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[480px] relative z-10"
      >
        <div className="text-center mb-12">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="w-20 h-20 bg-primary rounded-[28px] flex items-center justify-center text-white shadow-[0_20px_50px_rgba(67,97,238,0.3)] mx-auto mb-8 relative group"
          >
            <div className="absolute inset-0 bg-white/20 rounded-[28px] scale-110 blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <GraduationCap size={40} className="relative z-10" />
          </motion.div>
          <h1 className="text-4xl font-extrabold text-white mb-3 tracking-tighter">
            Django <span className="text-primary">LMS</span>
          </h1>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 backdrop-blur-md rounded-full border border-white/10">
            <Sparkles size={14} className="text-primary" />
            <span className="text-[10px] font-extrabold text-white/60 uppercase tracking-[0.2em]">Premium Edition v2.0</span>
          </div>
        </div>

        <div className="glass p-10 rounded-[40px] shadow-[0_40px_100px_rgba(0,0,0,0.4)]">
          <div className="mb-10">
            <button className="w-full btn bg-success text-white hover:bg-success/90 gap-3 py-4 rounded-2xl shadow-2xl shadow-success/20 group">
              <University size={20} className="group-hover:scale-110 transition-transform" />
              HEMIS ID orqali kirish
            </button>
            <div className="relative my-10">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em] font-extrabold text-white/30">
                <span className="bg-[#1a1c23] px-4 rounded-full">yoki login orqali</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-3">
              <label className="text-[10px] font-extrabold text-white/40 uppercase tracking-[0.15em] ml-1">Foydalanuvchi nomi</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors">
                  <UserIcon size={20} />
                </div>
                <input 
                  type="text" 
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-4 pl-14 text-white placeholder:text-white/20 outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all"
                  placeholder="Login yoki Talaba ID"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-extrabold text-white/40 uppercase tracking-[0.15em] ml-1">Parol</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors">
                  <Lock size={20} />
                </div>
                <input 
                  type="password" 
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-4 pl-14 text-white placeholder:text-white/20 outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="w-full btn btn-primary py-5 rounded-2xl gap-3 text-base group">
              Tizimga kirish
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <div className="mt-10 text-center">
            <a href="#" className="text-sm font-bold text-white/40 hover:text-primary transition-colors">Parolni unutdingizmi?</a>
          </div>
        </div>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-12 text-center text-[10px] text-white/20 font-extrabold uppercase tracking-[0.3em]"
        >
          &copy; 2026 Django LMS Premium &bull; Crafted for Excellence
        </motion.p>
      </motion.div>
    </div>
  );
}
