const preloaders: Array<[(path: string) => boolean, () => Promise<unknown>]> = [
  [(path) => path === '/' || path.startsWith('/super-admin') || path.startsWith('/admin/'), () => import('@/src/pages/AdminDashboardPage')],
  [(path) => path.startsWith('/profile'), () => import('@/src/pages/ProfilePage')],
  [(path) => path.startsWith('/messages'), async () => {
    const [{ prefetchMessagesOverview }] = await Promise.all([
      import('@/src/api/messages'),
    ]);
    await Promise.all([
      import('@/src/pages/MessagesPage'),
      import('@/src/pages/MessageThreadPage'),
      prefetchMessagesOverview(),
    ]);
  }],
  [(path) => path.startsWith('/notifications'), () => import('@/src/pages/NotificationsPage')],
  [(path) => path.startsWith('/courses/manage'), async () => {
    await Promise.all([
      import('@/src/pages/ManageCoursesPage'),
      import('@/src/pages/CourseManagePage'),
    ]);
  }],
  [(path) => path.startsWith('/courses/') && path.includes('/forum'), async () => {
    await Promise.all([
      import('@/src/pages/CourseForumPage'),
      import('@/src/pages/ForumTopicPage'),
    ]);
  }],
  [(path) => path.startsWith('/courses/') && path.includes('/gradebook'), () => import('@/src/pages/TeacherGradebookPage')],
  [(path) => path.startsWith('/courses/'), () => import('@/src/pages/CourseDetailPage')],
  [(path) => path.startsWith('/courses'), () => import('@/src/pages/CoursesPage')],
  [(path) => path.startsWith('/tests/manage'), async () => {
    await Promise.all([
      import('@/src/pages/ManageTestsPage'),
      import('@/src/pages/EditTestPage'),
    ]);
  }],
  [(path) => path.startsWith('/tests/') && path.endsWith('/take'), () => import('@/src/pages/TakeTestPage')],
  [(path) => path.startsWith('/tests/') && path.endsWith('/result'), () => import('@/src/pages/TestResultPage')],
  [(path) => path.startsWith('/tests/'), () => import('@/src/pages/EditTestPage')],
  [(path) => path.startsWith('/tests'), () => import('@/src/pages/TestsPage')],
  [(path) => path.startsWith('/assignments/'), () => import('@/src/pages/AssignmentDetailPage')],
  [(path) => path.startsWith('/grades'), () => import('@/src/pages/StudentGradesPage')],
  [(path) => path.startsWith('/retake'), async () => {
    const [{ prefetchRetakeOverview }] = await Promise.all([
      import('@/src/api/retake'),
    ]);
    await Promise.all([
      import('@/src/pages/RetakePage'),
      import('@/src/pages/RetakeSearchStudentPage'),
      import('@/src/pages/RetakeStudentDebtsPage'),
      import('@/src/pages/RetakeTeacherGroupsPage'),
      import('@/src/pages/RetakeExamSheetPage'),
      import('@/src/pages/RetakeCyclesPage'),
      import('@/src/pages/RetakeManageGroupsPage'),
      import('@/src/pages/RetakeSchedulesPage'),
      import('@/src/pages/RetakeExamCalendarPage'),
      import('@/src/pages/RetakeSyncPage'),
      prefetchRetakeOverview(),
    ]);
  }],
];

const loadedPaths = new Set<string>();

export function preloadRoute(path: string) {
  if (!path.startsWith('/') || loadedPaths.has(path)) {
    return;
  }

  const match = preloaders.find(([predicate]) => predicate(path));
  if (!match) {
    return;
  }

  loadedPaths.add(path);
  void match[1]();
}
