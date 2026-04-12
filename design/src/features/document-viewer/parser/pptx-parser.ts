import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

export interface PptxPresentation {
  slides: PptxSlide[];
  slideWidth: number;
  slideHeight: number;
  media: Map<string, Blob>;
}

export interface PptxSlide {
  index: number;
  elements: PptxElement[];
  background?: string;
}

export interface PptxElement {
  type: 'text' | 'image' | 'shape';
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  alignment?: 'left' | 'center' | 'right';
  imageId?: string;
  shapeName?: string;
  fill?: string;
}

const EMU_TO_PX = 1 / 9525;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  preserveOrder: false,
  trimValues: true,
});

export async function parsePptx(data: ArrayBuffer): Promise<PptxPresentation> {
  const zip = await JSZip.loadAsync(data);

  let slideWidth = 9144000;
  let slideHeight = 6858000;
  const presXml = await readText(zip, 'ppt/presentation.xml');
  if (presXml) {
    try {
      const pres = parser.parse(presXml);
      const sldSz = pres?.['p:presentation']?.['p:sldSz'];
      if (sldSz) {
        slideWidth = parseInt(sldSz['@_cx'] || '9144000', 10);
        slideHeight = parseInt(sldSz['@_cy'] || '6858000', 10);
      }
    } catch { /* use defaults */ }
  }

  const media = new Map<string, Blob>();
  for (const [path, file] of Object.entries(zip.files)) {
    if (path.startsWith('ppt/media/') && !file.dir) {
      const blob = await file.async('blob');
      media.set(path.replace('ppt/', ''), blob);
    }
  }

  const slideFiles = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] ?? '0', 10);
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] ?? '0', 10);
      return numA - numB;
    });

  const slides: PptxSlide[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const slideXml = await readText(zip, slideFiles[i]);
    if (!slideXml) continue;

    const relPath = slideFiles[i].replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
    const relsXml = await readText(zip, relPath);
    const rels = parseSimpleRels(relsXml);

    slides.push(parseSlide(slideXml, i, rels));
  }

  return { slides, slideWidth, slideHeight, media };
}

function parseSlide(xml: string, index: number, rels: Record<string, string>): PptxSlide {
  const slide: PptxSlide = { index, elements: [] };

  try {
    const parsed = parser.parse(xml);
    const cSld = parsed?.['p:sld']?.['p:cSld'];
    if (!cSld) return slide;

    const spTree = cSld['p:spTree'];
    if (!spTree) return slide;

    const shapes = Array.isArray(spTree['p:sp']) ? spTree['p:sp'] : spTree['p:sp'] ? [spTree['p:sp']] : [];
    for (const sp of shapes) {
      const el = parseShape(sp);
      if (el) slide.elements.push(el);
    }

    const pics = Array.isArray(spTree['p:pic']) ? spTree['p:pic'] : spTree['p:pic'] ? [spTree['p:pic']] : [];
    for (const pic of pics) {
      const el = parsePicture(pic, rels);
      if (el) slide.elements.push(el);
    }
  } catch { /* skip malformed slides */ }

  return slide;
}

function parseShape(sp: any): PptxElement | null {
  const spPr = sp?.['p:spPr'];
  const xfrm = spPr?.['a:xfrm'];
  if (!xfrm) return null;

  const off = xfrm['a:off'] ?? {};
  const ext = xfrm['a:ext'] ?? {};
  const x = parseInt(off['@_x'] || '0', 10) * EMU_TO_PX;
  const y = parseInt(off['@_y'] || '0', 10) * EMU_TO_PX;
  const width = parseInt(ext['@_cx'] || '0', 10) * EMU_TO_PX;
  const height = parseInt(ext['@_cy'] || '0', 10) * EMU_TO_PX;

  const txBody = sp?.['p:txBody'];
  if (txBody) {
    const text = extractText(txBody);
    const props = extractTextProps(txBody);
    return { type: 'text', x, y, width, height, text, ...props };
  }

  return { type: 'shape', x, y, width, height, shapeName: 'rect' };
}

function parsePicture(pic: any, rels: Record<string, string>): PptxElement | null {
  const spPr = pic?.['p:spPr'];
  const xfrm = spPr?.['a:xfrm'];
  if (!xfrm) return null;

  const off = xfrm['a:off'] ?? {};
  const ext = xfrm['a:ext'] ?? {};
  const x = parseInt(off['@_x'] || '0', 10) * EMU_TO_PX;
  const y = parseInt(off['@_y'] || '0', 10) * EMU_TO_PX;
  const width = parseInt(ext['@_cx'] || '0', 10) * EMU_TO_PX;
  const height = parseInt(ext['@_cy'] || '0', 10) * EMU_TO_PX;

  const blipFill = pic?.['p:blipFill'];
  const blip = blipFill?.['a:blip'];
  const embedId = blip?.['@_r:embed'];
  const imageTarget = embedId ? rels[embedId] : undefined;
  const imageId = imageTarget ? imageTarget.replace('../', '') : undefined;

  return { type: 'image', x, y, width, height, imageId };
}

function extractText(txBody: any): string {
  const paragraphs = Array.isArray(txBody['a:p']) ? txBody['a:p'] : txBody['a:p'] ? [txBody['a:p']] : [];
  const lines: string[] = [];

  for (const p of paragraphs) {
    const runs = Array.isArray(p['a:r']) ? p['a:r'] : p['a:r'] ? [p['a:r']] : [];
    const text = runs.map((r: any) => r['a:t'] ?? '').join('');
    lines.push(text);
  }

  return lines.join('\n');
}

function extractTextProps(txBody: any): Partial<PptxElement> {
  const p = Array.isArray(txBody['a:p']) ? txBody['a:p'][0] : txBody['a:p'];
  if (!p) return {};

  const r = Array.isArray(p['a:r']) ? p['a:r'][0] : p['a:r'];
  const rPr = r?.['a:rPr'];
  const props: Partial<PptxElement> = {};

  if (rPr) {
    if (rPr['@_b'] === '1') props.bold = true;
    if (rPr['@_i'] === '1') props.italic = true;
    const sz = rPr['@_sz'];
    if (sz) props.fontSize = parseInt(sz, 10) / 100;

    const solidFill = rPr['a:solidFill'];
    const srgb = solidFill?.['a:srgbClr'];
    if (srgb?.['@_val']) props.color = `#${srgb['@_val']}`;
  }

  const pPr = p['a:pPr'];
  if (pPr?.['@_algn']) {
    const a = pPr['@_algn'];
    if (a === 'ctr') props.alignment = 'center';
    else if (a === 'r') props.alignment = 'right';
    else props.alignment = 'left';
  }

  return props;
}

function parseSimpleRels(xml: string): Record<string, string> {
  const rels: Record<string, string> = {};
  if (!xml) return rels;
  try {
    const parsed = parser.parse(xml);
    const relationships = parsed?.['Relationships']?.['Relationship'];
    const list = Array.isArray(relationships) ? relationships : relationships ? [relationships] : [];
    for (const r of list) {
      if (r['@_Id'] && r['@_Target']) {
        rels[r['@_Id']] = r['@_Target'];
      }
    }
  } catch { /* ignore */ }
  return rels;
}

async function readText(zip: JSZip, path: string): Promise<string> {
  const f = zip.file(path);
  return f ? f.async('text') : '';
}
