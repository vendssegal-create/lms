/**
 * Legacy Django (__legacy/*) → SPA marshrutlari.
 * Middleware /__legacy/... ni /legacy/... ga yuboradi; shu yerda mos SPA sahifaga yo‘naltiramiz.
 * Ro‘yxatda yo‘q bo‘lsa — router.tsx dagi /legacy/* → LegacyFramePage (iframe).
 */
import { Fragment } from 'react';
import { Navigate, Route, useParams } from 'react-router-dom';

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

function RedirectRetakeApplication() {
  const { appId } = useParams();
  return <Navigate to={`/retake/applications?app_id=${appId || ''}`} replace />;
}

function RedirectRetakeStudentDebts() {
  const { studentId } = useParams();
  return <Navigate to={`/retake/students/${studentId || ''}/debts`} replace />;
}

/** Legacy «yangi ariza» — SPA da qarzlar sahifasidan davom etadi */
function RedirectRetakeCreateApplication() {
  const { studentId } = useParams();
  return <Navigate to={`/retake/students/${studentId || ''}/debts`} replace />;
}

function RedirectTeacherCourseStudents() {
  const { courseId } = useParams();
  return <Navigate to={`/courses/${courseId || ''}/manage`} replace />;
}

function RedirectTeacherAssignStudent() {
  const { courseId } = useParams();
  return <Navigate to={`/courses/${courseId || ''}/manage`} replace />;
}

function RedirectRetakeExamSheet() {
  const { sheetId } = useParams();
  return <Navigate to={`/retake/exam-sheets/${sheetId || ''}`} replace />;
}

function RedirectRetakeGroupDetail() {
  const { groupId } = useParams();
  return <Navigate to={`/retake/groups/${groupId || ''}`} replace />;
}

function RedirectCourseForum() {
  const { courseId } = useParams();
  return <Navigate to={`/courses/${courseId || ''}/forum`} replace />;
}

function RedirectForumTopic() {
  const { topicId } = useParams();
  return <Navigate to={`/forum/topics/${topicId || ''}`} replace />;
}

function RedirectTeacherAssignment() {
  const { assignmentId } = useParams();
  return <Navigate to={`/assignments/${assignmentId || ''}`} replace />;
}

function RedirectStudentAssignment() {
  const { assignmentId } = useParams();
  return <Navigate to={`/assignments/${assignmentId || ''}`} replace />;
}

function RedirectAddQuestions() {
  const { testId } = useParams();
  return <Navigate to={`/tests/${testId || ''}/questions`} replace />;
}

/** To‘liq mos keladigan yo‘llar (Navigate). Trailing slash ikkalasi ham qo‘shilgan. */
const LEGACY_EXACT_REDIRECTS: [string, string][] = [
  // users ( __legacy/ )
  ['/legacy/', '/login'],
  ['/legacy/login/', '/login'],
  ['/legacy/login', '/login'],
  ['/legacy/accounts/login/', '/login'],
  ['/legacy/accounts/login', '/login'],
  ['/legacy/profile/', '/profile'],
  ['/legacy/profile', '/profile'],
  ['/legacy/change-password/', '/profile'],
  ['/legacy/change-password', '/profile'],

  // lms — dashboardlar (yagona SPA bosh sahifa)
  ['/legacy/lms/portal/', '/'],
  ['/legacy/lms/portal', '/'],
  ['/legacy/lms/teacher/', '/'],
  ['/legacy/lms/teacher', '/'],
  ['/legacy/lms/student/', '/'],
  ['/legacy/lms/student', '/'],
  ['/legacy/lms/academic-board/', '/'],
  ['/legacy/lms/academic-board', '/'],
  ['/legacy/lms/direction/', '/'],
  ['/legacy/lms/direction', '/'],
  ['/legacy/lms/registrator/', '/'],
  ['/legacy/lms/registrator', '/'],

  ['/legacy/lms/admin-dashboard/', '/admin/dashboard'],
  ['/legacy/lms/admin-dashboard', '/admin/dashboard'],
  ['/legacy/lms/admin/teachers/create/', '/admin/teachers/create'],
  ['/legacy/lms/admin/teachers/create', '/admin/teachers/create'],
  ['/legacy/lms/admin/students/create/', '/admin/students/create'],
  ['/legacy/lms/admin/students/create', '/admin/students/create'],

  ['/legacy/lms/teacher/create_course/', '/courses/manage'],
  ['/legacy/lms/teacher/create_course', '/courses/manage'],
  ['/legacy/lms/teacher/manage_courses/', '/courses/manage'],
  ['/legacy/lms/teacher/manage_courses', '/courses/manage'],

  ['/legacy/lms/teacher/tests/', '/tests'],
  ['/legacy/lms/teacher/tests', '/tests'],
  ['/legacy/lms/teacher/create_test/', '/tests/manage'],
  ['/legacy/lms/teacher/create_test', '/tests/manage'],
  ['/legacy/lms/student/tests/', '/tests'],
  ['/legacy/lms/student/tests', '/tests'],

  ['/legacy/lms/student/grades/', '/grades'],
  ['/legacy/lms/student/grades', '/grades'],
  ['/legacy/lms/notifications/', '/notifications'],
  ['/legacy/lms/notifications', '/notifications'],

  ['/legacy/lms/api/proctor-log/', '/tests'],
  ['/legacy/lms/api/proctor-log', '/tests'],

  // retake
  ['/legacy/retake/dashboard/', '/retake/dashboard'],
  ['/legacy/retake/dashboard', '/retake/dashboard'],
  ['/legacy/retake/sync/', '/retake/sync'],
  ['/legacy/retake/sync', '/retake/sync'],
  ['/legacy/retake/sync/test-connection/', '/retake/sync'],
  ['/legacy/retake/sync/test-connection', '/retake/sync'],
  ['/legacy/retake/sync/run/', '/retake/sync'],
  ['/legacy/retake/sync/run', '/retake/sync'],
  ['/legacy/retake/search-student/', '/retake/search-student'],
  ['/legacy/retake/search-student', '/retake/search-student'],
  ['/legacy/retake/applications/', '/retake/applications'],
  ['/legacy/retake/applications', '/retake/applications'],
  ['/legacy/retake/db-manager/groups/', '/retake/groups'],
  ['/legacy/retake/db-manager/groups', '/retake/groups'],
  ['/legacy/retake/db-manager/students/assign/', '/retake/groups'],
  ['/legacy/retake/db-manager/students/assign', '/retake/groups'],
  ['/legacy/retake/db-manager/schedules/', '/retake/schedules'],
  ['/legacy/retake/db-manager/schedules', '/retake/schedules'],
  ['/legacy/retake/db-manager/exam-calendar/', '/retake/exam-calendar'],
  ['/legacy/retake/db-manager/exam-calendar', '/retake/exam-calendar'],
  ['/legacy/retake/teacher/groups/', '/retake/teacher/groups'],
  ['/legacy/retake/teacher/groups', '/retake/teacher/groups'],
  ['/legacy/retake/cycles/', '/retake/cycles'],
  ['/legacy/retake/cycles', '/retake/cycles'],
];

