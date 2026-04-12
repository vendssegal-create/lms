import React from 'react';

interface Props {
  name: string;
  selected?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
}

export const PlaceholderChip: React.FC<Props> = ({ name, selected, onClick, onDelete }) => {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium cursor-pointer select-none transition-colors ${
        selected
          ? 'bg-blue-600 text-white ring-2 ring-blue-300'
          : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
      }`}
      onClick={onClick}
      contentEditable={false}
      data-placeholder={name}
    >
      <span className="opacity-60">{'{{ '}</span>
      {name}
      <span className="opacity-60">{' }}'}</span>
      {onDelete && (
        <button
          className="ml-1 text-current opacity-60 hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="O'chirish"
        >
          ×
        </button>
      )}
    </span>
  );
};
