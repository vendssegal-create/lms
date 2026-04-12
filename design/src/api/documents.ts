import { apiRequest } from './client';

const BASE = '/api/lms';

export async function loadTemplateDocx(templateId: number): Promise<ArrayBuffer> {
  const res = await fetch(`${BASE}/teacher/certificate-template/${templateId}/docx/load/`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Fayl yuklanmadi (${res.status})`);
  }
  return res.arrayBuffer();
}

export async function saveTemplateDocx(
  templateId: number,
  docxBlob: Blob
): Promise<{ success: boolean; version_id: number }> {
  const csrfToken = getCsrf();
  const fd = new FormData();
  fd.append('docx_file', docxBlob, 'certificate_template.docx');

  const res = await fetch(`${BASE}/teacher/certificate-template/${templateId}/docx/save/`, {
    method: 'POST',
    credentials: 'include',
    headers: csrfToken ? { 'X-CSRFToken': csrfToken } : {},
    body: fd,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Saqlashda xatolik (${res.status})`);
  }
  return res.json();
}

export async function listTemplateVersions(
  templateId: number
): Promise<TemplateVersion[]> {
  return apiRequest<TemplateVersion[]>(
    `${BASE}/teacher/certificate-template/${templateId}/versions/`
  );
}

export async function restoreTemplateVersion(
  templateId: number,
  versionId: number
): Promise<void> {
  const csrfToken = getCsrf();
  const res = await fetch(
    `${BASE}/teacher/certificate-template/${templateId}/versions/${versionId}/restore/`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
        'Content-Type': 'application/json',
      },
    }
  );
  if (!res.ok) throw new Error('Versiya tiklashda xatolik');
}

export async function loadResourceFile(resourceId: number): Promise<ArrayBuffer> {
  const res = await fetch(`${BASE}/resources/${resourceId}/file/load/`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`Fayl yuklanmadi (${res.status})`);
  }
  return res.arrayBuffer();
}

export interface TemplateVersion {
  id: number;
  version_number: number;
  created_by_name: string;
  created_at: string;
  note: string;
}

function getCsrf(): string | null {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match?.[1] ?? null;
}
