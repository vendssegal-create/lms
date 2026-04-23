export interface AvailableRole {
  value: string;
  label: string;
}

export interface NavigationItem {
  key?: string;
  label: string;
  path: string;
  icon?: string;
  section?: string;
  order_index?: number;
}

export interface SessionUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  primary_role: string;
  primary_role_label: string;
  active_role: string;
  active_role_label: string;
  available_roles: AvailableRole[];
  avatar_url?: string | null;
  phone?: string;
  quick_chat?: QuickChatPreferences;
  /** RET_REGISTRATOR: biriktirilgan fakultetlar (bo'sh = hali tayinlanmagan) */
  retake_assigned_faculties?: string[] | null;
}

export interface QuickChatPreferences {
  side: 'left' | 'right';
  offset_y: number;
  is_collapsed: boolean;
}

export interface AuthSession {
  authenticated: boolean;
  user: SessionUser | null;
  active_role: string | null;
  available_roles: AvailableRole[];
  navigation: NavigationItem[];
  notifications: {
    unread_count: number;
  };
  messages: {
    unread_count: number;
  };
  urls: {
    login?: string;
    hemis_login?: string;
    dashboard?: string;
    profile?: string;
    logout?: string;
    switch_role_base?: string;
  };
}

export interface AdminDashboardResponse {
  totals: {
    users: number;
    courses: number;
    teachers: number;
    students: number;
  };
  retake_stats: {
    total_apps: number;
    pending_finance: number;
    approved_retakes: number;
    completed_retakes: number;
  };
  recent_users: Array<{
    id: number;
    username: string;
    full_name: string;
    role: string;
    role_label: string;
    date_joined: string | null;
  }>;
  recent_courses: Array<{
    id: number;
    title: string;
    created_at: string | null;
    is_active: boolean;
    sections_count: number;
    teacher: {
      id: number;
      full_name: string;
      username: string;
    };
    spa_path: string;
  }>;
}

export interface AdminCreateUserResponse {
  success: boolean;
  user_id: number;
  redirect_path: string;
}

export interface SidebarRoleOption {
  value: string;
  label: string;
}

export interface SidebarSectionOption {
  value: string;
  label: string;
}

export interface SidebarAccessRule {
  order_index: number;
  is_visible: boolean;
}

export interface SidebarManagementMenu {
  id?: number;
  key: string;
  label: string;
  section: string;
  icon_lucide: string;
  spa_path: string;
  url_name: string;
  external_url: string;
  is_enabled: boolean;
  description: string;
  access: Record<string, SidebarAccessRule>;
}

export interface SidebarManagementResponse {
  roles: SidebarRoleOption[];
  sections: SidebarSectionOption[];
  menus: SidebarManagementMenu[];
}

