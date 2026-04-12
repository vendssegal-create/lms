import React, { useEffect, useState, useReducer } from 'react';
import { parseDocx } from '../document-editor/parser/docx-parser';
import { EditorContext, editorReducer, initialEditorState } from '../document-editor/context';
import { PageCanvas } from '../document-editor/components/PageCanvas';
import { Loader2, AlertTriangle } from 'lucide-react';

interface Props {
  data: ArrayBuffer;
}

export const DocxViewer: React.FC<Props> = ({ data }) => {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    parseDocx(data)
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

    return () => { cancelled = true; };
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-500 text-sm">Yuklanmoqda...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <EditorContext.Provider value={{ state, dispatch }}>
      <PageCanvas readOnly />
    </EditorContext.Provider>
  );
};
