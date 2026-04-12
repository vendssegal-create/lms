import { lazy, Suspense } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AppShell } from '@/src/components/layout/app-shell';
import { ProtectedRoute } from '@/src/components/layout/route-guard';

const CoursesPage = lazy(() => import('@/src/pages/CoursesPage'));
const CourseDetailPage = lazy(() => import('@/src/pages/CourseDetailPage'));
const DashboardPage = lazy(() => import('@/src/pages/DashboardPage'));
const LoginPage = lazy(() => import('@/src/pages/LoginPage'));
const ProfilePage = lazy(() => import('@/src/pages/ProfilePage'));
const RetakePage = lazy(() => import('@/src/pages/RetakePage'));
const TestsPage = lazy(() => import('@/src/pages/TestsPage'));
const AssignmentDetailPage = lazy(() => import('@/src/pages/AssignmentDetailPage'));
const TakeTestPage = lazy(() => import('@/src/pages/TakeTestPage'));
const TestResultPage = lazy(() => import('@/src/pages/TestResultPage'));
const ManageTestsPage = lazy(() => import('@/src/pages/ManageTestsPage'));
const EditTestPage = lazy(() => import('@/src/pages/EditTestPage'));
const TestQuestionsPage = lazy(() => import('@/src/pages/TestQuestionsPage'));
const NotificationsPage = lazy(() => import('@/src/pages/NotificationsPage'));
const StudentGradesPage = lazy(() => import('@/src/pages/StudentGradesPage'));
const CourseForumPage = lazy(() => import('@/src/pages/CourseForumPage'));
const ForumTopicPage = lazy(() => import('@/src/pages/ForumTopicPage'));
const TeacherGradebookPage = lazy(() => import('@/src/pages/TeacherGradebookPage'));
const ManageCoursesPage = lazy(() => import('@/src/pages/ManageCoursesPage'));
const CourseManagePage = lazy(() => import('@/src/pages/CourseManagePage'));
const MessagesPage = lazy(() => import('@/src/pages/MessagesPage'));
const SuperAdminPage = lazy(() => import('@/src/pages/SuperAdminPage'));
const SidebarManagementPage = lazy(() => import('@/src/pages/SidebarManagementPage'));
const RetakeTeacherGroupsPage = lazy(() => import('@/src/pages/RetakeTeacherGroupsPage'));
const RetakeExamSheetPage = lazy(() => import('@/src/pages/RetakeExamSheetPage'));
const RetakeCyclesPage = lazy(() => import('@/src/pages/RetakeCyclesPage'));
const RetakeManageGroupsPage = lazy(() => import('@/src/pages/RetakeManageGroupsPage'));
const RetakeGroupDetailPage = lazy(() => import('@/src/pages/RetakeGroupDetailPage'));
const RetakeSchedulesPage = lazy(() => import('@/src/pages/RetakeSchedulesPage'));
const RetakeExamCalendarPage = lazy(() => import('@/src/pages/RetakeExamCalendarPage'));
const RetakeDashboard = lazy(() => import('@/src/pages/RetakeDashboard'));
const RetakeSearchStudentPage = lazy(() => import('@/src/pages/RetakeSearchStudentPage'));
const RetakeStudentDebtsPage = lazy(() => import('@/src/pages/RetakeStudentDebtsPage'));
const RetakeSyncPage = lazy(() => import('@/src/pages/RetakeSyncPage'));
const AdminDashboardPage = lazy(() => import('@/src/pages/AdminDashboardPage'));
const AdminCreateTeacherPage = lazy(() => import('@/src/pages/AdminCreateTeacherPage'));
const AdminCreateStudentPage = lazy(() => import('@/src/pages/AdminCreateStudentPage'));
const AdminExtensionRequestsPage = lazy(() => import('@/src/pages/AdminExtensionRequestsPage'));
const LegacyFramePage = lazy(() => import('@/src/pages/LegacyFramePage'));
const CertificateVerifyPage = lazy(() => import('@/src/pages/CertificateVerifyPage'));
const CertificatePrintRedirectPage = lazy(() => import('@/src/pages/CertificatePrintRedirectPage'));
const DocumentEditorPage = lazy(() => import('@/src/pages/DocumentEditorPage'));

function RouteFallback() {
  return (
    <div className="flex min-h-[320px] items-center justify-center gap-3 rounded-3xl border border-border bg-white p-8 shadow-premium">
      <LoaderCircle className="animate-spin text-primary" size={20} />
      <span className="text-sm font-bold text-text-secondary">Sahifa yuklanmoqda...</span>
    </div>
  );
}

function RedirectCourseDetail() {
  const { courseId } = useParams();
  return <Navigate to={`/courses/${courseId || ''}`} replace />;
}

function RedirectCourseManage() {
  const { courseId } = useParams();
  return <Navigate to={`/courses/${courseId || ''}/manage`} replace />;
}

function RedirectTestEdit() {
  const { testId } = useParams();
  return <Navigate to={`/tests/${testId || ''}/edit`} replace />;
}

function RedirectTestTake() {
  const { testId } = useParams();
  return <Navigate to={`/tests/${testId || ''}/take`} replace />;
}

function RedirectTestResult() {
  const { testId } = useParams();
  return <Navigate to={`/tests/${testId || ''}/result`} replace />;
}

function RedirectCourseGradebook() {
  const { courseId } = useParams();
  return <Navigate to={`/courses/${courseId || ''}/gradebook`} replace />;
}

