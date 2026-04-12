import React, { useState, useMemo, useEffect } from 'react';
import { useEditor } from '../context';
import type { DocxRun } from '../types';

interface Props {
  run: DocxRun;
  readOnly?: boolean;
}

const EMU_TO_PX = 1 / 9525;

export const ImageBlock: React.FC<Props> = ({ run, readOnly = false }) => {
  const { state, dispatch } = useEditor();
  const [dragging, setDragging] = useState(false);

  const width = (run.imageWidth ?? 914400) * EMU_TO_PX;
  const height = (run.imageHeight ?? 914400) * EMU_TO_PX;

  const src = useMemo(() => {
    if (!state.document || !run.imageId) return '';
    const blob = state.document.media.get(run.imageId);
    if (!blob) return '';
    return URL.createObjectURL(blob);
  }, [state.document, run.imageId]);

  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [src]);

  if (!src) {
    return (
      <div
        className="inline-flex items-center justify-center bg-gray-100 border border-dashed border-gray-300 text-gray-400 text-sm"
        style={{ width, height }}
      >
        Rasm
      </div>
    );
  }

  return (
    <span className="inline-block relative group" contentEditable={false}>
      <img
        src={src}
        alt=""
        style={{ width, height, display: 'inline-block', verticalAlign: 'bottom' }}
        className="max-w-full"
        draggable={false}
      />
      {!readOnly && (
        <span
          className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 rounded-sm cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
          onMouseDown={(e) => {
            e.preventDefault();
            setDragging(true);
            const startX = e.clientX;
            const startY = e.clientY;
            const startW = width;
            const startH = height;
            const aspect = startW / startH;

            const onMove = (ev: MouseEvent) => {
              const dx = ev.clientX - startX;
              const newW = Math.max(20, startW + dx);
              const newH = newW / aspect;
              dispatch({
                type: 'RESIZE_IMAGE',
                imageId: run.imageId!,
                width: Math.round(newW / EMU_TO_PX),
                height: Math.round(newH / EMU_TO_PX),
              });
            };
            const onUp = () => {
              setDragging(false);
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          }}
        />
      )}
    </span>
  );
};
