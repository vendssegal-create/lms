import { useReducer, useCallback } from 'react';
import { editorReducer, initialEditorState } from '../context';
import type { DocxDocument, EditorState, EditorAction } from '../types';

export function useEditorState(templateId: number | null) {
  const [state, dispatch] = useReducer(editorReducer, {
    ...initialEditorState,
    templateId,
  });

  const loadDocument = useCallback(
    (doc: DocxDocument) => {
      dispatch({ type: 'SET_DOCUMENT', payload: doc });
    },
    [dispatch]
  );

  return { state, dispatch, loadDocument };
}
