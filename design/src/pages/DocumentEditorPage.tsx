import React, { useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { EditorShell } from '../features/document-editor/components/EditorShell';
import { loadTemplateDocx, saveTemplateDocx } from '../api/documents';
import { useAuth } from '../features/auth/auth-context';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

export default function DocumentEditorPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const tid = Number(templateId);

  const loadBytes = useCallback(() => loadTemplateDocx(tid), [tid]);

  const saveBlob = useCallback(
    async (blob: Blob) => {
      await saveTemplateDocx(tid, blob);
    },
    [tid]
  );

  if (!tid || isNaN(tid)) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        Noto'g'ri shablon ID
      </div>
    );
  }

  const activeRole = session?.user?.active_role ?? '';
  const canEdit = ['SUPER_ADMIN', 'ADMIN', 'TEACHER'].includes(activeRole);
  if (!canEdit) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3">
        <ShieldAlert className="w-12 h-12 text-red-400" />
        <h2 className="text-lg font-medium text-gray-700">Ruxsat berilmagan</h2>
        <p className="text-sm text-gray-500">Faqat o'qituvchi va adminlar shablon tahrirlay oladi.</p>
        <button onClick={() => navigate(-1)} className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          Orqaga
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
          title="Orqaga"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-sm font-medium text-gray-700">
          Sertifikat shablon editori
        </h1>
      </div>
      <div className="flex-1">
        <EditorShell
          templateId={tid}
          loadDocxBytes={loadBytes}
          saveDocxBlob={saveBlob}
        />
      </div>
    </div>
  );
}
