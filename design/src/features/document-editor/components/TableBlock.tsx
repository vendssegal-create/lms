import React from 'react';
import { ParagraphBlock } from './ParagraphBlock';
import { useEditor } from '../context';
import type { DocxTable } from '../types';

interface Props {
  table: DocxTable;
  readOnly?: boolean;
}

const TWIPS_TO_PX = 1 / 15;

export const TableBlock: React.FC<Props> = ({ table, readOnly = false }) => {
  const { dispatch } = useEditor();

  return (
    <div className="my-2 overflow-x-auto" data-table-id={table.id}>
      <table className="border-collapse w-full">
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri} style={row.height ? { height: `${row.height * TWIPS_TO_PX}px` } : undefined}>
              {row.cells.map((cell, ci) => (
                <td
                  key={ci}
                  className="border border-gray-300 p-1 align-top"
                  colSpan={cell.colSpan}
                  rowSpan={cell.rowSpan}
                  style={{
                    width: cell.width ? `${cell.width * TWIPS_TO_PX}px` : undefined,
                    backgroundColor: cell.shading ? `#${cell.shading}` : undefined,
                    verticalAlign: cell.verticalAlign ?? 'top',
                  }}
                >
                  {cell.paragraphs.map((p) => (
                    <ParagraphBlock key={p.id} paragraph={p} readOnly={readOnly} />
                  ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && (
        <div className="flex gap-1 mt-1">
          <button
            className="text-xs px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
            onClick={() => dispatch({ type: 'ADD_TABLE_ROW', tableId: table.id })}
          >
            + Qator
          </button>
          <button
            className="text-xs px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
            onClick={() => dispatch({ type: 'ADD_TABLE_COLUMN', tableId: table.id })}
          >
            + Ustun
          </button>
        </div>
      )}
    </div>
  );
};
