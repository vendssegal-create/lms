import JSZip from 'jszip';
import { parseXml, findEl, findAllEl, attr, getTextContent } from './xml-helpers';
import { parseRelationships, getImageRelTargets } from './relationship-resolver';
import { parseStyles } from './style-resolver';
import type {
  DocxDocument,
  DocxBodyElement,
  DocxParagraph,
  DocxRun,
  DocxTable,
  DocxTableRow,
  DocxTableCell,
  DocxPageBreak,
  PageSetup,
  RelationshipMap,
  StyleMap,
  DocxHeaderFooter,
} from '../types';

let _idCounter = 0;
function nextId(prefix = 'el'): string {
  return `${prefix}_${++_idCounter}`;
}
export function resetIdCounter() {
  _idCounter = 0;
}

const PLACEHOLDER_RE = /\{\{\s*([\w]+)\s*\}\}/g;

const KNOWN_PARTS = new Set([
  'word/document.xml',
  'word/styles.xml',
  '[Content_Types].xml',
  'word/_rels/document.xml.rels',
  '_rels/.rels',
]);

export async function parseDocx(data: ArrayBuffer): Promise<DocxDocument> {
  resetIdCounter();
  const zip = await JSZip.loadAsync(data);

  const docXml = await readZipText(zip, 'word/document.xml');
  const stylesXml = await readZipText(zip, 'word/styles.xml');
  const relsXml = await readZipText(zip, 'word/_rels/document.xml.rels');

  const relationships = relsXml ? parseRelationships(relsXml) : {};
  const styles = stylesXml ? parseStyles(stylesXml) : {};
  const imageRels = getImageRelTargets(relationships);

  const media = new Map<string, Blob>();
  for (const [_relId, target] of Object.entries(imageRels)) {
    const path = target.startsWith('/') ? target.slice(1) : `word/${target}`;
    const file = zip.file(path);
    if (file) {
      const blob = await file.async('blob');
      media.set(target, blob);
    }
  }

  const parsed = parseXml(docXml);
  const docNode = parsed.find((n: any) => n['w:document'] !== undefined);
  const docChildren = docNode?.['w:document'] ?? [];
  const bodyNode = findEl(docChildren, 'w:body');
  const bodyChildren = bodyNode?.['w:body'] ?? [];

  const body = parseBodyElements(bodyChildren, relationships, styles);
  const pageSetup = parsePageSetup(bodyChildren);

  const headers: Record<string, DocxHeaderFooter> = {};
  const footers: Record<string, DocxHeaderFooter> = {};

  for (const [relId, rel] of Object.entries(relationships)) {
    if (rel.type.includes('/header')) {
      const hdrXml = await readZipText(zip, `word/${rel.target}`);
      if (hdrXml) {
        headers[relId] = parseHeaderFooter(hdrXml, relId, relationships, styles);
        KNOWN_PARTS.add(`word/${rel.target}`);
      }
    } else if (rel.type.includes('/footer')) {
      const ftrXml = await readZipText(zip, `word/${rel.target}`);
      if (ftrXml) {
        footers[relId] = parseHeaderFooter(ftrXml, relId, relationships, styles);
        KNOWN_PARTS.add(`word/${rel.target}`);
      }
    }
  }

  const unknownParts = new Map<string, Uint8Array>();
  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    if (KNOWN_PARTS.has(path)) continue;
    if (path.startsWith('word/media/')) continue;
    const bytes = await file.async('uint8array');
    unknownParts.set(path, bytes);
  }

  return {
    body,
    styles,
    relationships,
    headers,
    footers,
    media,
    pageSetup,
    unknownParts,
  };
}

function parseBodyElements(
  children: any[],
  rels: RelationshipMap,
  styles: StyleMap
): DocxBodyElement[] {
  const elements: DocxBodyElement[] = [];
  for (const child of children) {
    if (child['w:p'] !== undefined) {
      elements.push(parseParagraph(child['w:p'], rels));
    } else if (child['w:tbl'] !== undefined) {
      elements.push(parseTable(child['w:tbl'], rels));
    } else if (child['w:sectPr'] !== undefined) {
      // section properties handled separately for page setup
    }
  }
  return elements;
}