export function AppRouter() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Allow trailing slash (/login/) and accidental nested paths */}
        <Route path="/login/*" element={<LoginPage />} />
        <Route
          path="/verify/:serial"
          element={
            <Suspense fallback={<RouteFallback />}>
              <CertificateVerifyPage />
            </Suspense>
          }
        />
        <Route element={<ProtectedRoute />}>
          {/* Django HTML sertifikat — SPA * route ga tushmasin (asosiy sahifaga tashlamaslik) */}
          <Route
            path="/lms/courses/:courseId/certificate/print"
            element={
              <Suspense fallback={<RouteFallback />}>
                <CertificatePrintRedirectPage />
              </Suspense>
            }
          />
          <Route
            path="/lms/courses/:courseId/certificate/print/"
            element={
              <Suspense fallback={<RouteFallback />}>
                <CertificatePrintRedirectPage />
              </Suspense>
            }
          />
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/super-admin" element={<SuperAdminPage />} />
            <Route path="/super-admin/sidebar" element={<SidebarManagementPage />} />
            <Route path="/super-admin/sidebar/menus" element={<SidebarManagementPage />} />
            <Route path="/super-admin/sidebar/access" element={<SidebarManagementPage />} />
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/super-admin/extension-requests" element={<AdminExtensionRequestsPage />} />
            <Route path="/admin/teachers/create" element={<AdminCreateTeacherPage />} />
            <Route path="/admin/students/create" element={<AdminCreateStudentPage />} />
            <Route path="/retake" element={<RetakePage />} />
            <Route path="/retake/applications" element={<RetakePage />} />
            <Route path="/retake/search-student" element={<RetakeSearchStudentPage />} />
            <Route path="/retake/students/:studentId/debts" element={<RetakeStudentDebtsPage />} />
            <Route path="/retake/sync" element={<RetakeSyncPage />} />
            <Route path="/retake/teacher/groups" element={<RetakeTeacherGroupsPage />} />
            <Route path="/retake/exam-sheets/:sheetId" element={<RetakeExamSheetPage />} />
            <Route path="/retake/cycles" element={<RetakeCyclesPage />} />
            <Route path="/retake/dashboard" element={<RetakeDashboard />} />
            <Route path="/retake/groups" element={<RetakeManageGroupsPage />} />
            <Route path="/retake/groups/:groupId" element={<RetakeGroupDetailPage />} />
            <Route path="/retake/schedules" element={<RetakeSchedulesPage />} />
            <Route path="/retake/exam-calendar" element={<RetakeExamCalendarPage />} />
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/courses/manage" element={<ManageCoursesPage />} />
            <Route path="/courses/:courseId" element={<CourseDetailPage />} />
            <Route path="/courses/:courseId/manage" element={<CourseManagePage />} />
            <Route path="/editor/certificate/:templateId" element={<DocumentEditorPage />} />
            <Route path="/tests" element={<TestsPage />} />
            <Route path="/tests/manage" element={<ManageTestsPage />} />
            <Route path="/tests/:testId/edit" element={<EditTestPage />} />
            <Route path="/tests/:testId/questions" element={<TestQuestionsPage />} />
            <Route path="/tests/:testId/take" element={<TakeTestPage />} />
            <Route path="/tests/:testId/result" element={<TestResultPage />} />
            <Route path="/assignments/:assignmentId" element={<AssignmentDetailPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:threadId" element={<MessagesPage />} />
            <Route path="/grades" element={<StudentGradesPage />} />
            <Route path="/courses/:courseId/forum" element={<CourseForumPage />} />
            <Route path="/forum/topics/:topicId" element={<ForumTopicPage />} />
            <Route path="/courses/:courseId/gradebook" element={<TeacherGradebookPage />} />

            {/* Backward-compatible aliases for old server-side URLs */}
            <Route path="/legacy/*" element={<LegacyFramePage />} />
            <Route path="/lms/admin-dashboard/" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/lms/admin/teachers/create/" element={<Navigate to="/admin/teachers/create" replace />} />
            <Route path="/lms/admin/students/create/" element={<Navigate to="/admin/students/create" replace />} />
            <Route path="/lms/teacher/manage_courses/" element={<Navigate to="/courses/manage" replace />} />
            <Route path="/lms/teacher/course/:courseId/" element={<RedirectCourseDetail />} />
            <Route path="/lms/student/course/:courseId/" element={<RedirectCourseDetail />} />
            <Route path="/lms/teacher/edit_course/:courseId/" element={<RedirectCourseManage />} />
            <Route path="/lms/teacher/course/:courseId/gradebook/" element={<RedirectCourseGradebook />} />
            <Route path="/lms/student/grades/" element={<Navigate to="/grades" replace />} />
            <Route path="/lms/teacher/tests/" element={<Navigate to="/tests" replace />} />
            <Route path="/lms/student/tests/" element={<Navigate to="/tests" replace />} />
            <Route path="/lms/teacher/edit_test/:testId/" element={<RedirectTestEdit />} />
            <Route path="/lms/student/take_test/:testId/" element={<RedirectTestTake />} />
            <Route path="/lms/student/view_test_result/:testId/" element={<RedirectTestResult />} />
            <Route path="/lms/notifications/" element={<Navigate to="/notifications" replace />} />
          </Route>
        </Route>
        {/* Unknown routes: send to root. ProtectedRoute will push unauth users to /login. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

