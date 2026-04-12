import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  FileText,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  User as UserIcon,
  Repeat,
  GraduationCap,
  Briefcase,
  Search,
  CalendarDays
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { User } from '@/src/types';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
}

export default function Layout({ children, user }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const RETAKE_ROLES = ['RET_REGISTRATOR', 'RET_ACCOUNTING', 'RET_SUPERVISOR', 'RET_DB_MANAGER'];

  const menuItems = [
    // LMS rollari
    { label: 'Boshqaruv paneli', icon: LayoutDashboard, path: '/', roles: ['STUDENT', 'TEACHER', 'ADMIN'] },
    { label: 'Mening kurslarim', icon: BookOpen, path: '/courses', roles: ['STUDENT'] },
    { label: 'Kurslarni boshqarish', icon: BookOpen, path: '/manage-courses', roles: ['TEACHER', 'ADMIN'] },
    { label: 'Testlarim', icon: FileText, path: '/student-tests', roles: ['STUDENT'] },
    { label: 'Foydalanuvchilar', icon: Users, path: '/users', roles: ['ADMIN'] },
    { label: 'Bildirishnomalar', icon: Bell, path: '/notifications', roles: ['STUDENT', 'TEACHER', 'ADMIN'] },
    // Qayta topshirish rollari
    { label: 'Bosh sahifa', icon: LayoutDashboard, path: '/retake/dashboard', roles: RETAKE_ROLES },
    { label: 'Arizalar', icon: FileText, path: '/retake', roles: RETAKE_ROLES },
    { label: 'Talabani qidirish', icon: Search, path: '/retake/search-student', roles: ['RET_REGISTRATOR'] },
    { label: 'Tsikllar', icon: Repeat, path: '/retake/cycles', roles: ['RET_SUPERVISOR', 'ADMIN'] },
    { label: 'Guruhlar', icon: Users, path: '/retake/groups', roles: ['RET_DB_MANAGER', 'ADMIN'] },
    { label: 'Jadval', icon: Briefcase, path: '/retake/schedules', roles: ['RET_DB_MANAGER', 'RET_REGISTRATOR'] },
    { label: 'Imtihon kalendarı', icon: CalendarDays, path: '/retake/exam-calendar', roles: ['RET_DB_MANAGER', 'RET_REGISTRATOR'] },
    { label: 'Sinxronizatsiya', icon: Repeat, path: '/retake/sync', roles: ['ADMIN'] },
  ];

  const filteredMenuItems = menuItems.filter(item => item.roles.includes(user.role));

  return (
    <div className="min-h-screen mesh-bg flex selection:bg-primary/10 selection:text-primary">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside 
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 z-50 w-80 bg-white/80 backdrop-blur-xl border-r border-border lg:relative lg:translate-x-0"
          >
            <div className="h-full flex flex-col">
              {/* Logo */}
              <div className="p-8 flex items-center gap-4">
                <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-primary/30">
                  <GraduationCap size={28} />
                </div>
                <span className="text-2xl font-extrabold tracking-tighter text-text-primary">
                  Django <span className="text-primary">LMS</span>
                </span>
              </div>

              {/* Navigation */}
              <nav className="flex-1 px-6 py-4 space-y-2 overflow-y-auto">
                {filteredMenuItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-4 px-5 py-4 rounded-[20px] text-sm font-bold transition-all duration-300 group relative overflow-hidden",
                        isActive 
                          ? "bg-primary text-white shadow-xl shadow-primary/20" 
                          : "text-text-secondary hover:bg-slate-100/50 hover:text-text-primary"
                      )}
                    >
                      <item.icon size={20} className={cn("relative z-10", isActive ? "text-white" : "text-text-muted group-hover:text-primary")} />
                      <span className="relative z-10">{item.label}</span>
                      {isActive && (
                        <motion.div 
                          layoutId="activeTab"
                          className="absolute inset-0 bg-primary"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                      {isActive && <ChevronRight size={16} className="ml-auto relative z-10" />}
                    </Link>
                  );
                })}
              </nav>

              {/* User Profile Mini */}
              <div className="p-6 border-t border-border/50">
                <Link 
                  to="/profile"
                  className="bg-slate-50/50 rounded-3xl p-4 flex items-center gap-4 border border-border/30 hover:bg-white hover:shadow-premium transition-all group"
                >
                  <div className="relative">
                    <img 
                      src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=4361ee&color=fff`} 
                      alt="Avatar" 
                      className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-premium group-hover:border-primary/30 transition-colors"
                    />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-success border-2 border-white rounded-full"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold text-text-primary truncate group-hover:text-primary transition-colors">{user.first_name} {user.last_name}</p>
                    <p className="label-micro text-primary">{user.role}</p>
                  </div>
                </Link>
                <button 
                  onClick={() => navigate('/login')}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold text-text-muted hover:bg-danger/10 hover:text-danger transition-all"
                >
                  <LogOut size={18} />
                  <span>Chiqish</span>
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-24 bg-white/40 backdrop-blur-md border-b border-border/50 flex items-center justify-between px-8 sticky top-0 z-40">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-3 rounded-2xl bg-white border border-border shadow-premium hover:bg-slate-50 text-text-secondary transition-all"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <div className="relative hidden md:block group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors">
                <Search size={18} />
              </div>
              <input 
                type="text" 
                placeholder="Qidiruv..." 
                className="bg-slate-100/50 border-transparent focus:bg-white focus:border-primary/20 rounded-2xl pl-12 pr-6 py-2.5 text-sm outline-none transition-all w-64 focus:w-80"
              />
            </div>
          </div>

          <div className="flex items-center gap-5">
            <button className="relative w-12 h-12 rounded-2xl bg-white border border-border shadow-premium flex items-center justify-center text-text-secondary hover:bg-slate-50 transition-all">
              <Bell size={20} />
              <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-danger rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-px bg-border/50 mx-2"></div>
            <Link to="/profile" className="flex items-center gap-4 p-1.5 pr-5 rounded-2xl hover:bg-white hover:shadow-premium border border-transparent hover:border-border transition-all group">
              <img 
                src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=4361ee&color=fff`} 
                alt="Avatar" 
                className="w-10 h-10 rounded-xl object-cover border border-border group-hover:border-primary/30 transition-colors shadow-sm"
              />
              <div className="hidden lg:block">
                <p className="text-xs font-extrabold text-text-primary">Mening profilim</p>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Sozlamalar</p>
              </div>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-7xl mx-auto">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
