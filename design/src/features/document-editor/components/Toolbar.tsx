import React, { useState, useRef, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo2,
  Redo2,
  Save,
  Download,
  Table,
  Image as ImageIcon,
  FileDown,
  Type,
} from 'lucide-react';
import { useEditor } from '../context';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { PlaceholderManager } from './PlaceholderManager';

interface Props {
  onSave: () => void;
  onDownload: () => void;
  saving?: boolean;
}

export const Toolbar: React.FC<Props> = ({ onSave, onDownload, saving }) => {
  const { state, dispatch } = useEditor();
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const format = useCallback(
    (fmt: Record<string, boolean>) => {
      dispatch({ type: 'FORMAT_SELECTION', format: fmt });
    },
    [dispatch]
  );

  const setAlignment = useCallback(
    (alignment: 'left' | 'center' | 'right' | 'justify') => {
      if (!state.document || !state.selection) return;
      const para = state.document.body.find(
        (el) => el.type === 'paragraph' && el.id === state.selection!.paragraphId
      );
      if (para && para.type === 'paragraph') {
        dispatch({
          type: 'UPDATE_PARAGRAPH',
          id: para.id,
          runs: para.runs,
        });
      }
    },
    [state, dispatch]
  );

  const insertTable = useCallback(() => {
    const currentId = state.selection?.paragraphId ?? state.document?.body[state.document.body.length - 1]?.id ?? '';
    dispatch({ type: 'INSERT_TABLE', afterId: currentId, rows: 3, cols: 3 });
  }, [state, dispatch]);

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !state.document) return;
      const imageId = `media/image_${Date.now()}.${file.name.split('.').pop()}`;
      const currentId = state.selection?.paragraphId ?? state.document.body[state.document.body.length - 1]?.id ?? '';
      dispatch({
        type: 'INSERT_IMAGE',
        afterId: currentId,
        blob: file,
        width: 5000000,
        height: 3500000,
        imageId,
      });
      e.target.value = '';
    },
    [state, dispatch]
  );

  const insertPageBreak = useCallback(() => {
    const currentId = state.selection?.paragraphId ?? state.document?.body[state.document.body.length - 1]?.id ?? '';
    dispatch({ type: 'INSERT_PAGE_BREAK', afterId: currentId });
  }, [state, dispatch]);

  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-white border-b border-gray-200 flex-wrap">
      {/* Format */}
      <ToolBtn icon={<Bold size={16} />} title="Qalin (Ctrl+B)" onClick={() => format({ bold: true })} />
      <ToolBtn icon={<Italic size={16} />} title="Kursiv (Ctrl+I)" onClick={() => format({ italic: true })} />
      <ToolBtn icon={<Underline size={16} />} title="Tagiga chiziq (Ctrl+U)" onClick={() => format({ underline: true })} />

      <Separator />

      <ToolBtn icon={<AlignLeft size={16} />} title="Chapga" onClick={() => setAlignment('left')} />
      <ToolBtn icon={<AlignCenter size={16} />} title="Markazga" onClick={() => setAlignment('center')} />
      <ToolBtn icon={<AlignRight size={16} />} title="O'ngga" onClick={() => setAlignment('right')} />
      <ToolBtn icon={<AlignJustify size={16} />} title="Kengligi bo'ylab" onClick={() => setAlignment('justify')} />

      <Separator />

      <ToolBtn icon={<Table size={16} />} title="Jadval qo'shish" onClick={insertTable} />
      <ToolBtn
        icon={<ImageIcon size={16} />}
        title="Rasm qo'shish"
        onClick={() => fileInputRef.current?.click()}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />
      <ToolBtn icon={<FileDown size={16} />} title="Sahifa uzilishi" onClick={insertPageBreak} />

      <div className="relative">
        <ToolBtn
          icon={<Type size={16} />}
          title="Placeholder qo'shish"
          onClick={() => setShowPlaceholders(!showPlaceholders)}
          active={showPlaceholders}
        />
        {showPlaceholders && <PlaceholderManager onClose={() => setShowPlaceholders(false)} />}
      </div>

      <Separator />

      <ToolBtn icon={<Undo2 size={16} />} title="Ortga (Ctrl+Z)" onClick={undo} disabled={!canUndo} />
      <ToolBtn icon={<Redo2 size={16} />} title="Oldinga (Ctrl+Y)" onClick={redo} disabled={!canRedo} />

      <div className="ml-auto flex items-center gap-2">
        <button
          title="Saqlash (Ctrl+S)"
          onClick={onSave}
          disabled={saving || !state.dirty}
          className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            saving
              ? 'bg-yellow-100 text-yellow-700 cursor-wait'
              : state.dirty
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Save size={15} />
          {saving ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
        <button
          title="DOCX yuklab olish"
          onClick={onDownload}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Download size={15} />
          Yuklab olish
        </button>
      </div>
    </div>
  );
};

const ToolBtn: React.FC<{
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}> = ({ icon, title, onClick, disabled, active }) => (
  <button
    title={title}
    onClick={onClick}
    disabled={disabled}
    className={`p-1.5 rounded transition-colors ${
      active
        ? 'bg-blue-100 text-blue-700'
        : disabled
          ? 'text-gray-300 cursor-not-allowed'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`}
  >
    {icon}
  </button>
);

const Separator = () => <div className="w-px h-6 bg-gray-200 mx-1" />;
