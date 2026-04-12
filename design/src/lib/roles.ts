import type { UserRole } from '@/src/types';

export const ROLE = {
  GUEST: 'GUEST',
  SUPER_ADMIN: 'SUPER_ADMIN',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
  ACADEMIC_BOARD: 'ACADEMIC_BOARD',
  DIRECTION: 'DIRECTION',
  REGISTRATOR: 'REGISTRATOR',
  RET_REGISTRATOR: 'RET_REGISTRATOR',
  RET_ACCOUNTING: 'RET_ACCOUNTING',
  RET_SUPERVISOR: 'RET_SUPERVISOR',
  RET_DB_MANAGER: 'RET_DB_MANAGER',
} as const satisfies Record<string, UserRole>;

export const COURSE_ACCESS_ROLES: UserRole[] = [
  ROLE.SUPER_ADMIN,
  ROLE.TEACHER,
  ROLE.ACADEMIC_BOARD,
  ROLE.DIRECTION,
  ROLE.REGISTRATOR,
  ROLE.STUDENT,
];

export const RETAKE_ACCESS_ROLES: UserRole[] = [
  ROLE.SUPER_ADMIN,
  ROLE.RET_REGISTRATOR,
  ROLE.RET_ACCOUNTING,
  ROLE.RET_SUPERVISOR,
  ROLE.RET_DB_MANAGER,
  ROLE.STUDENT,
];

export const TEST_ACCESS_ROLES: UserRole[] = [
  ROLE.STUDENT,
  ROLE.TEACHER,
  ROLE.SUPER_ADMIN,
];

export function hasRole(role: string | null | undefined, allowedRoles: readonly string[]) {
  return Boolean(role && allowedRoles.includes(role));
}

export function isSuperAdmin(role: string | null | undefined) {
  return role === ROLE.SUPER_ADMIN;
}

export function canAccountingReview(role: string | null | undefined) {
  return hasRole(role, [ROLE.RET_ACCOUNTING, ROLE.SUPER_ADMIN]);
}

export function canSupervisorReview(role: string | null | undefined) {
  return hasRole(role, [ROLE.RET_SUPERVISOR, ROLE.SUPER_ADMIN]);
}
