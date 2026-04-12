import { parseXml, findEl, findAllEl, attr, getTextContent } from './xml-helpers';
import type { StyleMap, StyleDef } from '../types';

export function parseStyles(xml: string): StyleMap {
  const map: StyleMap = {};
  try {
    const parsed = parseXml(xml);
    const stylesNode = parsed.find((n: any) => n['w:styles'] !== undefined);
    if (!stylesNode) return map;

    const styleEls = findAllEl(stylesNode['w:styles'], 'w:style');
    for (const el of styleEls) {
      const id = attr(el, 'w:styleId') ?? '';
      if (!id) continue;

      const children = el['w:style'] ?? [];
      const nameEl = findEl(children, 'w:name');
      const basedOnEl = findEl(children, 'w:basedOn');
      const rPrEl = findEl(children, 'w:rPr');
      const pPrEl = findEl(children, 'w:pPr');

      const def: StyleDef = { id };

      if (nameEl) {
        def.name = attr(nameEl, 'w:val') ?? undefined;
      }
      if (basedOnEl) {
        def.basedOn = attr(basedOnEl, 'w:val') ?? undefined;
      }

      if (rPrEl) {
        const rPr = rPrEl['w:rPr'] ?? [];
        applyRunProps(rPr, def);
      }

      if (pPrEl) {
        const pPr = pPrEl['w:pPr'] ?? [];
        const jcEl = findEl(pPr, 'w:jc');
        if (jcEl) {
          const val = attr(jcEl, 'w:val');
          if (val === 'left' || val === 'center' || val === 'right' || val === 'both' || val === 'justify') {
            def.alignment = val === 'both' ? 'justify' : val;
          }
        }
      }

      map[id] = def;
    }
  } catch {
    // return whatever we have
  }
  return map;
}

function applyRunProps(rPr: any[], target: Partial<StyleDef>) {
  if (findEl(rPr, 'w:b')) target.bold = true;
  if (findEl(rPr, 'w:i')) target.italic = true;
  if (findEl(rPr, 'w:u')) target.underline = true;

  const szEl = findEl(rPr, 'w:sz');
  if (szEl) {
    const val = attr(szEl, 'w:val');
    if (val) target.fontSize = parseInt(val, 10);
  }

  const fontEl = findEl(rPr, 'w:rFonts');
  if (fontEl) {
    target.fontFamily =
      attr(fontEl, 'w:ascii') ??
      attr(fontEl, 'w:hAnsi') ??
      attr(fontEl, 'w:cs') ??
      undefined;
  }

  const colorEl = findEl(rPr, 'w:color');
  if (colorEl) {
    const val = attr(colorEl, 'w:val');
    if (val && val !== 'auto') target.color = `#${val}`;
  }
}

export function resolveStyle(styleId: string | undefined, styles: StyleMap): Partial<StyleDef> {
  if (!styleId) return {};
  const resolved: Partial<StyleDef> = {};
  const visited = new Set<string>();
  let current = styleId;

  while (current && !visited.has(current)) {
    visited.add(current);
    const s = styles[current];
    if (!s) break;

    if (s.bold !== undefined && resolved.bold === undefined) resolved.bold = s.bold;
    if (s.italic !== undefined && resolved.italic === undefined) resolved.italic = s.italic;
    if (s.underline !== undefined && resolved.underline === undefined) resolved.underline = s.underline;
    if (s.fontSize !== undefined && resolved.fontSize === undefined) resolved.fontSize = s.fontSize;
    if (s.fontFamily !== undefined && resolved.fontFamily === undefined) resolved.fontFamily = s.fontFamily;
    if (s.color !== undefined && resolved.color === undefined) resolved.color = s.color;
    if (s.alignment !== undefined && resolved.alignment === undefined) resolved.alignment = s.alignment;

    current = s.basedOn ?? '';
  }

  return resolved;
}
