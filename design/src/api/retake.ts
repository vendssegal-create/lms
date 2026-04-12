import { apiRequest, cachedApiRequest, invalidateApiCache, type RequestCacheMode } from '@/src/api/client';
import {
  RetakeApplicationDetailResponse,
  RetakeApplicationsResponse,
  RetakeCycleMutationResponse,
  RetakeCyclesResponse,
  RetakeExamSheetResponse,
  RetakeGroupMutationResponse,
  RetakeGroupsResponse,
  RetakeExamCalendarResponse,
  RetakeExamCalendarSaveResponse,
  RetakeSearchStudentsResponse,
  RetakeStudentDebtsResponse,
  RetakeCreateApplicationResponse,
  RetakeSyncPanelResponse,
  RetakeSyncTestResponse,
  RetakeSyncRunResponse,
  RetakeScheduleMutationResponse,
  RetakeSchedulesResponse,
  RetakeTeacherGroupsResponse,
} from '@/src/types';

const RETAKE_APPLICATIONS_CACHE_PREFIX = 'retake:applications:';
const RETAKE_APPLICATION_DETAIL_CACHE_PREFIX = 'retake:application-detail:';
const RETAKE_CACHE_TTL_MS = 20000;

type FetchOptions = {
  cacheMode?: RequestCacheMode;
};

export interface RetakeDashboardStatsResponse {
  stats: {
    total: number;
    stat1: number; stat1_label: string;
    stat2: number; stat2_label: string;
    stat3: number; stat3_label: string;
    stat4: number; stat4_label: string;
  };
  recent_applications: {
    id: number;
    student_name: string;
    cycle_name: string;
    status: string;
    status_label: string;
    created_at: string;
  }[];
}

export function fetchRetakeDashboardStats() {
  return apiRequest<RetakeDashboardStatsResponse>('/api/retake/dashboard-stats/');
}

export function fetchRetakeTeacherGroups(query = '') {
  const suffix = query ? `?${query}` : '';
  return apiRequest<RetakeTeacherGroupsResponse>(`/api/retake/teacher-groups/${suffix}`);
}

export function fetchRetakeExamSheet(sheetId: number) {
  return apiRequest<RetakeExamSheetResponse>(`/api/retake/exam-sheets/${sheetId}/`);
}

export function fetchRetakeCycles() {
  return apiRequest<RetakeCyclesResponse>('/api/retake/cycles/');
}