/**
 * IMPORTANT: React Router <Routes> ichida custom component render qilib bo‘lmaydi.
 * Shuning uchun redirect routelarini komponent emas, JSX fragment sifatida export qilamiz.
 */
export const legacySpaRedirectRoutes = (
  <>
    {LEGACY_EXACT_REDIRECTS.map(([from, to]) => (
      <Fragment key={`${from}->${to}`}>
        <Route path={from} element={<Navigate to={to} replace />} />
      </Fragment>
    ))}

    {/* Old /lms/... (bookmark) — routerda allaqachon bor; /legacy/lms/ uchun dinamik */}
    <Route path="/legacy/lms/teacher/course/:courseId" element={<RedirectCourseDetail />} />
    <Route path="/legacy/lms/student/course/:courseId" element={<RedirectCourseDetail />} />
    <Route path="/legacy/lms/teacher/edit_course/:courseId" element={<RedirectCourseManage />} />
    <Route path="/legacy/lms/teacher/course/:courseId/gradebook" element={<RedirectCourseGradebook />} />
    <Route path="/legacy/lms/teacher/course/:courseId/gradebook/" element={<RedirectCourseGradebook />} />
    <Route path="/legacy/lms/teacher/course/:courseId/students" element={<RedirectTeacherCourseStudents />} />
    <Route path="/legacy/lms/teacher/course/:courseId/students/" element={<RedirectTeacherCourseStudents />} />
    <Route path="/legacy/lms/teacher/assign_student/:courseId" element={<RedirectTeacherAssignStudent />} />
    <Route path="/legacy/lms/teacher/assign_student/:courseId/" element={<RedirectTeacherAssignStudent />} />
    <Route path="/legacy/lms/teacher/edit_test/:testId" element={<RedirectTestEdit />} />
    <Route path="/legacy/lms/student/take_test/:testId" element={<RedirectTestTake />} />
    <Route path="/legacy/lms/student/view_test_result/:testId" element={<RedirectTestResult />} />

    <Route path="/legacy/lms/course/:courseId/forum" element={<RedirectCourseForum />} />
    <Route path="/legacy/lms/course/:courseId/forum/" element={<RedirectCourseForum />} />
    <Route path="/legacy/lms/forum/topic/:topicId" element={<RedirectForumTopic />} />
    <Route path="/legacy/lms/forum/topic/:topicId/" element={<RedirectForumTopic />} />

    <Route path="/legacy/lms/teacher/assignment/:assignmentId" element={<RedirectTeacherAssignment />} />
    <Route path="/legacy/lms/teacher/assignment/:assignmentId/" element={<RedirectTeacherAssignment />} />
    <Route path="/legacy/lms/student/submit_assignment/:assignmentId" element={<RedirectStudentAssignment />} />
    <Route path="/legacy/lms/student/submit_assignment/:assignmentId/" element={<RedirectStudentAssignment />} />

    <Route path="/legacy/lms/teacher/add_questions/:testId" element={<RedirectAddQuestions />} />
    <Route path="/legacy/lms/teacher/add_questions/:testId/" element={<RedirectAddQuestions />} />

    <Route path="/legacy/retake/application/:appId" element={<RedirectRetakeApplication />} />
    <Route path="/legacy/retake/application/:appId/" element={<RedirectRetakeApplication />} />
    <Route path="/legacy/retake/student-debts/:studentId" element={<RedirectRetakeStudentDebts />} />
    <Route path="/legacy/retake/student-debts/:studentId/" element={<RedirectRetakeStudentDebts />} />
    <Route path="/legacy/retake/create-application/:studentId" element={<RedirectRetakeCreateApplication />} />
    <Route path="/legacy/retake/create-application/:studentId/" element={<RedirectRetakeCreateApplication />} />
    <Route path="/legacy/retake/db-manager/group/:groupId" element={<RedirectRetakeGroupDetail />} />
    <Route path="/legacy/retake/db-manager/group/:groupId/" element={<RedirectRetakeGroupDetail />} />
    <Route path="/legacy/retake/teacher/exam-sheet/:sheetId" element={<RedirectRetakeExamSheet />} />
    <Route path="/legacy/retake/teacher/exam-sheet/:sheetId/" element={<RedirectRetakeExamSheet />} />
  </>
);
