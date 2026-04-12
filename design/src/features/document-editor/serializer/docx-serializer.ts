import JSZip from 'jszip';
import { buildDocumentXml } from './xml-builder';
import { addPassthroughParts } from './passthrough-store';
import type { DocxDocument, Relationship } from '../types';

export async function serializeDocx(doc: DocxDocument): Promise<Blob> {
  const zip = new JSZip();

  const documentXml = buildDocumentXml(doc.body, doc.pageSetup, doc.documentAttrs);
  zip.file('word/document.xml', documentXml);

  addPassthroughParts(zip, doc.unknownParts);

  const relsXml = buildRelationshipsXml(doc.relationships);
  zip.file('word/_rels/document.xml.rels', relsXml);

  for (const [target, blob] of doc.media) {
    const path = target.startsWith('media/') ? `word/${target}` : `word/media/${target}`;
    const buf = await blob.arrayBuffer();
    zip.file(path, new Uint8Array(buf));
  }

  for (const [relId, hdr] of Object.entries(doc.headers)) {
    const rel = doc.relationships[relId];
    if (rel && hdr.rawXml) {
      zip.file(`word/${rel.target}`, hdr.rawXml);
    }
  }
  for (const [relId, ftr] of Object.entries(doc.footers)) {
    const rel = doc.relationships[relId];
    if (rel && ftr.rawXml) {
      zip.file(`word/${rel.target}`, ftr.rawXml);
    }
  }

  if (!doc.unknownParts.has('[Content_Types].xml')) {
    zip.file('[Content_Types].xml', buildContentTypes(doc));
  }

  if (!doc.unknownParts.has('_rels/.rels')) {
    zip.file(
      '_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`
    );
  }

  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

function buildRelationshipsXml(rels: Record<string, Relationship>): string {
  const entries = Object.values(rels)
    .map(
      (r) =>
        `<Relationship Id="${esc(r.id)}" Type="${esc(r.type)}" Target="${esc(r.target)}"/>`
    )
    .join('\n  ');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${entries}
</Relationships>`;
}

function buildContentTypes(doc: DocxDocument): string {
  const extensions = new Map<string, string>([
    ['rels', 'application/vnd.openxmlformats-package.relationships+xml'],
    ['xml', 'application/xml'],
  ]);

  for (const target of doc.media.keys()) {
    const ext = target.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'png') extensions.set('png', 'image/png');
    else if (ext === 'jpg' || ext === 'jpeg') extensions.set('jpeg', 'image/jpeg');
    else if (ext === 'gif') extensions.set('gif', 'image/gif');
    else if (ext === 'bmp') extensions.set('bmp', 'image/bmp');
    else if (ext === 'svg') extensions.set('svg', 'image/svg+xml');
    else if (ext === 'emf') extensions.set('emf', 'image/x-emf');
    else if (ext === 'wmf') extensions.set('wmf', 'image/x-wmf');
    else if (ext === 'webp') extensions.set('webp', 'image/webp');
  }

  const defaultEntries = Array.from(extensions)
    .map(([ext, ct]) => `<Default Extension="${ext}" ContentType="${ct}"/>`)
    .join('\n  ');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  ${defaultEntries}
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
