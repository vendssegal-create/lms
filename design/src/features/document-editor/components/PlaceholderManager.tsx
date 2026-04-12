import React, { useState } from 'react';
import { useEditor } from '../context';
import { CERTIFICATE_PLACEHOLDERS } from '../types';

interface Props {
  onClose: () => void;
}

export const PlaceholderManager: React.FC<Props> = ({ onClose }) => {
  const { state, dispatch } = useEditor();
  const [search, setSearch] = useState('');

  const filtered = CERTIFICATE_PLACEHOLDERS.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.label.toLowerCase().includes(search.toLowerCase())
  );

  const insert = (name: string) => {
    if (!state.selection) return;
    dispatch({
      type: 'INSERT_PLACEHOLDER',
      paragraphId: state.selection.paragraphId,
      offset: state.selection.startOffset,
      name,
    });
    onClose();
  };

  return (
    <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
      <div className="p-2 border-b border-gray-100">
        <input
          type="text"
          placeholder="Qidirish..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
          autoFocus
        />
      </div>
      <div className="max-h-64 overflow-y-auto">
        {filtered.map((p) => (
          <button
            key={p.name}
            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between"
            onClick={() => insert(p.name)}
          >
            <span className="font-mono text-blue-700 text-xs">{'{{ ' + p.name + ' }}'}</span>
            <span className="text-gray-500 text-xs">{p.label}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-sm text-gray-400 text-center">Topilmadi</div>
        )}
      </div>
    </div>
  );
};
