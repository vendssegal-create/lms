import type {
  DocxParagraph,
  DocxRun,
  DocxTable,
  DocxTableRow,
  DocxTableCell,
  DocxBodyElement,
  PageSetup,
} from '../types';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildDocumentXml(
  body: DocxBodyElement[],
  pageSetup: PageSetup,
  documentAttrs?: Record<string, string>
): string {
  const defaultAttrs = {
    'xmlns:wpc': 'http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas',
    'xmlns:mo': 'http://schemas.microsoft.com/office/mac/office/2008/main',
    'xmlns:mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
    'xmlns:mv': 'urn:schemas-microsoft-com:mac:vml',
    'xmlns:o': 'urn:schemas-microsoft-com:office:office',
    'xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'xmlns:m': 'http://schemas.openxmlformats.org/officeDocument/2006/math',
    'xmlns:v': 'urn:schemas-microsoft-com:vml',
    'xmlns:wp14': 'http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing',
    'xmlns:wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    'xmlns:w10': 'urn:schemas-microsoft-com:office:word',
    'xmlns:w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'xmlns:w14': 'http://schemas.microsoft.com/office/word/2010/wordml',
    'xmlns:wpg': 'http://schemas.microsoft.com/office/word/2010/wordprocessingGroup',
    'xmlns:wpi': 'http://schemas.microsoft.com/office/word/2010/wordprocessingInk',
    'xmlns:wne': 'http://schemas.microsoft.com/office/word/2006/wordml',
    'xmlns:wps': 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape',
    'xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'xmlns:pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture',
  };

  const attrs = documentAttrs ?? defaultAttrs;
  const attrsStr = Object.entries(attrs)
    .map(([k, v]) => `${k}="${esc(v)}"`)
    .join(' ');

  const bodyXml = body.map((el) => serializeBodyElement(el)).join('\n');
  const sectPr = buildSectPr(pageSetup);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${attrsStr}>
<w:body>
${bodyXml}
${sectPr}
</w:body>
</w:document>`;
}

function serializeBodyElement(el: DocxBodyElement): string {
  switch (el.type) {
    case 'paragraph':
      return buildParagraph(el);
    case 'table':
      return buildTable(el);
    case 'pageBreak':
      return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
  }
}

export function buildParagraph(p: DocxParagraph): string {
  let pPr = '';
  const pPrParts: string[] = [];

  if (p.style) {
    pPrParts.push(`<w:pStyle w:val="${esc(p.style)}"/>`);
  }
  if (p.alignment) {
    const val = p.alignment === 'justify' ? 'both' : p.alignment;
    pPrParts.push(`<w:jc w:val="${val}"/>`);
  }
  if (p.spacing) {
    const parts: string[] = [];
    if (p.spacing.before !== undefined) parts.push(`w:before="${p.spacing.before}"`);
    if (p.spacing.after !== undefined) parts.push(`w:after="${p.spacing.after}"`);
    if (p.spacing.line !== undefined) parts.push(`w:line="${p.spacing.line}"`);
    if (parts.length) pPrParts.push(`<w:spacing ${parts.join(' ')}/>`);
  }
  if (p.indentation) {
    const parts: string[] = [];
    if (p.indentation.left !== undefined) parts.push(`w:left="${p.indentation.left}"`);
    if (p.indentation.right !== undefined) parts.push(`w:right="${p.indentation.right}"`);
    if (p.indentation.firstLine !== undefined) parts.push(`w:firstLine="${p.indentation.firstLine}"`);
    if (parts.length) pPrParts.push(`<w:ind ${parts.join(' ')}/>`);
  }
  if (p.rawParagraphProps) {
    pPrParts.push(p.rawParagraphProps);
  }

  if (pPrParts.length) {
    pPr = `<w:pPr>${pPrParts.join('')}</w:pPr>`;
  }

  const runs = p.runs.map((r) => buildRun(r)).join('');
  return `<w:p>${pPr}${runs}</w:p>`;
}

export function buildRun(r: DocxRun): string {
  if (r.type === 'break') {
    return `<w:r><w:br/></w:r>`;
  }

  if (r.type === 'image') {
    return buildImageRun(r);
  }

  let rPr = '';
  const rPrParts: string[] = [];
  if (r.bold) rPrParts.push('<w:b/>');
  if (r.italic) rPrParts.push('<w:i/>');
  if (r.underline) rPrParts.push('<w:u w:val="single"/>');
  if (r.strikethrough) rPrParts.push('<w:strike/>');
  if (r.fontSize) rPrParts.push(`<w:sz w:val="${r.fontSize}"/><w:szCs w:val="${r.fontSize}"/>`);
  if (r.fontFamily) {
    rPrParts.push(`<w:rFonts w:ascii="${esc(r.fontFamily)}" w:hAnsi="${esc(r.fontFamily)}" w:cs="${esc(r.fontFamily)}"/>`);
  }
  if (r.color) {
    const hex = r.color.replace('#', '');
    rPrParts.push(`<w:color w:val="${hex}"/>`);
  }
  if (r.rawRunProps) {
    rPrParts.push(r.rawRunProps);
  }

  if (rPrParts.length) {
    rPr = `<w:rPr>${rPrParts.join('')}</w:rPr>`;
  }

  const text =
    r.type === 'placeholder'
      ? `{{ ${r.placeholderName} }}`
      : r.text ?? '';

  const preserved = text.startsWith(' ') || text.endsWith(' ') ? ' xml:space="preserve"' : '';
  return `<w:r>${rPr}<w:t${preserved}>${esc(text)}</w:t></w:r>`;
}

function buildImageRun(r: DocxRun): string {
  if (r.rawDrawingXml) {
    return `<w:r><w:drawing>${r.rawDrawingXml}</w:drawing></w:r>`;
  }

  const cx = r.imageWidth ?? 914400;
  const cy = r.imageHeight ?? 914400;
  const rId = r.imageId ?? 'rId1';

  return `<w:r><w:drawing>
<wp:inline distT="0" distB="0" distL="0" distR="0">
  <wp:extent cx="${cx}" cy="${cy}"/>
  <wp:docPr id="1" name="Picture"/>
  <a:graphic>
    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
      <pic:pic>
        <pic:nvPicPr>
          <pic:cNvPr id="0" name="Picture"/>
          <pic:cNvPicPr/>
        </pic:nvPicPr>
        <pic:blipFill>
          <a:blip r:embed="${esc(rId)}"/>
          <a:stretch><a:fillRect/></a:stretch>
        </pic:blipFill>
        <pic:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </pic:spPr>
      </pic:pic>
    </a:graphicData>
  </a:graphic>
</wp:inline>
</w:drawing></w:r>`;
}

export function buildTable(t: DocxTable): string {
  let grid = '';
  if (t.colWidths?.length) {
    grid = `<w:tblGrid>${t.colWidths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
  }

  const tblPr = t.rawTableProps ? `<w:tblPr>${t.rawTableProps}</w:tblPr>` : '<w:tblPr/>';
  const rows = t.rows.map((row) => buildTableRow(row)).join('\n');
  return `<w:tbl>${tblPr}${grid}\n${rows}\n</w:tbl>`;
}

