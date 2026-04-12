import { useEffect, useRef, useCallback } from 'react';
import { useEditor } from '../context';
import { serializeDocx } from '../serializer/docx-serializer';

interface AutosaveOptions {
  onSave: (blob: Blob) => Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
}

export function useAutosave({ onSave, debounceMs = 5000, enabled = true }: AutosaveOptions) {
  const { state, dispatch } = useEditor();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  const doSave = useCallback(async () => {
    if (!state.document || savingRef.current || !state.dirty) return;
    savingRef.current = true;
    dispatch({ type: 'MARK_SAVING' });
    try {
      const blob = await serializeDocx(state.document);
      await onSave(blob);
      dispatch({ type: 'MARK_SAVED' });
    } catch (err) {
      console.error('Autosave failed:', err);
    } finally {
      savingRef.current = false;
    }
  }, [state.document, state.dirty, onSave, dispatch]);

  useEffect(() => {
    if (!enabled || !state.dirty) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doSave, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state.dirty, enabled, debounceMs, doSave]);

  // beforeunload warning
  useEffect(() => {
    if (!state.dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state.dirty]);

  return { save: doSave, saving: state.saving, lastSaved: state.lastSaved };
}
