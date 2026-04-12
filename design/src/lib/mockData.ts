import { User, Course, Section, Resource, Test, RetakeApplication } from '@/src/types';

export const mockUser: User = {
  id: 1,
  username: 'admin',
  email: 'admin@lms.uz',
  first_name: 'Admin',
  last_name: 'User',
  role: 'ADMIN',
  avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
};

export const mockStudent: User = {
  id: 2,
  username: 'student123',
  email: 'student@lms.uz',
  first_name: 'Temur',
  last_name: 'Axmedov',
  role: 'STUDENT',
  avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
};

export const mockCourses: Course[] = [
  {
    id: 1,
    title: "Ma'lumotlar bazasi boshqarish tizimlari",
    description: "Ushbu kursda SQL, NoSQL va ma'lumotlar bazasini loyihalash asoslari o'rgatiladi.",
    teacher: mockUser,
    is_active: true,
    deadline: '2026-06-01',
    image_url: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?q=80&w=1000&auto=format&fit=crop',
    sections_count: 12,
    students_count: 45
  },
  {
    id: 2,
    title: "Veb dasturlash (React & Node.js)",
    description: "Zamonaviy veb ilovalarni React frameworki va Node.js platformasida yaratish.",
    teacher: mockUser,
    is_active: true,
    deadline: '2026-05-15',
    image_url: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?q=80&w=1000&auto=format&fit=crop',
    sections_count: 8,
    students_count: 32
  },
  {
    id: 3,
    title: "Kiberxavfsizlik asoslari",
    description: "Axborot xavfsizligi, tarmoq himoyasi va kriptografiya asoslari.",
    teacher: mockUser,
    is_active: false,
    deadline: '2026-04-20',
    image_url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=1000&auto=format&fit=crop',
    sections_count: 15,
    students_count: 28
  }
];

export const mockSections: Section[] = [
  { id: 1, course_id: 1, name: "Kirish. MB tushunchasi", is_published: true, order: 1 },
  { id: 2, course_id: 1, name: "Relyatsion model", is_published: true, order: 2 },
  { id: 3, course_id: 1, name: "SQL tili asoslari", is_published: true, order: 3 },
];

export const mockResources: Resource[] = [
  { id: 1, section_id: 1, title: "Leksiyalar to'plami (PDF)", resource_type: 'file', file_url: '#' },
  { id: 2, section_id: 1, title: "MB nima? (Video)", resource_type: 'video', url: 'https://youtube.com' },
];

export const mockTests: Test[] = [
  {
    id: 1,
    course_id: 1,
    name: "1-modul bo'yicha joriy nazorat",
    duration_minutes: 30,
    max_score: 100,
    attempts: 2,
    proctoring_enabled: true,
    face_id_required: true
  }
];

export const mockRetakeApps: RetakeApplication[] = [
  {
    id: 101,
    student_id: 2,
    cycle_id: 1,
    status: 'in_review',
    declared_amount: 450000,
    created_at: '2026-04-01T10:00:00Z',
    updated_at: '2026-04-02T15:30:00Z'
  }
];

export const mockRetakeApplications = [
  { id: 1, student_name: 'Temur Axmedov', course_title: "Ma'lumotlar bazasi boshqarish tizimlari", applied_at: '2026-04-01', status: 'PENDING' },
  { id: 2, student_name: 'Malika Karimova', course_title: 'Veb dasturlash (React & Node.js)', applied_at: '2026-04-02', status: 'APPROVED' },
  { id: 3, student_name: 'Jasur Saidov', course_title: 'Kiberxavfsizlik asoslari', applied_at: '2026-04-03', status: 'REJECTED' },
  { id: 4, student_name: 'Nigora Aliyeva', course_title: 'Algoritmlar va ma\'lumotlar tuzilmasi', applied_at: '2026-04-04', status: 'PENDING' },
  { id: 5, student_name: 'Sardor Rahimiv', course_title: 'Sun\'iy intellekt asoslari', applied_at: '2026-04-05', status: 'APPROVED' },
];
