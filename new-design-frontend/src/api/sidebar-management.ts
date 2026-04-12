import { jsonRequest, apiRequest } from '@/src/api/client';
import { SidebarManagementResponse, SidebarManagementSaveResponse, SidebarManagementMenu } from '@/src/types';

export function fetchSidebarManagement() {
  return apiRequest<SidebarManagementResponse>('/api/auth/sidebar-management/');
}

export function saveSidebarManagement(menus: SidebarManagementMenu[]) {
  return jsonRequest<SidebarManagementSaveResponse>('/api/auth/sidebar-management/save/', 'POST', {
    menus,
  });
}
