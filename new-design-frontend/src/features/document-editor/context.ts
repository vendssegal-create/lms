import React, { createContext, useContext } from 'react';
import type {
  DocxDocument,
  DocxParagraph,
  DocxRun,
  DocxTable,
  DocxBodyElement,
  DocxPageBreak,
  EditorState,
  EditorAction,
  EditorSelection,
  PageSetup,
} from './types';

export const initialEditorState: EditorState = {
  document: null,
  selection: null,
  undoStack: [],
  redoStack: [],
  dirty: false,
  saving: false,
  lastSaved: null,
  templateId: null,
};

const MAX_UNDO = 50;

function cloneDoc(doc: DocxDocument): DocxDocument {
  return {
    ...doc,
    body: JSON.parse(JSON.stringify(doc.body)),
    pageSetup: { ...doc.pageSetup, margins: { ...doc.pageSetup.margins } },
    // media & unknownParts are shared (immutable blobs / bytes)
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_DOCUMENT':
      return {
        ...state,
        document: action.payload,
        undoStack: [],
        redoStack: [],
        dirty: false,
        selection: null,
      };

    case 'SET_SELECTION':
      return { ...state, selection: action.selection };

    case 'UPDATE_PARAGRAPH': {
      if (!state.document) return state;
      const prev = cloneDoc(state.document);
      const newBody = state.document.body.map((el) => {
        if (el.type === 'paragraph' && el.id === action.id) {
          return { ...el, runs: action.runs };
        }
        if (el.type === 'table') {
          return updateTableParagraphs(el, action.id, action.runs);
        }
        return el;
      });
      return pushUndo(state, prev, { ...state.document, body: newBody });
    }

    case 'FORMAT_SELECTION': {
      if (!state.document || !state.selection) return state;
      const prev = cloneDoc(state.document);
      const newBody = state.document.body.map((el) => {
        if (el.type === 'paragraph' && el.id === state.selection!.paragraphId) {
          return {
            ...el,
            runs: el.runs.map((r) => ({ ...r, ...action.format })),
          };
        }
        return el;
      });
      return pushUndo(state, prev, { ...state.document, body: newBody });
    }

    case 'INSERT_TABLE': {
      if (!state.document) return state;
      const prev = cloneDoc(state.document);
      const newTable: DocxTable = {
        type: 'table',
        id: `tbl_${Date.now()}`,
        rows: Array.from({ length: action.rows }, () => ({
          cells: Array.from({ length: action.cols }, () => ({
            paragraphs: [{ type: 'paragraph' as const, id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, runs: [{ type: 'text' as const, text: '' }] }],
          })),
        })),
      };
      const idx = state.document.body.findIndex((el) => el.id === action.afterId);
      const newBody = [...state.document.body];
      newBody.splice(idx + 1, 0, newTable);
      return pushUndo(state, prev, { ...state.document, body: newBody });
    }

    case 'INSERT_IMAGE': {
      if (!state.document) return state;
      const prev = cloneDoc(state.document);
      const imgPara: DocxParagraph = {
        type: 'paragraph',
        id: `p_img_${Date.now()}`,
        runs: [{
          type: 'image',
          imageId: action.imageId,
          imageWidth: action.width,
          imageHeight: action.height,
        }],
      };
      const newMedia = new Map(state.document.media);
      newMedia.set(action.imageId, action.blob);
      const idx = state.document.body.findIndex((el) => el.id === action.afterId);
      const newBody = [...state.document.body];
      newBody.splice(idx + 1, 0, imgPara);
      return pushUndo(state, prev, { ...state.document, body: newBody, media: newMedia });
    }

    case 'INSERT_PLACEHOLDER': {
      if (!state.document) return state;
      const prev = cloneDoc(state.document);
      const newBody = state.document.body.map((el) => {
        if (el.type === 'paragraph' && el.id === action.paragraphId) {
          const newRuns = [...el.runs];
          newRuns.splice(action.offset, 0, {
            type: 'placeholder',
            placeholderName: action.name,
            text: `{{ ${action.name} }}`,
          });
          return { ...el, runs: newRuns };
        }
        return el;
      });
      return pushUndo(state, prev, { ...state.document, body: newBody });
    }

    case 'INSERT_PAGE_BREAK': {
      if (!state.document) return state;
      const prev = cloneDoc(state.document);
      const pb: DocxPageBreak = { type: 'pageBreak', id: `pb_${Date.now()}` };
      const idx = state.document.body.findIndex((el) => el.id === action.afterId);
      const newBody = [...state.document.body];
      newBody.splice(idx + 1, 0, pb);
      return pushUndo(state, prev, { ...state.document, body: newBody });
    }

    case 'UPDATE_TABLE_CELL': {
      if (!state.document) return state;
      const prev = cloneDoc(state.document);
      const newBody = state.document.body.map((el) => {
        if (el.type === 'table' && el.id === action.tableId) {
          const newRows = el.rows.map((r, ri) => {
            if (ri !== action.row) return r;
            return {
              ...r,
              cells: r.cells.map((c, ci) => {
                if (ci !== action.col) return c;
                return { ...c, paragraphs: action.paragraphs };
              }),
            };
          });
          return { ...el, rows: newRows };
        }
        return el;
      });
      return pushUndo(state, prev, { ...state.document, body: newBody });
    }

    case 'ADD_TABLE_ROW': {
      if (!state.document) return state;
      const prev = cloneDoc(state.document);
      const newBody = state.document.body.map((el) => {
        if (el.type === 'table' && el.id === action.tableId) {
          const colCount = el.rows[0]?.cells.length ?? 1;
          const newRow = {
            cells: Array.from({ length: colCount }, () => ({
              paragraphs: [{ type: 'paragraph' as const, id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, runs: [{ type: 'text' as const, text: '' }] }],
            })),
          };
          const newRows = [...el.rows];
          const afterIdx = action.afterRow ?? el.rows.length - 1;
          newRows.splice(afterIdx + 1, 0, newRow);
          return { ...el, rows: newRows };
        }
        return el;
      });
      return pushUndo(state, prev, { ...state.document, body: newBody });
    }

    case 'ADD_TABLE_COLUMN': {
      if (!state.document) return state;
      const prev = cloneDoc(state.document);
      const newBody = state.document.body.map((el) => {
        if (el.type === 'table' && el.id === action.tableId) {
          const afterIdx = action.afterCol ?? (el.rows[0]?.cells.length ?? 1) - 1;
          const newRows = el.rows.map((r) => {
            const newCells = [...r.cells];
            newCells.splice(afterIdx + 1, 0, {
              paragraphs: [{ type: 'paragraph' as const, id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, runs: [{ type: 'text' as const, text: '' }] }],
            });
            return { ...r, cells: newCells };
          });
          const newColWidths = el.colWidths ? [...el.colWidths] : undefined;
          if (newColWidths) newColWidths.splice(afterIdx + 1, 0, newColWidths[afterIdx] ?? 2000);
          return { ...el, rows: newRows, colWidths: newColWidths };
        }
        return el;
      });
      return pushUndo(state, prev, { ...state.document, body: newBody });
    }

    case 'DELETE_TABLE_ROW': {
      if (!state.document) return state;
      const prev = cloneDoc(state.document);
      const newBody = state.document.body.map((el) => {
        if (el.type === 'table' && el.id === action.tableId && el.rows.length > 1) {
          return { ...el, rows: el.rows.filter((_, i) => i !== action.rowIndex) };
        }
        return el;
      });
      return pushUndo(state, prev, { ...state.document, body: newBody });
    }

    case 'DELETE_TABLE_COLUMN': {
      if (!state.document) return state;
      const prev = cloneDoc(state.document);
      const newBody = state.document.body.map((el) => {
        if (el.type === 'table' && el.id === action.tableId) {
          const newRows = el.rows.map((r) => ({
            ...r,
            cells: r.cells.filter((_, i) => i !== action.colIndex),
          }));
          const newColWidths = el.colWidths?.filter((_, i) => i !== action.colIndex);
          return { ...el, rows: newRows, colWidths: newColWidths };
        }
        return el;
      });
      return pushUndo(state, prev, { ...state.document, body: newBody });
    }

    case 'RESIZE_IMAGE': {
      if (!state.document) return state;
      const prev = cloneDoc(state.document);
      const newBody = state.document.body.map((el) => {
        if (el.type === 'paragraph') {
          return {
            ...el,
            runs: el.runs.map((r) =>
              r.type === 'image' && r.imageId === action.imageId
                ? { ...r, imageWidth: action.width, imageHeight: action.height }
                : r
            ),
          };
        }
        return el;
      });
      return pushUndo(state, prev, { ...state.document, body: newBody });
    }

    case 'UPDATE_PAGE_SETUP': {
      if (!state.document) return state;
      const prev = cloneDoc(state.document);
      const newSetup = {
        ...state.document.pageSetup,
        ...action.setup,
        margins: { ...state.document.pageSetup.margins, ...action.setup.margins },
      };
      return pushUndo(state, prev, { ...state.document, pageSetup: newSetup });
    }

    case 'DELETE_ELEMENT': {
      if (!state.document) return state;
      const prev = cloneDoc(state.document);
      const newBody = state.document.body.filter((el) => el.id !== action.id);
      return pushUndo(state, prev, { ...state.document, body: newBody });
    }

    case 'UNDO': {
      if (state.undoStack.length === 0 || !state.document) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      return {
        ...state,
        document: prev,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, state.document].slice(-MAX_UNDO),
        dirty: true,
      };
    }

    case 'REDO': {
      if (state.redoStack.length === 0 || !state.document) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      return {
        ...state,
        document: next,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, state.document].slice(-MAX_UNDO),
        dirty: true,
      };
    }

    case 'MARK_SAVED':
      return { ...state, dirty: false, saving: false, lastSaved: new Date() };

    case 'MARK_SAVING':
      return { ...state, saving: true };

    default:
      return state;
  }
}

function pushUndo(state: EditorState, prev: DocxDocument, newDoc: DocxDocument): EditorState {
  return {
    ...state,
    document: { ...state.document!, ...newDoc },
    undoStack: [...state.undoStack, prev].slice(-MAX_UNDO),
    redoStack: [],
    dirty: true,
  };
}

function updateTableParagraphs(table: DocxTable, paraId: string, runs: DocxRun[]): DocxTable {
  return {
    ...table,
    rows: table.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => ({
        ...cell,
        paragraphs: cell.paragraphs.map((p) =>
          p.id === paraId ? { ...p, runs } : p
        ),
      })),
    })),
  };
}

// Context
interface EditorContextValue {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

export const EditorContext = createContext<EditorContextValue>({
  state: initialEditorState,
  dispatch: () => {},
});

export function useEditor() {
  return useContext(EditorContext);
}
