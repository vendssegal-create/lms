import { apiRequest } from '@/src/api/client';
import { AdminCreateUserResponse, AdminDashboardResponse, AssignmentDetailResponse, AssignmentSubmissionItem, CourseDetailResponse, CoursesResponse, DashboardResponse, ExtensionRequest, LoginAlert, TestsResponse, TakeTestResponse } from '@/src/types';
import { TeacherCourseListResponse, TeacherTestDetailResponse } from '@/src/types';
import { CourseManageResponse } from '@/src/types';
import { BookChapterItem, FolderFileItem, GlossaryEntryItem, TeacherQuestionItem, TeacherTestQuestionsListResponse } from '@/src/types';

export function fetchDashboard() {
  return apiRequest<DashboardResponse>('/api/lms/dashboard/');
}

export function fetchAdminDashboard() {
  return apiRequest<AdminDashboardResponse>('/api/lms/admin/dashboard/');
}

export function createAdminTeacher(payload: {
  username: string;
  password: string;
  full_name: string;
  email: string;
  phone: string;
  department: string;
}) {
  return apiRequest<AdminCreateUserResponse>('/api/lms/admin/teachers/create/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function createAdminStudent(payload: {
  username: string;
  password: string;
  full_name: string;
  student_id_number: string;
  university: string;
  faculty_name: string;
  group_name: string;
}) {
  return apiRequest<AdminCreateUserResponse>('/api/lms/admin/students/create/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function fetchCourses(query = '') {
  const suffix = query ? `?q=${encodeURIComponent(query)}` : '';
  return apiRequest<CoursesResponse>(`/api/lms/courses/${suffix}`);
}

export function fetchTests() {
  return apiRequest<TestsResponse>('/api/lms/tests/');
}

export function fetchCourseDetail(courseId: number) {
  return apiRequest<CourseDetailResponse>(`/api/lms/courses/${courseId}/`);
}

export function submitAssignment(assignmentId: number, payload: FormData) {
  return apiRequest<{ success: boolean }>('/api/lms/assignments/' + assignmentId + '/submit/', {
    method: 'POST',
    body: payload,
  });
}

export function fetchAssignmentDetail(assignmentId: number) {
  return apiRequest<AssignmentDetailResponse>(`/api/lms/assignments/${assignmentId}/`);
}

export function gradeSubmission(submissionId: number, payload: URLSearchParams) {
  return apiRequest<{ success: boolean; submission: AssignmentSubmissionItem }>('/api/lms/submissions/' + submissionId + '/grade/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: payload.toString(),
  });
}

export function fetchTakeTest(testId: number) {
  return apiRequest<TakeTestResponse>(`/api/lms/tests/${testId}/take/`);
}

export function verifyFace(testId: number) {
  return apiRequest<{ success: boolean }>(`/api/lms/tests/${testId}/face-verify/`, {
    method: 'POST',
  });
}