function buildTableRow(row: DocxTableRow): string {
  let trPr = '';
  if (row.height) {
    trPr = `<w:trPr><w:trHeight w:val="${row.height}"/></w:trPr>`;
  }
  if (row.rawRowProps) {
    trPr = `<w:trPr>${row.rawRowProps}</w:trPr>`;
  }
  const cells = row.cells.map((c) => buildTableCell(c)).join('');
  return `<w:tr>${trPr}${cells}</w:tr>`;
}

function buildTableCell(cell: DocxTableCell): string {
  const tcPrParts: string[] = [];
  if (cell.width) {
    tcPrParts.push(`<w:tcW w:w="${cell.width}" w:type="dxa"/>`);
  }
  if (cell.colSpan && cell.colSpan > 1) {
    tcPrParts.push(`<w:gridSpan w:val="${cell.colSpan}"/>`);
  }
  if (cell.shading) {
    tcPrParts.push(`<w:shd w:val="clear" w:fill="${cell.shading}"/>`);
  }
  if (cell.verticalAlign) {
    tcPrParts.push(`<w:vAlign w:val="${cell.verticalAlign}"/>`);
  }
  if (cell.rawCellProps) {
    tcPrParts.push(cell.rawCellProps);
  }

  const tcPr = tcPrParts.length ? `<w:tcPr>${tcPrParts.join('')}</w:tcPr>` : '';
  const paras =
    cell.paragraphs.length > 0
      ? cell.paragraphs.map((p) => buildParagraph(p)).join('')
      : '<w:p/>';

  return `<w:tc>${tcPr}${paras}</w:tc>`;
}

function buildSectPr(ps: PageSetup): string {
  const orient = ps.orientation === 'landscape' ? ' w:orient="landscape"' : '';
  return `<w:sectPr>
<w:pgSz w:w="${ps.width}" w:h="${ps.height}"${orient}/>
<w:pgMar w:top="${ps.margins.top}" w:right="${ps.margins.right}" w:bottom="${ps.margins.bottom}" w:left="${ps.margins.left}" w:header="720" w:footer="720" w:gutter="0"/>
</w:sectPr>`;
}
