import React, { useCallback } from 'react';
import { useEditor } from '../context';
import { ParagraphBlock } from './ParagraphBlock';
import { TableBlock } from './TableBlock';
import { ImageBlock } from './ImageBlock';
import type { DocxRun } from '../types';

interface Props {
  readOnly?: boolean;
}

const TWIPS_TO_PX = 1 / 15;

export const PageCanvas: React.FC<Props> = ({ readOnly = false }) => {
  const { state, dispatch } = useEditor();
  const doc = state.document;

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith('image/') || !doc) return;
      const imageId = `media/drop_${Date.now()}.${file.name.split('.').pop()}`;
      const lastId = doc.body[doc.body.length - 1]?.id ?? '';
      dispatch({
        type: 'INSERT_IMAGE',
        afterId: lastId,
        blob: file,
        width: 5000000,
        height: 3500000,
        imageId,
      });
    },
    [doc, dispatch]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items || !doc) return;
      for (const item of Array.from(items) as DataTransferItem[]) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          const imageId = `media/paste_${Date.now()}.png`;
          const lastId = doc.body[doc.body.length - 1]?.id ?? '';
          dispatch({
            type: 'INSERT_IMAGE',
            afterId: lastId,
            blob: file,
            width: 5000000,
            height: 3500000,
            imageId,
          });
          return;
        }
      }
    },
    [doc, dispatch]
  );

  if (!doc) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Hujjat yuklanmoqda...
      </div>
    );
  }

  const pageW = doc.pageSetup.width * TWIPS_TO_PX;
  const pageH = doc.pageSetup.height * TWIPS_TO_PX;
  const ml = doc.pageSetup.margins.left * TWIPS_TO_PX;
  const mr = doc.pageSetup.margins.right * TWIPS_TO_PX;
  const mt = doc.pageSetup.margins.top * TWIPS_TO_PX;
  const mb = doc.pageSetup.margins.bottom * TWIPS_TO_PX;

  return (
    <div className="flex-1 overflow-auto bg-gray-100 p-8 flex justify-center">
      <div
        className="bg-white shadow-md relative"
        style={{
          width: `${pageW}px`,
          minHeight: `${pageH}px`,
          padding: `${mt}px ${mr}px ${mb}px ${ml}px`,
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onPaste={handlePaste}
      >
        {doc.body.map((element) => {
          switch (element.type) {
            case 'paragraph': {
              const hasImage = element.runs.some((r) => r.type === 'image');
              return (
                <div key={element.id}>
                  {hasImage ? (
                    element.runs.map((run, i) =>
                      run.type === 'image' ? (
                        <ImageBlock key={i} run={run} readOnly={readOnly} />
                      ) : null
                    )
                  ) : null}
                  <ParagraphBlock paragraph={element} readOnly={readOnly} />
                </div>
              );
            }
            case 'table':
              return <TableBlock key={element.id} table={element} readOnly={readOnly} />;
            case 'pageBreak':
              return (
                <div
                  key={element.id}
                  className="border-t-2 border-dashed border-gray-300 my-4 relative"
                >
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-2 text-xs text-gray-400">
                    Sahifa uzilishi
                  </span>
                </div>
              );
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
};