export function submitTest(testId: number, payload: { answers: Record<string, string> }) {
  return apiRequest<{ success: boolean; result: { score: number; max_score: number; correct_count: number; total_questions: number }; redirect_url: string }>(
    `/api/lms/tests/${testId}/submit/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );
}

export function sendProctorLog(payload: { attempt_id: number; event_type: string; details?: Record<string, unknown> }) {
  return apiRequest<{ success: boolean; auto_submit: boolean; violations: number }>(`/api/lms/proctor-log/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function fetchTestResult(testId: number) {
  return apiRequest<{
    role: string;
    role_label: string;
    test: import('@/src/types').DashboardTestItem;
    attempt: { id: number; score: number; max_score: number; correct_count: number; total_questions: number; finished_at: string | null };
    items: Array<{
      number: number;
      question_id: number;
      question_text: string;
      user_answer: string;
      user_answer_text: string;
      correct_answer: string;
      correct_answer_text: string;
      is_correct: boolean;
    }>;
  }>(`/api/lms/tests/${testId}/result/`);
}

export function fetchTeacherCourses() {
  return apiRequest<TeacherCourseListResponse>('/api/lms/teacher/courses/');
}

export function fetchNotifications(page = 1, pageSize = 20) {
  const qs = new URLSearchParams();
  qs.set('page', String(page));
  qs.set('page_size', String(pageSize));
  return apiRequest<{
    page: number;
    page_size: number;
    total: number;
    unread_count: number;
    items: Array<{ id: number; title: string; message: string; link: string; is_read: boolean; created_at: string }>;
  }>(`/api/lms/notifications/?${qs.toString()}`);
}

export function markNotificationRead(id: number) {
  return apiRequest<{ success: boolean; unread_count: number }>(`/api/lms/notifications/${id}/read/`, { method: 'POST' });
}

export function markNotificationsReadAll() {
  return apiRequest<{ success: boolean; unread_count: number }>(`/api/lms/notifications/read-all/`, { method: 'POST' });
}

export function fetchLoginAlerts(): Promise<{ alerts: LoginAlert[]; count: number }> {
  return apiRequest<{ alerts: LoginAlert[]; count: number }>(`/api/lms/login-alerts/`);
}

export function createExtensionRequest(
  assignmentId: number,
  payload: { reason: string; requested_deadline: string },
): Promise<{ success: boolean; request_id: number }> {
  return apiRequest<{ success: boolean; request_id: number }>(`/api/lms/assignments/${assignmentId}/extension-request/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function fetchExtensionRequests(status = 'pending'): Promise<ExtensionRequest[]> {
  return apiRequest<{ requests: ExtensionRequest[] }>(`/api/lms/admin/extension-requests/?status=${encodeURIComponent(status)}`)
    .then((d) => d.requests);
}

export function reviewExtensionRequest(
  requestId: number,
  payload: { action: 'approve' | 'reject'; admin_note?: string; new_deadline?: string },
): Promise<{ success: boolean; status: string }> {
  return apiRequest<{ success: boolean; status: string }>(`/api/lms/admin/extension-requests/${requestId}/review/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function fetchForumTopics(courseId: number) {
  return apiRequest<{ course: { id: number; title: string; spa_path: string }; topics: Array<{ id: number; title: string; content: string; author_name: string; created_at: string; spa_path: string }> }>(
    `/api/lms/courses/${courseId}/forum/topics/`,
  );
}

export function createForumTopic(courseId: number, payload: { title: string; content: string; section_id?: number | null }) {
  return apiRequest<{ success: boolean; topic_id: number; spa_path: string }>(`/api/lms/courses/${courseId}/forum/topics/create/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function fetchForumTopic(topicId: number) {
  return apiRequest<{
    topic: { id: number; title: string; content: string; author_name: string; created_at: string; course: { id: number; title: string; spa_path: string } };
    replies: Array<{ id: number; content: string; author_name: string; created_at: string }>;
  }>(`/api/lms/forum/topics/${topicId}/`);
}

export function replyForumTopic(topicId: number, payload: { content: string }) {
  return apiRequest<{ success: boolean; reply: { id: number; content: string; author_name: string; created_at: string } }>(`/api/lms/forum/topics/${topicId}/reply/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function fetchStudentGrades() {
  return apiRequest<{ lms: Array<{ course: { id: number; title: string; spa_path: string }; gradebook: { current_max: number; midterm_max: number; final_max: number } | null; entry: { current: number | null; midterm: number | null; final: number | null; total: number | null; updated_at: string | null } | null }>; retake: Array<{ subject_name: string; control_type: string; score: number; is_absent: boolean; status: string; date: string | null }> }>(
    `/api/lms/student/grades/`,
  );
}

export function fetchTeacherGradebook(courseId: number) {
  return apiRequest<{
    course: { id: number; title: string; spa_path: string };
    gradebook: { current_max: number; midterm_max: number; final_max: number; is_locked: boolean };
    students: Array<{ student_id: number; student_name: string; student_id_number: string; entry_id: number | null; current: number | null; midterm: number | null; final: number | null; total: number | null }>;
    tests: Array<{ id: number; name: string; control_type: string; max_score: number }>;
  }>(`/api/lms/teacher/courses/${courseId}/gradebook/`);
}

export function saveTeacherGradebook(courseId: number, payload: { items: Array<{ student_id: number; current: number | null; midterm: number | null; final: number | null }> }) {
  return apiRequest<{ success: boolean }>(`/api/lms/teacher/courses/${courseId}/gradebook/save/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function setupTeacherGradebook(courseId: number, payload: { current_max: number; midterm_max: number; final_max: number }) {
  return apiRequest<{ success: boolean }>(`/api/lms/teacher/courses/${courseId}/gradebook/setup/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function importTeacherGradebookTest(courseId: number, testId: number) {
  return apiRequest<{ success: boolean; imported: number }>(`/api/lms/teacher/courses/${courseId}/gradebook/import-test/${testId}/`, { method: 'POST' });
}

export function createMeeting(courseId: number, payload: { title: string; meeting_url: string; meeting_type: string; start_time: string; duration_minutes: number; section_id?: number | null }) {
  return apiRequest<{ success: boolean; meeting: any }>(`/api/lms/courses/${courseId}/meetings/create/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deleteMeeting(meetingId: number) {
  return apiRequest<{ success: boolean }>(`/api/lms/meetings/${meetingId}/delete/`, { method: 'POST' });
}

export function createCourse(payload: { title: string; description: string; deadline?: string; is_active: boolean }) {
  return apiRequest<{ success: boolean; course_id: number; manage_path: string }>(`/api/lms/teacher/courses/create/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function fetchCourseManage(courseId: number) {
  return apiRequest<CourseManageResponse>(`/api/lms/teacher/courses/${courseId}/manage/`);
}

export function updateCourse(courseId: number, payload: FormData | Record<string, unknown>) {
  if (payload instanceof FormData) {
    return apiRequest<{ success: boolean }>(`/api/lms/teacher/courses/${courseId}/update/`, {
      method: 'POST',
      body: payload,
    });
  }
  return apiRequest<{ success: boolean }>(`/api/lms/teacher/courses/${courseId}/update/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deleteCourse(courseId: number) {
  return apiRequest<{ success: boolean }>(`/api/lms/teacher/courses/${courseId}/delete/`, { method: 'POST' });
}

export function createSection(courseId: number, payload: Record<string, unknown>) {
  return apiRequest<{ success: boolean; section: any }>(`/api/lms/teacher/courses/${courseId}/sections/create/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function updateSection(sectionId: number, payload: Record<string, unknown>) {
  return apiRequest<{ success: boolean; section: any }>(`/api/lms/teacher/sections/${sectionId}/update/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deleteSection(sectionId: number) {
  return apiRequest<{ success: boolean }>(`/api/lms/teacher/sections/${sectionId}/delete/`, { method: 'POST' });
}

export function reorderSections(courseId: number, order: number[]) {
  return apiRequest<{ success: boolean }>(`/api/lms/teacher/courses/${courseId}/sections/reorder/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ order }),
  });
}

export function createResource(sectionId: number, payload: FormData | Record<string, unknown>) {
  if (payload instanceof FormData) {
    return apiRequest<{ success: boolean; resource: any }>(`/api/lms/teacher/sections/${sectionId}/resources/create/`, {
      method: 'POST',
      body: payload,
    });
  }
  return apiRequest<{ success: boolean; resource: any }>(`/api/lms/teacher/sections/${sectionId}/resources/create/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function renameResource(resourceId: number, title: string) {
  return apiRequest<{ success: boolean; resource: any }>(`/api/lms/teacher/resources/${resourceId}/rename/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ title }),
  });
}

export function updateResource(resourceId: number, payload: Record<string, unknown>) {
  return apiRequest<{ success: boolean; resource: any }>(`/api/lms/teacher/resources/${resourceId}/update/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function replaceResourceFile(resourceId: number, file: File) {
  const fd = new FormData();
  fd.set('file', file);
  return apiRequest<{ success: boolean; resource: any }>(`/api/lms/teacher/resources/${resourceId}/replace-file/`, {
    method: 'POST',
    body: fd,
  });
}

export function deleteResource(resourceId: number) {
  return apiRequest<{ success: boolean }>(`/api/lms/teacher/resources/${resourceId}/delete/`, { method: 'POST' });
}

export function reorderResources(sectionId: number, order: number[]) {
  return apiRequest<{ success: boolean }>(`/api/lms/teacher/sections/${sectionId}/resources/reorder/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ order }),
  });
}

export function markResourceViewed(resourceId: number) {
  return apiRequest<{ success: boolean; view_count: number }>(`/api/lms/resources/${resourceId}/viewed/`, {
    method: 'POST',
  });
}

export function markResourceCompleted(resourceId: number, payload: { time_spent_seconds: number }) {
  return apiRequest<{ success: boolean; completed_at: string | null }>(`/api/lms/resources/${resourceId}/complete/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function fetchResourceStats(resourceId: number) {
  return apiRequest<{
    success: boolean;
    total_enrolled: number;
    viewed_count: number;
    completed_count: number;
    completion_rate: number;
    avg_time_seconds: number;
    students: Array<{
      id: number;
      name: string;
      view_count: number;
      is_completed: boolean;
      completed_at: string | null;
      time_spent_seconds: number;
    }>;
  }>(`/api/lms/teacher/resources/${resourceId}/stats/`);
}

export function fetchBookChapter(resourceId: number, chapterId: number) {
  return apiRequest<BookChapterItem>(`/api/lms/resources/${resourceId}/chapters/${chapterId}/`);
}

export function saveBookChapter(resourceId: number, payload: { id?: number; title: string; content: string }) {
  return apiRequest<{ success: boolean; chapter: BookChapterItem }>(`/api/lms/teacher/resources/${resourceId}/chapters/save/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deleteBookChapter(resourceId: number, chapterId: number) {
  return apiRequest<{ success: boolean }>(`/api/lms/teacher/resources/${resourceId}/chapters/${chapterId}/delete/`, {
    method: 'POST',
  });
}

export function saveGlossaryEntry(resourceId: number, payload: { id?: number; term: string; definition: string }) {
  return apiRequest<{ success: boolean; entry: GlossaryEntryItem }>(`/api/lms/teacher/resources/${resourceId}/glossary/save/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deleteGlossaryEntry(resourceId: number, entryId: number) {
  return apiRequest<{ success: boolean }>(`/api/lms/teacher/resources/${resourceId}/glossary/${entryId}/delete/`, {
    method: 'POST',
  });
}

export function uploadFolderFile(resourceId: number, file: File) {
  const fd = new FormData();
  fd.set('file', file);
  return apiRequest<{ success: boolean; file: FolderFileItem }>(`/api/lms/teacher/resources/${resourceId}/folder/upload/`, {
    method: 'POST',
    body: fd,
  });
}

export function deleteFolderFile(resourceId: number, fileId: number) {
  return apiRequest<{ success: boolean }>(`/api/lms/teacher/resources/${resourceId}/folder/${fileId}/delete/`, {
    method: 'POST',
  });
}

export function addEnrollment(courseId: number, payload: { username?: string; student_id_number?: string }) {
  return apiRequest<{ success: boolean; enrollment: any }>(`/api/lms/teacher/courses/${courseId}/enrollments/add/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function searchEnrollments(courseId: number, query: string, group = '') {
  const qs = new URLSearchParams();
  if (query) qs.set('q', query);
  if (group) qs.set('group', group);
  return apiRequest<{ items: Array<{ id: number; username: string; full_name: string; group_name: string; student_id_number: string }> }>(
    `/api/lms/teacher/courses/${courseId}/enrollments/search/?${qs.toString()}`,
  );
}

export function createAssignment(courseId: number, payload: Record<string, unknown>) {
  return apiRequest<{ success: boolean; assignment: any }>(`/api/lms/teacher/courses/${courseId}/assignments/create/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function updateAssignment(assignmentId: number, payload: Record<string, unknown>) {
  return apiRequest<{ success: boolean; assignment: any }>(`/api/lms/teacher/assignments/${assignmentId}/update/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deleteAssignment(assignmentId: number) {
  return apiRequest<{ success: boolean }>(`/api/lms/teacher/assignments/${assignmentId}/delete/`, { method: 'POST' });
}

export function deleteEnrollment(enrollmentId: number) {
  return apiRequest<{ success: boolean }>(`/api/lms/teacher/enrollments/${enrollmentId}/delete/`, { method: 'POST' });
}

export function createTeacherTest(payload: Record<string, unknown>) {
  return apiRequest<{ success: boolean; test_id: number; edit_path: string }>('/api/lms/teacher/tests/create/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function fetchTeacherTestDetail(testId: number) {
  return apiRequest<TeacherTestDetailResponse>(`/api/lms/teacher/tests/${testId}/`);
}

export function updateTeacherTest(testId: number, payload: Record<string, unknown>) {
  return apiRequest<{ success: boolean }>(`/api/lms/teacher/tests/${testId}/update/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deleteTeacherTest(testId: number) {
  return apiRequest<{ success: boolean }>(`/api/lms/teacher/tests/${testId}/delete/`, {
    method: 'POST',
  });
}

export function addTeacherQuestions(testId: number, payload: Record<string, unknown>) {
  return apiRequest<{ success: boolean; created: TeacherQuestionItem[] }>(`/api/lms/teacher/tests/${testId}/questions/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function fetchTeacherTestQuestions(testId: number, page = 1, pageSize = 20, query = '') {
  const qs = new URLSearchParams();
  qs.set('page', String(page));
  qs.set('page_size', String(pageSize));
  if (query.trim()) {
    qs.set('q', query.trim());
  }
  return apiRequest<TeacherTestQuestionsListResponse>(`/api/lms/teacher/tests/${testId}/questions/list/?${qs.toString()}`);
}

export function updateTeacherQuestion(questionId: number, payload: Partial<TeacherQuestionItem>) {
  return apiRequest<{ success: boolean; question: TeacherQuestionItem }>(`/api/lms/teacher/questions/${questionId}/update/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deleteTeacherQuestion(questionId: number) {
  return apiRequest<{ success: boolean }>(`/api/lms/teacher/questions/${questionId}/delete/`, {
    method: 'POST',
  });
}

export type CertificateTemplateSavePayload = {
  id?: number;
  name: string;
  institution_name?: string;
  issued_by?: string;
  position?: string;
  hours_per_course?: number | null;
  /** Yangi yoki almashtirish uchun DOCX fayl */
  docx_file?: File | null;
};

export function saveCertificateTemplate(courseId: number, payload: CertificateTemplateSavePayload) {
  const url = `/api/lms/teacher/courses/${courseId}/certificate/template/save/`;
  if (payload.docx_file instanceof File) {
    const fd = new FormData();
    if (payload.id != null) fd.set('id', String(payload.id));
    fd.set('name', payload.name);
    fd.set('institution_name', payload.institution_name ?? '');
    fd.set('issued_by', payload.issued_by ?? '');
    fd.set('position', payload.position ?? '');
    if (payload.hours_per_course != null && payload.hours_per_course !== undefined) {
      fd.set('hours_per_course', String(payload.hours_per_course));
    }
    fd.set('docx_file', payload.docx_file);
    return apiRequest<{ success: boolean; template: Record<string, unknown> }>(url, {
      method: 'POST',
      body: fd,
    });
  }
  return apiRequest<{ success: boolean; template: Record<string, unknown> }>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      id: payload.id,
      name: payload.name,
      institution_name: payload.institution_name ?? '',
      issued_by: payload.issued_by ?? '',
      position: payload.position ?? '',
      hours_per_course: payload.hours_per_course,
    }),
  });
}

export function saveCertificateTrigger(courseId: number, payload: { id?: number; template_id: number; trigger_type: string; target_section_id?: number | null; target_test_id?: number | null; min_score_percentage?: number | null }) {
  return apiRequest<{ success: boolean; trigger: any }>(`/api/lms/teacher/courses/${courseId}/certificate/trigger/save/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deleteCertificateTrigger(courseId: number, triggerId: number) {
  return apiRequest<{ success: boolean }>(`/api/lms/teacher/courses/${courseId}/certificate/trigger/${triggerId}/delete/`, { method: 'POST' });
}

/** Sertifikat: ?format=pdf|docx, regen=1 (standart: docx — serverda LO/Word talab qilinmaydi) */
export async function downloadCertificate(
  courseId: number,
  format: 'pdf' | 'docx' = 'docx',
  regen = false,
): Promise<void> {
  const params = new URLSearchParams({ format });
  if (regen) params.set('regen', '1');

  const res = await fetch(
    `/api/lms/courses/${courseId}/certificate/download/?${params.toString()}`,
    { method: 'GET', credentials: 'include' },
  );

  if (!res.ok) {
    let errMsg = 'Yuklab olishda xatolik';
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) errMsg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(errMsg);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ext = format === 'docx' ? 'docx' : 'pdf';
  a.href = url;
  a.download = `sertifikat_kurs_${courseId}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}