function parseParagraph(pChildren: any[], rels: RelationshipMap): DocxParagraph {
  const para: DocxParagraph = {
    type: 'paragraph',
    id: nextId('p'),
    runs: [],
  };

  const pPr = findEl(pChildren, 'w:pPr');
  if (pPr) {
    const pPrChildren = pPr['w:pPr'] ?? [];
    const jcEl = findEl(pPrChildren, 'w:jc');
    if (jcEl) {
      const val = attr(jcEl, 'w:val');
      if (val === 'left' || val === 'center' || val === 'right' || val === 'both' || val === 'justify') {
        para.alignment = val === 'both' ? 'justify' : val;
      }
    }

    const spacingEl = findEl(pPrChildren, 'w:spacing');
    if (spacingEl) {
      para.spacing = {};
      const before = attr(spacingEl, 'w:before');
      const after = attr(spacingEl, 'w:after');
      const line = attr(spacingEl, 'w:line');
      if (before) para.spacing.before = parseInt(before, 10);
      if (after) para.spacing.after = parseInt(after, 10);
      if (line) para.spacing.line = parseInt(line, 10);
    }

    const indEl = findEl(pPrChildren, 'w:ind');
    if (indEl) {
      para.indentation = {};
      const left = attr(indEl, 'w:left');
      const right = attr(indEl, 'w:right');
      const firstLine = attr(indEl, 'w:firstLine');
      if (left) para.indentation.left = parseInt(left, 10);
      if (right) para.indentation.right = parseInt(right, 10);
      if (firstLine) para.indentation.firstLine = parseInt(firstLine, 10);
    }

    const pStyleEl = findEl(pPrChildren, 'w:pStyle');
    if (pStyleEl) {
      para.style = attr(pStyleEl, 'w:val') ?? undefined;
    }
  }

  const runEls = findAllEl(pChildren, 'w:r');
  for (const runNode of runEls) {
    const runChildren = runNode['w:r'] ?? [];
    const runs = parseRun(runChildren, rels);
    para.runs.push(...runs);
  }

  // Check for page break in paragraph properties
  if (pPr) {
    const pPrChildren = pPr['w:pPr'] ?? [];
    const pageBreakBefore = findEl(pPrChildren, 'w:pageBreakBefore');
    if (pageBreakBefore) {
      para.runs.unshift({ type: 'break' });
    }
  }

  return para;
}

function parseRun(runChildren: any[], rels: RelationshipMap): DocxRun[] {
  const runs: DocxRun[] = [];
  const rPr = findEl(runChildren, 'w:rPr');

  let bold: boolean | undefined;
  let italic: boolean | undefined;
  let underline: boolean | undefined;
  let strikethrough: boolean | undefined;
  let fontSize: number | undefined;
  let fontFamily: string | undefined;
  let color: string | undefined;

  if (rPr) {
    const rPrChildren = rPr['w:rPr'] ?? [];
    if (findEl(rPrChildren, 'w:b')) bold = true;
    if (findEl(rPrChildren, 'w:i')) italic = true;
    if (findEl(rPrChildren, 'w:u')) underline = true;
    if (findEl(rPrChildren, 'w:strike')) strikethrough = true;

    const szEl = findEl(rPrChildren, 'w:sz');
    if (szEl) {
      const val = attr(szEl, 'w:val');
      if (val) fontSize = parseInt(val, 10);
    }

    const fontEl = findEl(rPrChildren, 'w:rFonts');
    if (fontEl) {
      fontFamily =
        attr(fontEl, 'w:ascii') ??
        attr(fontEl, 'w:hAnsi') ??
        attr(fontEl, 'w:cs') ??
        undefined;
    }

    const colorEl = findEl(rPrChildren, 'w:color');
    if (colorEl) {
      const val = attr(colorEl, 'w:val');
      if (val && val !== 'auto') color = `#${val}`;
    }
  }

  for (const child of runChildren) {
    if (child['w:t'] !== undefined) {
      const text = getTextContent(child['w:t'] ?? []);
      const placeholders = splitPlaceholders(text);
      for (const part of placeholders) {
        runs.push({
          ...part,
          bold,
          italic,
          underline,
          strikethrough,
          fontSize,
          fontFamily,
          color,
        });
      }
    } else if (child['w:br'] !== undefined) {
      runs.push({ type: 'break' });
    } else if (child['w:drawing'] !== undefined) {
      const imgRun = parseDrawing(child['w:drawing'] ?? [], rels);
      if (imgRun) {
        runs.push({ ...imgRun, bold, italic, underline, fontSize, fontFamily, color });
      }
    } else if (child['w:tab'] !== undefined) {
      runs.push({ type: 'text', text: '\t', bold, italic, underline, fontSize, fontFamily, color });
    }
  }

  return runs;
}