export interface SidebarManagementSaveResponse {
  success: boolean;
  data: SidebarManagementResponse;
  session: AuthSession;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface ApiError {
  error: string;
}

export interface DashboardStat {
  label: string;
  value: number | string;
  subtitle: string;
}

export interface DashboardCourseItem {
  id: number;
  title: string;
  description: string;
  is_active: boolean;
  deadline: string | null;
  spa_path?: string;
  detail_url: string;
  student_count?: number;
  test_count?: number;
  assignment_count?: number;
  section_count?: number;
  progress_percentage?: number;
  completed_sections?: number;
  tests_count?: number;
  assignments_count?: number;
  sections_count?: number;
}

export interface DashboardTestItem {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  control_type: string;
  control_type_label: string;
  start_datetime: string | null;
  end_datetime: string | null;
  duration_minutes: number;
  max_score: number;
  attempts_allowed: number;
  attempts_done: number;
  attempts_left: number;
  is_random_order?: boolean;
  max_tab_switches?: number;
  question_count: number;
  proctoring_enabled: boolean;
  face_id_required: boolean;
  status: string;
  status_label: string;
  last_score: number | null;
  has_active_attempt: boolean;
  spa_take_path: string;
  spa_result_path: string;
  spa_edit_path?: string;
  take_url: string;
  result_url: string;
  edit_url: string;
  course: {
    id: number;
    title: string;
  };
  section: {
    id: number | null;
    name: string;
  } | null;
}

export interface DashboardAttemptItem {
  id: number;
  student_name: string;
  score: number;
  correct_count: number;
  finished_at: string | null;
  test: {
    id: number;
    name: string;
    max_score: number;
    course_title: string;
  };
}

export interface DashboardResponse {
  role: string;
  role_label: string;
  hero: {
    kicker: string;
    title: string;
    subtitle: string;
  };
  stats: DashboardStat[];
  courses: DashboardCourseItem[];
  upcoming_tests: DashboardTestItem[];
  recent_attempts: DashboardAttemptItem[];
  pending_retake_groups?: Array<{
    id: number;
    subject_name: string;
    cycle_name: string;
    course_title: string;
  }>;
  permissions?: {
    can_manage_courses?: boolean;
    can_manage_enrollments?: boolean;
    can_view_students?: boolean;
  };
  actions?: {
    courses_path: string;
    tests_path: string;
  };
}

export interface CoursesResponse {
  role: string;
  role_label: string;
  query: string;
  permissions: {
    can_manage_courses: boolean;
  };
  courses: Array<{
    id: number;
    title: string;
    description: string;
    is_active: boolean;
    deadline: string | null;
    image_url: string | null;
    spa_path: string;
    teacher: {
      id: number;
      full_name: string;
    };
    sections_count: number;
    tests_count: number;
    assignments_count: number;
    students_count: number;
    completed_sections: number;
    progress_percentage: number;
    detail_url: string;
  }>;
}

export interface TestsResponse {
  role: string;
  role_label: string;
  summary: Record<string, number>;
  permissions: {
    can_manage_tests: boolean;
    can_view_reporting: boolean;
  };
  tests: DashboardTestItem[];
}

export interface TeacherCourseListResponse {
  courses: Array<{ id: number; title: string }>;
}

export interface TeacherTestDetailResponse {
  test: {
    id: number;
    name: string;
    description: string;
    course_id: number;
    section_id: number | null;
    control_type: string;
    is_active: boolean;
    start_datetime: string | null;
    end_datetime: string | null;
    duration_minutes: number;
    max_score: number;
    attempts_allowed: number;
    question_count: number;
    is_random_order: boolean;
    proctoring_enabled: boolean;
    face_id_required: boolean;
    max_tab_switches: number;
  };
  course: { id: number; title: string };
  sections: Array<{ id: number; name: string }>;
  questions: Array<{
    id: number;
    text: string;
    option1: string;
    option2: string;
    option3: string;
    option4: string;
    correct_answer: string;
    score: number;
  }>;
}

export interface TeacherQuestionItem {
  id: number;
  text: string;
  option1: string;
  option2: string;
  option3: string;
  option4: string;
  correct_answer: string;
  score: number;
}

export interface TeacherTestQuestionsListResponse {
  test: {
    id: number;
    name: string;
    course_id: number;
    course_title: string;
  };
  query: string;
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_previous: boolean;
  has_next: boolean;
  items: TeacherQuestionItem[];
}

export interface ResourceViewData {
  view_count: number;
  is_completed: boolean;
  completed_at: string | null;
  time_spent_seconds: number;
}

export interface FolderFileItem {
  id: number;
  original_filename: string;
  file_url: string | null;
  file_size: number | null;
  mime_type: string;
}

export interface BookChapterItem {
  id: number;
  title: string;
  order: number;
  content?: string;
}

export interface GlossaryEntryItem {
  id: number;
  term: string;
  definition: string;
}

export type ResourceType =
  | 'file'
  | 'link'
  | 'video'
  | 'text'
  | 'audio'
  | 'embed'
  | 'h5p'
  | 'scorm'
  | 'folder'
  | 'book'
  | 'glossary'
  | 'certificate';

export interface CourseManageResource {
  id: number;
  title: string;
  description: string;
  resource_type: ResourceType;
  resource_type_label: string;
  order: number;
  is_visible: boolean;
  require_completion: boolean;
  estimated_time_minutes: number | null;
  url: string | null;
  open_in_new_tab: boolean;
  content: string | null;
  file_url: string | null;
  original_filename: string;
  file_size: number | null;
  mime_type: string;
  video_source: 'url' | 'youtube' | 'vimeo' | 'file';
  video_poster_url: string | null;
  audio_transcript: string;
  h5p_embed_code: string;
  scorm_version: string;
  scorm_entry_url: string;
  embed_width: string;
  embed_height: string;
  folder_files?: FolderFileItem[];
  chapters?: BookChapterItem[];
  glossary_entries?: GlossaryEntryItem[];
  certificate_download_url?: string | null;
  certificate_print_url?: string | null;
  certificate_check_url?: string | null;
  view_data: ResourceViewData | null;
}

export interface CourseManageSection {
  id: number;
  name: string;
  description: string;
  order: number;
  is_published: boolean;
  unlock_mode: string;
  prerequisite_section_id: number | null;
  resources: CourseManageResource[];
  tests: DashboardTestItem[];
  meetings: CourseDetailMeeting[];
  assignments: CourseDetailAssignment[];
}

export interface CourseManageEnrollment {
  id: number;
  student_id: number;
  username: string;
  full_name: string;
  group_name: string;
  student_id_number: string;
}

export type CourseManageCourse = CoursesResponse['courses'][number];

export interface CourseManageCertificateTemplate {
  id: number;
  name: string;
  institution_name?: string;
  issued_by?: string;
  position?: string;
  hours_per_course?: number | null;
  docx_file?: string | null;
}

export interface CourseManageResponse {
  course: CourseManageCourse;
  sections: CourseManageSection[];
  enrollments: CourseManageEnrollment[];
  permissions: {
    can_manage_enrollments: boolean;
    can_manage_courses?: boolean;
  };
  certificates?: {
    templates: CourseManageCertificateTemplate[];
    triggers: Array<Record<string, unknown>>;
  };
}

export interface TakeTestQuestionOption {
  value: string;
  label: string;
}

export interface TakeTestQuestion {
  id: number;
  text: string;
  options: TakeTestQuestionOption[];
  score: number;
}

export interface TakeTestAttempt {
  id: number;
  started_at: string;
  end_time: string | null;
  remaining_seconds: number | null;
  answers: Record<string, string>;
  question_order: number[];
  per_question_score: number;
  is_completed: boolean;
}

export interface TakeTestResponse {
  role: string;
  role_label: string;
  test: DashboardTestItem;
  attempt: TakeTestAttempt;
  questions: TakeTestQuestion[];
  face: {
    required: boolean;
    verified: boolean;
    image_url: string | null;
  };
  proctoring: {
    enabled: boolean;
    max_tab_switches: number;
  };
}

export interface ProfileUserInfo {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  primary_role: string;
  primary_role_label: string;
  active_role: string;
  active_role_label: string;
}

export interface ProfileResponse {
  user: ProfileUserInfo;
  roles: {
    account_role_label: string;
    active_role_label: string;
    roles_differ: boolean;
    available_roles: AvailableRole[];
  };
  student_profile: {
    student_id_number: string;
    faculty_name: string;
    group_name: string;
    specialty_name: string;
    education_form: string;
    education_type: string;
    education_lang: string;
    level: string;
    student_status: string;
    university: string;
    address: string;
    image_url: string;
  } | null;
  teacher_profile: {
    full_name: string;
    department: string;
    hemis_id: string;
    hemis_position: string;
    experience_years: number;
    avatar_url: string;
    phone: string;
  } | null;
}

export interface MessagesThreadUser {
  id: number;
  username: string;
  full_name: string;
  avatar_url: string;
}

export interface MessagesThreadMessage {
  id: number;
  thread_id: number;
  sender_id: number;
  body: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  attachment_url: string | null;
  attachment_name: string;
  attachment_size: number | null;
  attachment_mime: string;
  reply_to: {
    id: number;
    sender_id: number;
    body: string;
    attachment_name: string;
  } | null;
  is_read: boolean;
  read_at: string | null;
  reactions: Record<string, number>;
}

export type WsEvent =
  | { type: 'message.created'; message: MessagesThreadMessage }
  | { type: 'message.deleted'; message_id: number }
  | { type: 'message.reacted'; message_id: number; reactions: Record<string, number> }
  | { type: 'user.typing'; user_id: number; full_name: string; is_typing: boolean }
  | { type: 'messages.read'; reader_id: number; read_at: string }
  | { type: 'read.ok' }
  | { type: 'error'; error: string };

export interface MessagesThreadListItem {
  id: number;
  other_user: MessagesThreadUser;
  updated_at: string;
  last_message: MessagesThreadMessage | null;
  unread_count: number;
}

export interface MessagesThreadsListResponse {
  items: MessagesThreadListItem[];
  unread_total: number;
}

export interface MessagesThreadDetailResponse {
  thread: {
    id: number;
    other_user: MessagesThreadUser;
    updated_at: string;
    unread_count: number;
  };
  messages: MessagesThreadMessage[];
}

export type NotifType =
  | 'course_enrolled'
  | 'deadline_warning'
  | 'deadline_overdue'
  | 'deadline_extended'
  | 'extension_approved'
  | 'extension_rejected'
  | 'system';

export type NotifPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface LoginAlert {
  id: number;
  type: NotifType;
  priority: NotifPriority;
  title: string;
  message: string;
  link: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface ExtensionRequest {
  id: number;
  student_name: string;
  student_id: number;
  assignment_id: number;
  assignment_title: string;
  course_title: string;
  original_deadline: string | null;
  requested_deadline: string;
  approved_deadline: string | null;
  reason: string;
  admin_note: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at: string | null;
}

export interface ProfileUpdateResponse {
  success: boolean;
  profile: ProfileResponse;
  session: AuthSession;
}

export interface PasswordChangeResponse {
  success: boolean;
}

export interface CourseDetailResource {
  id: number;
  title: string;
  description: string;
  resource_type: ResourceType;
  resource_type_label: string;
  order: number;
  is_visible: boolean;
  require_completion: boolean;
  estimated_time_minutes: number | null;
  url: string | null;
  open_in_new_tab: boolean;
  content: string | null;
  file_url: string | null;
  original_filename: string;
  file_size: number | null;
  mime_type: string;
  video_source: 'url' | 'youtube' | 'vimeo' | 'file';
  video_poster_url: string | null;
  audio_transcript: string;
  h5p_embed_code: string;
  scorm_version: string;
  scorm_entry_url: string;
  embed_width: string;
  embed_height: string;
  folder_files?: FolderFileItem[];
  chapters?: BookChapterItem[];
  glossary_entries?: GlossaryEntryItem[];
  certificate_download_url?: string | null;
  certificate_print_url?: string | null;
  certificate_check_url?: string | null;
  view_data: ResourceViewData | null;
}

export interface CourseDetailMeeting {
  id: number;
  title: string;
  meeting_url: string;
  meeting_type: string;
  start_time: string | null;
  duration_minutes: number;
  section_id: number | null;
}

export interface CourseDetailAssignment {
  id: number;
  title: string;
  description: string;
  max_score: number;
  deadline: string | null;
  is_active: boolean;
  allow_late: boolean;
  section_id: number | null;
  spa_path: string;
  submit_path: string;
  latest_submission: {
    id: number;
    submitted_at: string | null;
    file_url: string | null;
    score: number | null;
    feedback: string;
    graded_at: string | null;
  } | null;
}

export interface CourseDetailSection {
  id: number;
  name: string;
  description: string;
  order: number;
  is_published: boolean;
  unlock_mode: string;
  prerequisite_section_id: number | null;
  is_completed: boolean;
  is_locked: boolean;
  resources: CourseDetailResource[];
  tests: DashboardTestItem[];
  assignments: CourseDetailAssignment[];
  meetings: CourseDetailMeeting[];
}

export interface CourseCertificateInfo {
  is_available: boolean;
  is_generated: boolean;
  /** Kurs boshqaruvchisi uchun namuna chop etish (rasmiy talaba sertifikati emas) */
  is_preview?: boolean;
  message?: string;
  url?: string;
  serial?: string | null;
  download_url?: string | null;
  /** Brauzer chop etish / qurilmada PDF saqlash (HTML sahifa) */
  print_url?: string | null;
}

export interface CourseDetailResponse {
  role: string;
  role_label: string;
  course: CoursesResponse['courses'][number] & { certificate?: CourseCertificateInfo | null };
  sections: CourseDetailSection[];
  orphans: {
    resources: CourseDetailResource[];
    tests: DashboardTestItem[];
    assignments: CourseDetailAssignment[];
    meetings: CourseDetailMeeting[];
  };
}

export interface AssignmentSubmissionItem {
  id: number;
  student_id: number;
  student_name: string;
  comment: string;
  file_url: string | null;
  submitted_at: string | null;
  score: number | null;
  feedback: string;
  graded_at: string | null;
  status: string;
}

export interface AssignmentDetailResponse {
  role: string;
  role_label: string;
  assignment: CourseDetailAssignment;
  course: {
    id: number;
    title: string;
    spa_path: string;
  };
  submissions: AssignmentSubmissionItem[];
  permissions: {
    can_grade: boolean;
  };
}

// Keep this union broad: backend roles are defined in `users.utils.roles.Role`.
// (Legacy values like ADMIN/RET_ACCOUNTANT are kept for compatibility with older mock data.)
export type UserRole =
  | 'GUEST'
  | 'SUPER_ADMIN'
  | 'TEACHER'
  | 'STUDENT'
  | 'ACADEMIC_BOARD'
  | 'DIRECTION'
  | 'REGISTRATOR'
  | 'RET_REGISTRATOR'
  | 'RET_ACCOUNTING'
  | 'RET_SUPERVISOR'
  | 'RET_DB_MANAGER'
  | 'ADMIN'
  | 'RET_ACCOUNTANT';

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  avatar_url?: string;
  phone?: string;
}

export interface Course {
  id: number;
  title: string;
  description: string;
  teacher: User;
  is_active: boolean;
  deadline?: string;
  image_url?: string;
  sections_count: number;
  students_count: number;
}

export interface Section {
  id: number;
  course_id: number;
  name: string;
  description?: string;
  is_published: boolean;
  order: number;
}

export interface Resource {
  id: number;
  section_id: number;
  title: string;
  resource_type: 'file' | 'link' | 'video' | 'text';
  url?: string;
  content?: string;
  file_url?: string;
}

export interface Test {
  id: number;
  course_id: number;
  section_id?: number;
  name: string;
  description?: string;
  start_datetime?: string;
  end_datetime?: string;
  duration_minutes: number;
  max_score: number;
  attempts: number;
  proctoring_enabled: boolean;
  face_id_required: boolean;
}

export interface RetakeApplication {
  id: number;
  student_id: number;
  cycle_id: number;
  status: 'draft' | 'in_review' | 'partially_approved' | 'approved' | 'completed' | 'rejected';
  declared_amount?: number;
  accountant_amount?: number;
  created_at: string;
  updated_at: string;
}

export interface RetakeCycleSummary {
  id: number;
  name: string;
  academic_year: string;
  status: string;
  status_label: string;
  starts_at: string | null;
  ends_at: string | null;
  max_allowed_credits: number | null;
}

export interface RetakeApplicationListItem {
  id: number;
  status: string;
  status_label: string;
  student: {
    id: number;
    full_name: string;
    student_id_number: string;
    faculty_name: string;
    group_name: string;
  };
  cycle: RetakeCycleSummary | null;
  declared_amount: number | null;
  accountant_amount: number | null;
  total_credit: number | null;
  item_count: number;
  approved_item_count: number;
  contract_attached: boolean;
  contract_url?: string | null;
  contract_original_name?: string;
  receipt_attached: boolean;
  receipt_url?: string | null;
  receipt_original_name?: string;
  can_edit?: boolean;
  can_move_to_supervisor: boolean;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RetakeApplicationDetail extends RetakeApplicationListItem {
  notes: string;
  accountant_comment: string;
  items: Array<{
    id: number;
    subject_name: string;
    subject_code: string;
    credit: number | null;
    required_control_type: string;
    status: string;
    status_label: string;
    amount: number | null;
    payment_date: string | null;
  }>;
  workflow_events: Array<{
    id: number;
    action: string;
    from_status: string;
    to_status: string;
    comment: string;
    actor_name: string;
    created_at: string;
  }>;
}

export interface RetakeApplicationsResponse {
  role: string;
  selected_cycle: RetakeCycleSummary | null;
  cycles: RetakeCycleSummary[];
  summary: {
    total: number;
    draft: number;
    in_review: number;
    partially_approved: number;
    approved: number;
    completed: number;
    returned: number;
  };
  filters: {
    statuses: Array<{ value: string; label: string }>;
    faculties: string[];
    groups: string[];
  };
  applications: RetakeApplicationListItem[];
}

export interface RetakeApplicationDetailResponse {
  application: RetakeApplicationDetail;
}

export interface RetakeStudentSearchItem {
  id: number;
  hemis_student_id?: number;
  full_name: string;
  short_name?: string;
  student_id_number: string;
  pinfl: string;
  group_name: string;
  faculty_name: string;
  specialty_name: string;
  semester_code?: string;
  semester_name: string;
  email: string;
  phone: string;
  synced_at?: string | null;
}

export interface RetakeSearchStudentsResponse {
  query: string;
  search_hemis: boolean;
  warning: string | null;
  students: RetakeStudentSearchItem[];
}

export interface RetakeStudentDebtItem {
  id: number;
  subject_name: string;
  subject_code: string;
  credit: number | null;
  semester_label: string;
  exam_type_label: string;
  control_type: string;
  debt_status: string;
  total_point: number | null;
  grade: number | null;
  required_point: number | null;
  is_active: boolean;
  status_tag: string;
}

export interface RetakeApplicationItemDocument {
  id: number;
  document_type: string;
  url: string | null;
  original_name: string;
  created_at: string;
}

export interface RetakeStudentDebtApplicationItem {
  id: number;
  subject_name: string;
  subject_code: string;
  credit: number | null;
  required_control_type: string;
  status: string;
  status_label: string;
  amount: number | null;
  payment_date: string | null;
  documents: RetakeApplicationItemDocument[];
}

export interface RetakeStudentDebtsApplication extends RetakeApplicationListItem {
  items: RetakeStudentDebtApplicationItem[];
}

export interface RetakeStudentDebtsResponse {
  student: RetakeStudentSearchItem;
  debts: RetakeStudentDebtItem[];
  open_cycles: RetakeCycleSummary[];
  selected_cycle: RetakeCycleSummary | null;
  applications: RetakeStudentDebtsApplication[];
  applied_debt_ids: number[];
  warning: string | null;
}

export interface RetakeCreateApplicationResponse {
  success: boolean;
  application: RetakeApplicationDetail;
}

export interface RetakeSyncLogItem {
  id: number;
  scope: string;
  status: string;
  status_label: string;
  started_at: string | null;
  finished_at: string | null;
  processed_count: number;
  message: string;
  summary: Record<string, unknown>;
  initiated_by: string;
}

export interface RetakeSyncPanelResponse {
  config_ok: boolean;
  has_running: boolean;
  hemis_base_url: string;
  db_stats: {
    students: number;
    teachers: number;
    curriculums: number;
    rooms: number;
  };
  last_syncs: RetakeSyncLogItem[];
}

export interface RetakeSyncTestResponse {
  success: boolean;
  results: Record<string, { ok: boolean; message: string }>;
}

export interface RetakeSyncRunResponse {
  success: boolean;
  message: string;
}

export interface RetakeTeacherGroupItem {
  id: number;
  control_type: string;
  control_type_label: string;
  scheduled_at: string | null;
  pair_label: string;
  room: string;
  status: string;
  status_label: string;
  teacher: {
    full_name: string;
  };
  group: {
    id: number;
    code: string;
    status: string;
    status_label: string;
    capacity: number;
    members_count: number;
    subject_name: string;
    subject_code: string;
    cycle_name: string;
    lms_course_title: string;
  };
  sheet: {
    id: number | null;
    sheet_no: string;
    status: string;
    status_label: string;
    entered_count: number;
    absent_count: number;
    total_count: number;
  } | null;
}

export interface RetakeTeacherGroupsResponse {
  role: string;
  summary: {
    total: number;
    open_sheets: number;
    locked_sheets: number;
    active_groups: number;
  };
  filters: {
    control_types: Array<{ value: string; label: string }>;
    group_statuses: Array<{ value: string; label: string }>;
  };
  items: RetakeTeacherGroupItem[];
}

export interface RetakeExamSheetEntry {
  id: number;
  student_snapshot_id: number;
  membership_id: number;
  full_name: string;
  student_id_number: string;
  group_name: string;
  faculty_name: string;
  score: number | null;
  is_absent: boolean;
  entered_at: string | null;
  completion: {
    completed: number;
    total: number;
    is_finished: boolean;
  };
  cross_scores: {
    jn: number;
    on: number;
  };
}

export interface RetakeExamSheetResponse {
  success?: boolean;
  warnings?: string[];
  sheet: {
    id: number;
    sheet_no: string;
    status: string;
    status_label: string;
    opened_at: string | null;
    submitted_at: string | null;
    locked_at: string | null;
    max_score: number;
    can_edit: boolean;
    can_unlock: boolean;
    config_active: boolean;
  };
  schedule: {
    id: number;
    control_type: string;
    control_type_label: string;
    scheduled_at: string | null;
    pair_number: number | null;
    pair_label: string;
    room: string;
    status: string;
    status_label: string;
  };
  group: {
    id: number;
    code: string;
    status: string;
    status_label: string;
    capacity: number;
    cycle_name: string;
    subject_name: string;
    subject_code: string;
    lms_course_title: string;
  };
  stats: {
    total: number;
    present: number;
    absent: number;
    graded: number;
    count_5: number;
    count_4: number;
    count_3: number;
    count_2: number;
  };
  entries: RetakeExamSheetEntry[];
}

export interface RetakePendingStudentItem {
  item_id: number;
  student_id: number;
  full_name: string;
  student_id_number: string;
  group_name: string;
  faculty_name: string;
  required_control_type: string;
}

export interface RetakePendingStudentsResponse {
  items: RetakePendingStudentItem[];
  total_count: number;
}

export interface RetakeAssignStudentsResponse {
  success: boolean;
  assigned_count: number;
  message: string;
}

export interface RetakeRemoveMemberResponse {
  success: boolean;
  message: string;
}

export interface RetakeCycleManageItem extends RetakeCycleSummary {
  applications_count: number;
  groups_count: number;
}

export interface RetakeCyclesResponse {
  role: string;
  permissions: {
    can_manage: boolean;
  };
  statuses: Array<{ value: string; label: string }>;
  items: RetakeCycleManageItem[];
}

export interface RetakeCycleMutationResponse {
  success: boolean;
  cycle: RetakeCycleManageItem;
}

export interface RetakeGroupManageItem {
  id: number;
  code: string;
  status: string;
  status_label: string;
  capacity: number;
  created_at: string;
  subject: {
    id: number;
    name: string;
    code: string;
  };
  cycle: {
    id: number;
    name: string;
  };
  teacher: {
    id: number | null;
    full_name: string;
  };
  members_count: number;
  assessments_count: number;
  class_schedules_count: number;
  lms_course_title: string;
}

export interface RetakeGroupsResponse {
  role: string;
  selected_cycle: RetakeCycleSummary | null;
  cycles: RetakeCycleSummary[];
  groups: RetakeGroupManageItem[];
  teachers: Array<{ id: number; full_name: string }>;
  subject_statuses: Array<{ value: string; label: string }>;
  pending_subjects: Array<{
    subject_id: number;
    subject_name: string;
    subject_code: string;
    items_count: number;
  }>;
  /** MB menejer uchun biriktirilgan fakultet nomlari */
  assigned_faculties?: string[];
  /** MB menejer uchun barcha fakultetlar rejimi */
  assigned_faculties_all?: boolean;
}

export interface RetakeGroupMutationResponse {
  success: boolean;
  group?: RetakeGroupManageItem;
}

export interface RetakeClassScheduleItem {
  id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string;
  start_date: string | null;
  end_date: string | null;
}

export interface RetakeAssessmentScheduleItem {
  id: number;
  control_type: string;
  control_type_label: string;
  scheduled_at: string | null;
  pair_number: number | null;
  pair_label: string;
  room: string;
  status: string;
  status_label: string;
  teacher_name: string;
}

export interface RetakeScheduleGroupItem extends RetakeGroupManageItem {
  class_schedules: RetakeClassScheduleItem[];
  assessments: RetakeAssessmentScheduleItem[];
}

export interface RetakeSchedulesResponse {
  role: string;
  selected_cycle: RetakeCycleSummary | null;
  cycles: RetakeCycleSummary[];
  teachers: Array<{ id: number; full_name: string }>;
  groups: RetakeScheduleGroupItem[];
  control_types: Array<{ value: string; label: string }>;
}

export interface RetakeScheduleMutationResponse {
  success: boolean;
  item?: RetakeClassScheduleItem | RetakeAssessmentScheduleItem;
}

export interface RetakeExamCalendarResponse {
  role: string;
  cycle: RetakeCycleSummary | null;
  cycles: RetakeCycleSummary[];
  year: number;
  month: number;
  month_name: string;
  month_days: number[][];
  day_assessments: Record<string, Array<{
    id: number;
    group_id: number;
    group_code: string;
    subject_name: string;
    control_type: string;
    control_type_label: string;
    scheduled_at: string;
    pair_number: number | null;
    pair_label: string;
    room: string;
    teacher_name: string;
  }>>;
  groups: Array<{ id: number; code: string; subject_name: string }>;
  teachers: Array<{ id: number; full_name: string }>;
  control_types: Array<{ value: string; label: string }>;
  pair_times: Record<string, string>;
  selected_group_id: number | null;
}

export interface RetakeExamCalendarSaveResponse {
  success: boolean;
}

export interface ResourceStatStudent {
  id: number;
  name: string;
  view_count: number;
  is_completed: boolean;
  completed_at: string | null;
  time_spent_seconds: number;
}

export interface ResourceStatsResponse {
  success: boolean;
  total_enrolled: number;
  viewed_count: number;
  completed_count: number;
  completion_rate: number;
  avg_time_seconds: number;
  students: ResourceStatStudent[];
}
