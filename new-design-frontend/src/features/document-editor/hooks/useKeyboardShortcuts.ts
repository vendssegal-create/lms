import { useEffect } from 'react';
import { useEditor } from '../context';

interface ShortcutOptions {
  onSave?: () => void;
}

export function useKeyboardShortcuts({ onSave }: ShortcutOptions = {}) {
  const { dispatch } = useEditor();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      switch (e.key.toLowerCase()) {
        case 'z':
          e.preventDefault();
          if (e.shiftKey) {
            dispatch({ type: 'REDO' });
          } else {
            dispatch({ type: 'UNDO' });
          }
          break;
        case 'y':
          e.preventDefault();
          dispatch({ type: 'REDO' });
          break;
        case 's':
          e.preventDefault();
          onSave?.();
          break;
        case 'b':
          e.preventDefault();
          dispatch({ type: 'FORMAT_SELECTION', format: { bold: true } });
          break;
        case 'i':
          e.preventDefault();
          dispatch({ type: 'FORMAT_SELECTION', format: { italic: true } });
          break;
        case 'u':
          e.preventDefault();
          dispatch({ type: 'FORMAT_SELECTION', format: { underline: true } });
          break;
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch, onSave]);
}