function splitPlaceholders(text: string): DocxRun[] {
  const runs: DocxRun[] = [];
  let lastIndex = 0;

  PLACEHOLDER_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PLACEHOLDER_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }
    runs.push({ type: 'placeholder', placeholderName: match[1], text: match[0] });
    lastIndex = PLACEHOLDER_RE.lastIndex;
  }

  if (lastIndex < text.length) {
    runs.push({ type: 'text', text: text.slice(lastIndex) });
  }

  if (runs.length === 0 && text.length > 0) {
    runs.push({ type: 'text', text });
  }

  return runs;
}

function parseDrawing(drawingChildren: any[], rels: RelationshipMap): DocxRun | null {
  const inline = findEl(drawingChildren, 'wp:inline');
  const anchor = findEl(drawingChildren, 'wp:anchor');
  const container = inline ?? anchor;
  if (!container) return null;

  const containerChildren = container[inline ? 'wp:inline' : 'wp:anchor'] ?? [];
  const extentEl = findEl(containerChildren, 'wp:extent');
  let width = 0;
  let height = 0;
  if (extentEl) {
    const cx = attr(extentEl, 'cx');
    const cy = attr(extentEl, 'cy');
    if (cx) width = parseInt(cx, 10);
    if (cy) height = parseInt(cy, 10);
  }

  const graphicEl = findEl(containerChildren, 'a:graphic');
  if (!graphicEl) return null;
  const graphicData = findEl(graphicEl['a:graphic'] ?? [], 'a:graphicData');
  if (!graphicData) return null;
  const picEl = findEl(graphicData['a:graphicData'] ?? [], 'pic:pic');
  if (!picEl) return null;

  const blipFill = findEl(picEl['pic:pic'] ?? [], 'pic:blipFill');
  if (!blipFill) return null;
  const blip = findEl(blipFill['pic:blipFill'] ?? [], 'a:blip');
  if (!blip) return null;

  const embedId = attr(blip, 'r:embed') ?? '';
  const rel = rels[embedId];
  const imageId = rel?.target ?? embedId;

  return {
    type: 'image',
    imageId,
    imageWidth: width,
    imageHeight: height,
  };
}

function parseTable(tblChildren: any[], rels: RelationshipMap): DocxTable {
  const table: DocxTable = {
    type: 'table',
    id: nextId('tbl'),
    rows: [],
  };

  const tblGrid = findEl(tblChildren, 'w:tblGrid');
  if (tblGrid) {
    const gridCols = findAllEl(tblGrid['w:tblGrid'] ?? [], 'w:gridCol');
    table.colWidths = gridCols.map((gc) => {
      const w = attr(gc, 'w:w');
      return w ? parseInt(w, 10) : 0;
    });
  }

  const rowEls = findAllEl(tblChildren, 'w:tr');
  for (const rowNode of rowEls) {
    table.rows.push(parseTableRow(rowNode['w:tr'] ?? [], rels));
  }

  return table;
}

function parseTableRow(trChildren: any[], rels: RelationshipMap): DocxTableRow {
  const row: DocxTableRow = { cells: [] };

  const trPr = findEl(trChildren, 'w:trPr');
  if (trPr) {
    const heightEl = findEl(trPr['w:trPr'] ?? [], 'w:trHeight');
    if (heightEl) {
      const val = attr(heightEl, 'w:val');
      if (val) row.height = parseInt(val, 10);
    }
  }

  const cellEls = findAllEl(trChildren, 'w:tc');
  for (const cellNode of cellEls) {
    row.cells.push(parseTableCell(cellNode['w:tc'] ?? [], rels));
  }

  return row;
}

