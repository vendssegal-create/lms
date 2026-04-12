import React, { useReducer, useCallback, useEffect, useState } from 'react';
import { EditorContext, editorReducer, initialEditorState } from '../context';
import { parseDocx } from '../parser/docx-parser';
import { serializeDocx } from '../serializer/docx-serializer';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useAutosave } from '../hooks/useAutosave';
import { Toolbar } from './Toolbar';
import { PageCanvas } from './PageCanvas';
import { InspectorPanel } from './InspectorPanel';
import { Loader2, AlertTriangle } from 'lucide-react';

interface Props {
  templateId: number;
  loadDocxBytes: () => Promise<ArrayBuffer>;
  saveDocxBlob: (blob: Blob) => Promise<void>;
}

export const EditorShell: React.FC<Props> = ({ templateId, loadDocxBytes, saveDocxBlob }) => {
  const [state, dispatch] = useReducer(editorReducer, {
    ...initialEditorState,
    templateId,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loadDocxBytes()
      .then((bytes) => parseDocx(bytes))
      .then((doc) => {
        if (!cancelled) {
          dispatch({ type: 'SET_DOCUMENT', payload: doc });
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || 'Faylni ochishda xatolik');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadDocxBytes]);

  return (
    <EditorContext.Provider value={{ state, dispatch }}>
      <EditorShellInner
        loading={loading}
        error={error}
        onSave={saveDocxBlob}
      />
    </EditorContext.Provider>
  );
};

const EditorShellInner: React.FC<{
  loading: boolean;
  error: string | null;
  onSave: (blob: Blob) => Promise<void>;
}> = ({ loading, error, onSave }) => {
  const { state } = React.useContext(EditorContext);

  const handleSaveBlob = useCallback(
    async (blob: Blob) => {
      await onSave(blob);
    },
    [onSave]
  );

  const { save, saving, lastSaved } = useAutosave({
    onSave: handleSaveBlob,
    enabled: !loading && !error,
  });

  useKeyboardShortcuts({ onSave: save });

  const handleDownload = useCallback(async () => {
    if (!state.document) return;
    const blob = await serializeDocx(state.document);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'certificate_template.docx';
    a.click();
    URL.revokeObjectURL(url);
  }, [state.document]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-gray-500">Hujjat yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-800 mb-1">Xatolik</h3>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            Qayta yuklash
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <Toolbar onSave={save} onDownload={handleDownload} saving={saving} />
      <div className="flex-1 flex overflow-hidden">
        <PageCanvas />
        <InspectorPanel />
      </div>
      <StatusBar saving={saving} dirty={state.dirty} lastSaved={lastSaved} />
    </div>
  );
};

const StatusBar: React.FC<{
  saving: boolean;
  dirty: boolean;
  lastSaved: Date | null;
}> = ({ saving, dirty, lastSaved }) => (
  <div className="flex items-center gap-3 px-4 py-1.5 bg-white border-t border-gray-200 text-xs text-gray-500">
    <div className="flex items-center gap-1.5">
      <span
        className={`w-2 h-2 rounded-full ${
          saving ? 'bg-yellow-400 animate-pulse' : dirty ? 'bg-orange-400' : 'bg-green-400'
        }`}
      />
      {saving ? 'Saqlanmoqda...' : dirty ? 'Saqlanmagan' : 'Saqlangan'}
    </div>
    {lastSaved && (
      <span>
        Oxirgi: {lastSaved.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
      </span>
    )}
  </div>
);
