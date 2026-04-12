import { useCallback } from 'react';
import { useEditor } from '../context';

export function useUndoRedo() {
  const { state, dispatch } = useEditor();

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [dispatch]);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [dispatch]);

  return {
    undo,
    redo,
    canUndo: state.undoStack.length > 0,
    canRedo: state.redoStack.length > 0,
  };
}