function parseTableCell(tcChildren: any[], rels: RelationshipMap): DocxTableCell {
  const cell: DocxTableCell = { paragraphs: [] };

  const tcPr = findEl(tcChildren, 'w:tcPr');
  if (tcPr) {
    const tcPrChildren = tcPr['w:tcPr'] ?? [];
    const widthEl = findEl(tcPrChildren, 'w:tcW');
    if (widthEl) {
      const w = attr(widthEl, 'w:w');
      if (w) cell.width = parseInt(w, 10);
    }

    const gridSpanEl = findEl(tcPrChildren, 'w:gridSpan');
    if (gridSpanEl) {
      const val = attr(gridSpanEl, 'w:val');
      if (val) cell.colSpan = parseInt(val, 10);
    }

    const vMergeEl = findEl(tcPrChildren, 'w:vMerge');
    if (vMergeEl) {
      const val = attr(vMergeEl, 'w:val');
      if (val === 'restart') cell.rowSpan = 1; // actual span computed later
    }

    const shadingEl = findEl(tcPrChildren, 'w:shd');
    if (shadingEl) {
      cell.shading = attr(shadingEl, 'w:fill') ?? undefined;
    }

    const vAlignEl = findEl(tcPrChildren, 'w:vAlign');
    if (vAlignEl) {
      const val = attr(vAlignEl, 'w:val');
      if (val === 'top' || val === 'center' || val === 'bottom') {
        cell.verticalAlign = val;
      }
    }
  }

  const paraEls = findAllEl(tcChildren, 'w:p');
  for (const p of paraEls) {
    cell.paragraphs.push(parseParagraph(p['w:p'] ?? [], rels));
  }

  return cell;
}

function parsePageSetup(bodyChildren: any[]): PageSetup {
  const defaults: PageSetup = {
    width: 11906,
    height: 16838,
    margins: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
    orientation: 'portrait',
  };

  const sectPr = findEl(bodyChildren, 'w:sectPr');
  if (!sectPr) return defaults;

  const sectChildren = sectPr['w:sectPr'] ?? [];
  const pgSz = findEl(sectChildren, 'w:pgSz');
  if (pgSz) {
    const w = attr(pgSz, 'w:w');
    const h = attr(pgSz, 'w:h');
    const orient = attr(pgSz, 'w:orient');
    if (w) defaults.width = parseInt(w, 10);
    if (h) defaults.height = parseInt(h, 10);
    if (orient === 'landscape') defaults.orientation = 'landscape';
  }

  const pgMar = findEl(sectChildren, 'w:pgMar');
  if (pgMar) {
    const top = attr(pgMar, 'w:top');
    const bottom = attr(pgMar, 'w:bottom');
    const left = attr(pgMar, 'w:left');
    const right = attr(pgMar, 'w:right');
    if (top) defaults.margins.top = parseInt(top, 10);
    if (bottom) defaults.margins.bottom = parseInt(bottom, 10);
    if (left) defaults.margins.left = parseInt(left, 10);
    if (right) defaults.margins.right = parseInt(right, 10);
  }

  return defaults;
}

function parseHeaderFooter(
  xml: string,
  relId: string,
  rels: RelationshipMap,
  _styles: StyleMap
): DocxHeaderFooter {
  const parsed = parseXml(xml);
  const root =
    parsed.find((n: any) => n['w:hdr'] !== undefined) ??
    parsed.find((n: any) => n['w:ftr'] !== undefined);

  if (!root) {
    return { paragraphs: [], relId, rawXml: xml };
  }

  const key = root['w:hdr'] !== undefined ? 'w:hdr' : 'w:ftr';
  const children = root[key] ?? [];
  const paragraphs: DocxParagraph[] = [];

  const paraEls = findAllEl(children, 'w:p');
  for (const p of paraEls) {
    paragraphs.push(parseParagraph(p['w:p'] ?? [], rels));
  }

  return { paragraphs, relId, rawXml: xml };
}

async function readZipText(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) return '';
  return file.async('text');
}
