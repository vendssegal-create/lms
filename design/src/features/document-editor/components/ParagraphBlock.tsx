import React, { useRef, useCallback } from 'react';
import { PlaceholderChip } from './PlaceholderChip';
import { useEditor } from '../context';
import type { DocxParagraph, DocxRun } from '../types';

interface Props {
  paragraph: DocxParagraph;
  readOnly?: boolean;
}

const TWIPS_TO_PX = 1 / 15;

export const ParagraphBlock: React.FC<Props> = ({ paragraph, readOnly = false }) => {
  const { dispatch } = useEditor();
  const ref = useRef<HTMLDivElement>(null);

  const alignClass =
    paragraph.alignment === 'center'
      ? 'text-center'
      : paragraph.alignment === 'right'
        ? 'text-right'
        : paragraph.alignment === 'justify'
          ? 'text-justify'
          : 'text-left';

  const spacingStyle: React.CSSProperties = {};
  if (paragraph.spacing?.before) {
    spacingStyle.marginTop = `${paragraph.spacing.before * TWIPS_TO_PX}px`;
  }
  if (paragraph.spacing?.after) {
    spacingStyle.marginBottom = `${paragraph.spacing.after * TWIPS_TO_PX}px`;
  }
  if (paragraph.spacing?.line) {
    spacingStyle.lineHeight = `${paragraph.spacing.line / 240}`;
  }
  if (paragraph.indentation?.left) {
    spacingStyle.paddingLeft = `${paragraph.indentation.left * TWIPS_TO_PX}px`;
  }

  const handleInput = useCallback(() => {
    if (readOnly || !ref.current) return;
    const text = ref.current.innerText;
    const newRuns: DocxRun[] = [{ type: 'text', text }];
    dispatch({ type: 'UPDATE_PARAGRAPH', id: paragraph.id, runs: newRuns });
  }, [dispatch, paragraph.id, readOnly]);

  const handleFocus = useCallback(() => {
    dispatch({
      type: 'SET_SELECTION',
      selection: { paragraphId: paragraph.id, startOffset: 0, endOffset: 0 },
    });
  }, [dispatch, paragraph.id]);

  return (
    <div
      ref={ref}
      className={`outline-none min-h-[1.5em] ${alignClass}`}
      style={spacingStyle}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      onInput={handleInput}
      onFocus={handleFocus}
      data-paragraph-id={paragraph.id}
    >
      {paragraph.runs.map((run, i) => (
        <RunSpan key={i} run={run} readOnly={readOnly} />
      ))}
      {paragraph.runs.length === 0 && (
        <span className="text-gray-300 select-none pointer-events-none">&#8203;</span>
      )}
    </div>
  );
};

const RunSpan: React.FC<{ run: DocxRun; readOnly?: boolean }> = ({ run, readOnly }) => {
  if (run.type === 'placeholder' && run.placeholderName) {
    return <PlaceholderChip name={run.placeholderName} />;
  }

  if (run.type === 'break') {
    return <br />;
  }

  if (run.type === 'image') {
    return null; // Images handled by ImageBlock
  }

  const style: React.CSSProperties = {};
  if (run.bold) style.fontWeight = 'bold';
  if (run.italic) style.fontStyle = 'italic';
  if (run.underline) style.textDecoration = 'underline';
  if (run.strikethrough) {
    style.textDecoration = style.textDecoration
      ? `${style.textDecoration} line-through`
      : 'line-through';
  }
  if (run.fontSize) style.fontSize = `${run.fontSize / 2}pt`;
  if (run.fontFamily) style.fontFamily = run.fontFamily;
  if (run.color) style.color = run.color;

  return <span style={style}>{run.text || '\u200B'}</span>;
};
