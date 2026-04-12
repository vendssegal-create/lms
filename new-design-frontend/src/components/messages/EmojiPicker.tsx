import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const EMOJI_GROUPS = {
  Tez: ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👏', '🙏', '💯'],
  Yuzlar: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘'],
};

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [onClose]);

  return (
    <div ref={ref} className="w-72 space-y-4 rounded-[24px] border border-border bg-white p-4 shadow-2xl">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-wider text-text-muted">Emoji tanlash</p>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary">
          <X size={15} />
        </button>
      </div>
      {Object.entries(EMOJI_GROUPS).map(([group, emojis]) => (
        <div key={group}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">{group}</p>
          <div className="flex flex-wrap gap-1">
            {emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onSelect(emoji)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-lg transition-colors hover:bg-slate-100"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
