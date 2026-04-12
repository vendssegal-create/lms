export interface DocxDocument {
  body: DocxBodyElement[];
  styles: StyleMap;
  relationships: RelationshipMap;
  headers: Record<string, DocxHeaderFooter>;
  footers: Record<string, DocxHeaderFooter>;
  media: Map<string, Blob>;
  pageSetup: PageSetup;
  /** Preserved for round-trip: ZIP entries we don't parse */
  unknownParts: Map<string, Uint8Array>;
  /** Raw XML attributes on <w:document> root for faithful re-serialization */
  documentAttrs?: Record<string, string>;
}

export type DocxBodyElement = DocxParagraph | DocxTable | DocxPageBreak;

export interface DocxParagraph {
  type: 'paragraph';
  id: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  spacing?: { before?: number; after?: number; line?: number };
  indentation?: { left?: number; right?: number; firstLine?: number };
  style?: string;
  runs: DocxRun[];
  /** Raw XML string of <w:pPr> children we don't model */
  rawParagraphProps?: string;
}

export interface DocxRun {
  type: 'text' | 'placeholder' | 'image' | 'break';
  text?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  highlight?: string;
  imageId?: string;
  imageWidth?: number;
  imageHeight?: number;
  placeholderName?: string;
  /** Raw XML string of <w:rPr> children we don't model */
  rawRunProps?: string;
  /** Raw XML of the drawing element (for round-trip of complex images) */
  rawDrawingXml?: string;
}

export interface DocxPageBreak {
  type: 'pageBreak';
  id: string;
}

export interface DocxTable {
  type: 'table';
  id: string;
  rows: DocxTableRow[];
  colWidths?: number[];
  borders?: TableBorders;
  rawTableProps?: string;
}

export interface DocxTableRow {
  cells: DocxTableCell[];
  height?: number;
  rawRowProps?: string;
}

export interface DocxTableCell {
  paragraphs: DocxParagraph[];
  colSpan?: number;
  rowSpan?: number;
  width?: number;
  verticalAlign?: 'top' | 'center' | 'bottom';
  shading?: string;
  borders?: CellBorders;
  rawCellProps?: string;
}

export interface TableBorders {
  top?: BorderDef;
  bottom?: BorderDef;
  left?: BorderDef;
  right?: BorderDef;
  insideH?: BorderDef;
  insideV?: BorderDef;
}

export type CellBorders = TableBorders;

export interface BorderDef {
  style: string;
  size: number;
  color: string;
}

export interface PageSetup {
  width: number;
  height: number;
  margins: { top: number; bottom: number; left: number; right: number };
  orientation: 'portrait' | 'landscape';
}

export interface DocxHeaderFooter {
  paragraphs: DocxParagraph[];
  relId: string;
  rawXml?: string;
}

export interface StyleDef {
  id: string;
  name?: string;
  basedOn?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
}

export type StyleMap = Record<string, StyleDef>;

export interface Relationship {
  id: string;
  type: string;
  target: string;
}

export type RelationshipMap = Record<string, Relationship>;

// ---- Editor state types ----

export interface EditorSelection {
  paragraphId: string;
  startOffset: number;
  endOffset: number;
  runIndex?: number;
}

export interface EditorState {
  document: DocxDocument | null;
  selection: EditorSelection | null;
  undoStack: DocxDocument[];
  redoStack: DocxDocument[];
  dirty: boolean;
  saving: boolean;
  lastSaved: Date | null;
  templateId: number | null;
}

export type EditorAction =
  | { type: 'SET_DOCUMENT'; payload: DocxDocument }
  | { type: 'UPDATE_PARAGRAPH'; id: string; runs: DocxRun[] }
  | { type: 'FORMAT_SELECTION'; format: Partial<DocxRun> }
  | { type: 'INSERT_TABLE'; afterId: string; rows: number; cols: number }
  | { type: 'INSERT_IMAGE'; afterId: string; blob: Blob; width: number; height: number; imageId: string }
  | { type: 'INSERT_PLACEHOLDER'; paragraphId: string; offset: number; name: string }
  | { type: 'INSERT_PAGE_BREAK'; afterId: string }
  | { type: 'UPDATE_TABLE_CELL'; tableId: string; row: number; col: number; paragraphs: DocxParagraph[] }
  | { type: 'ADD_TABLE_ROW'; tableId: string; afterRow?: number }
  | { type: 'ADD_TABLE_COLUMN'; tableId: string; afterCol?: number }
  | { type: 'DELETE_TABLE_ROW'; tableId: string; rowIndex: number }
  | { type: 'DELETE_TABLE_COLUMN'; tableId: string; colIndex: number }
  | { type: 'RESIZE_IMAGE'; imageId: string; width: number; height: number }
  | { type: 'UPDATE_PAGE_SETUP'; setup: Partial<PageSetup> }
  | { type: 'DELETE_ELEMENT'; id: string }
  | { type: 'MOVE_ELEMENT'; id: string; direction: 'up' | 'down' }
  | { type: 'SET_SELECTION'; selection: EditorSelection | null }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'MARK_SAVED' }
  | { type: 'MARK_SAVING' };

export const CERTIFICATE_PLACEHOLDERS = [
  { name: 'student_name', label: 'Talaba ismi' },
  { name: 'course_name', label: 'Kurs nomi' },
  { name: 'certificate_date', label: 'Sertifikat sanasi' },
  { name: 'serial_number', label: 'Seriya raqami' },
  { name: 'hours', label: 'Soatlar' },
  { name: 'score', label: 'Ball' },
  { name: 'max_score', label: 'Maksimal ball' },
  { name: 'issued_by', label: 'Beruvchi' },
  { name: 'position', label: 'Lavozim' },
  { name: 'verify_url', label: 'Tekshirish URL' },
  { name: 'qr_placeholder', label: 'QR kod' },
  { name: 'institution_name', label: 'Muassasa nomi' },
] as const;