export function createRetakeCycle(payload: {
  name: string;
  academic_year: string;
  starts_at: string;
  ends_at: string;
  max_allowed_credits: string;
  status: string;
}) {
  return apiRequest<RetakeCycleMutationResponse>('/api/retake/cycles/create/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function updateRetakeCycle(cycleId: number, payload: {
  name: string;
  academic_year: string;
  starts_at: string;
  ends_at: string;
  max_allowed_credits: string;
  status: string;
}) {
  return apiRequest<RetakeCycleMutationResponse>(`/api/retake/cycles/${cycleId}/update/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function fetchRetakeGroups(query = '') {
  const suffix = query ? `?${query}` : '';
  return apiRequest<RetakeGroupsResponse>(`/api/retake/groups/${suffix}`);
}

export function createRetakeGroup(payload: {
  subject_id: number;
  code: string;
  teacher_id?: number | null;
  capacity?: number;
}) {
  return apiRequest<RetakeGroupMutationResponse>('/api/retake/groups/create/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function updateRetakeGroup(groupId: number, payload: {
  teacher_id?: number | null;
  capacity?: number;
  status: string;
}) {
  return apiRequest<RetakeGroupMutationResponse>(`/api/retake/groups/${groupId}/update/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function deleteRetakeGroup(groupId: number) {
  return apiRequest<RetakeGroupMutationResponse>(`/api/retake/groups/${groupId}/delete/`, {
    method: 'POST',
  });
}

export function fetchRetakeSchedules(query = '') {
  const suffix = query ? `?${query}` : '';
  return apiRequest<RetakeSchedulesResponse>(`/api/retake/schedules/${suffix}`);
}

export function createRetakeClassSchedule(groupId: number, payload: {
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string;
  start_date: string;
  end_date: string;
}) {
  return apiRequest<RetakeScheduleMutationResponse>(`/api/retake/groups/${groupId}/class-schedules/create/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function deleteRetakeClassSchedule(scheduleId: number) {
  return apiRequest<RetakeScheduleMutationResponse>(`/api/retake/class-schedules/${scheduleId}/delete/`, {
    method: 'POST',
  });
}

export function createRetakeAssessment(groupId: number, payload: {
  control_type: string;
  scheduled_at: string;
  pair_number?: number | null;
  room: string;
  teacher_id?: number | null;
}) {
  return apiRequest<RetakeScheduleMutationResponse>(`/api/retake/groups/${groupId}/assessments/create/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function deleteRetakeAssessment(assessmentId: number) {
  return apiRequest<RetakeScheduleMutationResponse>(`/api/retake/assessments/${assessmentId}/delete/`, {
    method: 'POST',
  });
}

export function fetchRetakeExamCalendar(query = '') {
  const suffix = query ? `?${query}` : '';
  return apiRequest<RetakeExamCalendarResponse>(`/api/retake/exam-calendar/${suffix}`);
}

export function saveRetakeExamCalendar(payload: {
  action: 'create' | 'edit' | 'delete';
  assessment_id?: number;
  group_id?: number;
  control_type?: string;
  teacher_id?: number | null;
  pair_number?: number | null;
  room?: string;
  exam_date?: string;
}) {
  return apiRequest<RetakeExamCalendarSaveResponse>('/api/retake/exam-calendar/save/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function saveRetakeExamSheet(
  sheetId: number,
  payload: {
    action: 'save' | 'submit' | 'unlock';
    entries?: Array<{ id: number; score: number | null; is_absent: boolean }>;
  },
) {
  return apiRequest<RetakeExamSheetResponse>(`/api/retake/exam-sheets/${sheetId}/save/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function fetchRetakeApplications(query = '', options: FetchOptions = {}) {
  const suffix = query ? `?${query}` : '';
  return cachedApiRequest<RetakeApplicationsResponse>(
    `${RETAKE_APPLICATIONS_CACHE_PREFIX}${query || 'default'}`,
    `/api/retake/applications/${suffix}`,
    {},
    RETAKE_CACHE_TTL_MS,
    options.cacheMode,
  );
}

export function fetchRetakeApplicationDetail(appId: number, options: FetchOptions = {}) {
  return cachedApiRequest<RetakeApplicationDetailResponse>(
    `${RETAKE_APPLICATION_DETAIL_CACHE_PREFIX}${appId}`,
    `/api/retake/applications/${appId}/`,
    {},
    RETAKE_CACHE_TTL_MS,
    options.cacheMode,
  );
}

export function updateRetakeApplication(
  appId: number,
  payload: {
    action: 'save' | 'submit_to_accounting';
    declared_amount?: string;
    notes?: string;
    contract_file?: File;
    receipt_file?: File;
  },
) {
  const formData = new FormData();
  formData.set('action', payload.action);
  if (payload.declared_amount !== undefined) formData.set('declared_amount', payload.declared_amount);
  if (payload.notes !== undefined) formData.set('notes', payload.notes);
  if (payload.contract_file) formData.set('contract_file', payload.contract_file);
  if (payload.receipt_file) formData.set('receipt_file', payload.receipt_file);

  return apiRequest<any>(`/api/retake/applications/${appId}/update/`, {
    method: 'POST',
    body: formData,
  });
}

export function submitAccountingAction(appId: number, payload: { action: 'approve' | 'reject'; comment?: string; accountant_amount?: string; }) {
  const formData = new URLSearchParams();
  formData.set('action', payload.action);
  if (payload.comment) {
    formData.set('comment', payload.comment);
  }
  if (payload.accountant_amount) {
    formData.set('accountant_amount', payload.accountant_amount);
  }

  return apiRequest<RetakeApplicationDetailResponse>(`/api/retake/applications/${appId}/accounting-action/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: formData.toString(),
  }).then((response) => {
    invalidateRetakeApplicationsCache(appId);
    return response;
  });
}

export function submitSupervisorAction(appId: number, payload: { action: 'approve' | 'reject'; comment?: string; }) {
  const formData = new URLSearchParams();
  formData.set('action', payload.action);
  if (payload.comment) {
    formData.set('comment', payload.comment);
  }

  return apiRequest<RetakeApplicationDetailResponse>(`/api/retake/applications/${appId}/supervisor-action/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: formData.toString(),
  }).then((response) => {
    invalidateRetakeApplicationsCache(appId);
    return response;
  });
}

export function fetchRetakeSearchStudents(query = '') {
  const suffix = query ? `?${query}` : '';
  return apiRequest<RetakeSearchStudentsResponse>(`/api/retake/search-student/${suffix}`);
}

export function fetchRetakeStudentDebts(studentId: number, query = '') {
  const suffix = query ? `?${query}` : '';
  return apiRequest<RetakeStudentDebtsResponse>(`/api/retake/students/${studentId}/debts/${suffix}`);
}

export function createRetakeApplication(studentId: number, payload: { cycle_id: number; debt_ids: number[] }) {
  return apiRequest<RetakeCreateApplicationResponse>(`/api/retake/students/${studentId}/create-application/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function fetchRetakeSyncPanel() {
  return apiRequest<RetakeSyncPanelResponse>('/api/retake/sync/');
}

export function testRetakeSyncConnection() {
  return apiRequest<RetakeSyncTestResponse>('/api/retake/sync/test/', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
  });
}

export function runRetakeSync(scope: string) {
  return apiRequest<RetakeSyncRunResponse>('/api/retake/sync/run/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ scope }),
  });
}

export function invalidateRetakeApplicationsCache(appId?: number) {
  invalidateApiCache(RETAKE_APPLICATIONS_CACHE_PREFIX);
  if (appId) {
    invalidateApiCache(`${RETAKE_APPLICATION_DETAIL_CACHE_PREFIX}${appId}`);
    return;
  }
  invalidateApiCache(RETAKE_APPLICATION_DETAIL_CACHE_PREFIX);
}

export async function prefetchRetakeOverview(query = '') {
  const response = await fetchRetakeApplications(query);
  const firstId = response.applications[0]?.id;
  if (firstId) {
    void fetchRetakeApplicationDetail(firstId);
  }
  return response;
}

export function prefetchRetakeApplicationDetail(appId: number) {
  return fetchRetakeApplicationDetail(appId);
}

// ─── Subject Group Detail API ────────────────────────────────────

export async function fetchSubjectGroupDetail(groupId: number) {
  return apiRequest<any>(`/api/retake/subject-groups/${groupId}/`);
}

export async function fetchGroupStudentGroups(groupId: number) {
  return apiRequest<any>(`/api/retake/subject-groups/${groupId}/student-groups/`);
}

export async function createRetakeAssessmentForGroup(
  groupId: number,
  payload: {
    student_group_name: string;
    control_type: string;
    scheduled_at: string;
    room?: string;
    pair_number?: number;
    teacher_id?: number;
  },
) {
  return apiRequest<any>(`/api/retake/subject-groups/${groupId}/assessments/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function batchCreateAssessments(
  groupId: number,
  payload: {
    control_type: string;
    schedules: Array<{
      student_group_name: string;
      scheduled_at: string;
      room?: string;
      pair_number?: number;
      teacher_id?: number;
    }>;
  },
) {
  return apiRequest<any>(`/api/retake/subject-groups/${groupId}/assessments/batch/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ─── Teacher Enrollment API ──────────────────────────────────────

export async function fetchTeacherEnrollment(groupId: number) {
  return apiRequest<any>(`/api/retake/groups/${groupId}/enrollment/`);
}

export async function submitTeacherEnrollment(
  groupId: number,
  payload: { action: 'create_course' | 'enroll'; hemis_groups?: string[] },
) {
  return apiRequest<any>(`/api/retake/groups/${groupId}/enrollment/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}
