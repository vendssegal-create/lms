import React from 'react';
import { useEditor } from '../context';
import { CERTIFICATE_PLACEHOLDERS } from '../types';

export const InspectorPanel: React.FC = () => {
  const { state, dispatch } = useEditor();
  const pageSetup = state.document?.pageSetup;

  return (
    <div className="w-56 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
      {/* Page Setup */}
      <Section title="Sahifa sozlamalari">
        {pageSetup && (
          <div className="space-y-2">
            <label className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Yo'nalish</span>
              <select
                className="text-xs border border-gray-200 rounded px-1 py-0.5"
                value={pageSetup.orientation}
                onChange={(e) =>
                  dispatch({
                    type: 'UPDATE_PAGE_SETUP',
                    setup: {
                      orientation: e.target.value as 'portrait' | 'landscape',
                      ...(e.target.value === 'landscape'
                        ? { width: 16838, height: 11906 }
                        : { width: 11906, height: 16838 }),
                    },
                  })
                }
              >
                <option value="portrait">Tik</option>
                <option value="landscape">Yotiq</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-1">
              {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
                <label key={side} className="text-xs">
                  <span className="text-gray-400 capitalize block">{side}</span>
                  <input
                    type="number"
                    className="w-full border border-gray-200 rounded px-1 py-0.5 text-xs"
                    value={Math.round((pageSetup.margins[side] / 1440) * 2.54 * 10) / 10}
                    onChange={(e) => {
                      const cm = parseFloat(e.target.value) || 0;
                      dispatch({
                        type: 'UPDATE_PAGE_SETUP',
                        setup: {
                          margins: { [side]: Math.round((cm / 2.54) * 1440) } as any,
                        },
                      });
                    }}
                    step={0.1}
                    min={0}
                  />
                  <span className="text-gray-300 text-[10px]">sm</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Placeholders */}
      <Section title="Placeholderlar">
        <div className="space-y-0.5">
          {CERTIFICATE_PLACEHOLDERS.map((p) => (
            <button
              key={p.name}
              className="w-full text-left px-2 py-1 text-xs rounded hover:bg-blue-50 flex items-center justify-between"
              onClick={() => {
                if (!state.selection) return;
                dispatch({
                  type: 'INSERT_PLACEHOLDER',
                  paragraphId: state.selection.paragraphId,
                  offset: state.selection.startOffset,
                  name: p.name,
                });
              }}
            >
              <span className="font-mono text-blue-600">{p.name}</span>
              <span className="text-gray-400">{p.label}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Info */}
      <Section title="Ma'lumot">
        <div className="text-xs text-gray-400 space-y-1">
          <div>Elementlar: {state.document?.body.length ?? 0}</div>
          <div>Rasmlar: {state.document?.media.size ?? 0}</div>
          {state.lastSaved && (
            <div>
              Saqlangan:{' '}
              {state.lastSaved.toLocaleTimeString('uz-UZ', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="border-b border-gray-100 p-3">
    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
      {title}
    </h3>
    {children}
  </div>
);
