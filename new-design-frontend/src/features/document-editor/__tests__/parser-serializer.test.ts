/**
 * Parser <-> Serializer round-trip tests.
 *
 * These tests validate that:
 * 1. The parser correctly extracts document structure from DOCX XML
 * 2. The serializer produces valid DOCX ZIP from the internal model
 * 3. Parse -> Serialize -> Parse produces equivalent output (round-trip)
 */
import { describe, it, expect } from 'vitest';
import { parseDocx, resetIdCounter } from '../parser/docx-parser';
import { serializeDocx } from '../serializer/docx-serializer';
import JSZip from 'jszip';

async function createMinimalDocx(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="48"/></w:rPr>
        <w:t>SERTIFIKAT</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>Talaba: {{ student_name }}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>Kurs: {{ course_name }}</w:t>
      </w:r>
    </w:p>
    <w:tbl>
      <w:tblGrid><w:gridCol w:w="5000"/><w:gridCol w:w="5000"/></w:tblGrid>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Ustun 1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Ustun 2</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`);
  const blob = await zip.generateAsync({ type: 'arraybuffer' });
  return blob;
}

describe('DOCX Parser', () => {
  it('should parse a minimal docx and extract paragraphs', async () => {
    resetIdCounter();
    const buffer = await createMinimalDocx();
    const doc = await parseDocx(buffer);

    expect(doc.body.length).toBeGreaterThanOrEqual(3);

    const firstPara = doc.body[0];
    expect(firstPara.type).toBe('paragraph');
    if (firstPara.type === 'paragraph') {
      expect(firstPara.alignment).toBe('center');
      expect(firstPara.runs.length).toBeGreaterThan(0);
      expect(firstPara.runs[0].bold).toBe(true);
      expect(firstPara.runs[0].fontSize).toBe(48);
    }
  });

  it('should detect placeholders in text runs', async () => {
    resetIdCounter();
    const buffer = await createMinimalDocx();
    const doc = await parseDocx(buffer);

    const secondPara = doc.body[1];
    expect(secondPara.type).toBe('paragraph');
    if (secondPara.type === 'paragraph') {
      const phRun = secondPara.runs.find(r => r.type === 'placeholder');
      expect(phRun).toBeDefined();
      expect(phRun!.placeholderName).toBe('student_name');
    }
  });

  it('should parse tables', async () => {
    resetIdCounter();
    const buffer = await createMinimalDocx();
    const doc = await parseDocx(buffer);

    const table = doc.body.find(el => el.type === 'table');
    expect(table).toBeDefined();
    if (table && table.type === 'table') {
      expect(table.rows.length).toBe(1);
      expect(table.rows[0].cells.length).toBe(2);
      expect(table.colWidths).toEqual([5000, 5000]);
    }
  });

  it('should parse page setup', async () => {
    resetIdCounter();
    const buffer = await createMinimalDocx();
    const doc = await parseDocx(buffer);

    expect(doc.pageSetup.width).toBe(11906);
    expect(doc.pageSetup.height).toBe(16838);
    expect(doc.pageSetup.margins.top).toBe(1440);
  });
});

describe('DOCX Serializer', () => {
  it('should produce a valid ZIP', async () => {
    resetIdCounter();
    const buffer = await createMinimalDocx();
    const doc = await parseDocx(buffer);
    const blob = await serializeDocx(doc);

    const buf = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    const docXml = await zip.file('word/document.xml')?.async('text');
    expect(docXml).toBeDefined();
    expect(docXml).toContain('<w:document');
    expect(docXml).toContain('<w:body');
  });
});

describe('Round-trip', () => {
  it('should preserve structure through parse -> serialize -> parse', async () => {
    resetIdCounter();
    const buffer = await createMinimalDocx();
    const doc1 = await parseDocx(buffer);

    const blob = await serializeDocx(doc1);
    const buffer2 = await blob.arrayBuffer();

    resetIdCounter();
    const doc2 = await parseDocx(buffer2);

    expect(doc2.body.length).toBe(doc1.body.length);
    expect(doc2.pageSetup.width).toBe(doc1.pageSetup.width);

    const paras1 = doc1.body.filter(e => e.type === 'paragraph');
    const paras2 = doc2.body.filter(e => e.type === 'paragraph');
    expect(paras2.length).toBe(paras1.length);

    const tables1 = doc1.body.filter(e => e.type === 'table');
    const tables2 = doc2.body.filter(e => e.type === 'table');
    expect(tables2.length).toBe(tables1.length);
  });

  it('should preserve placeholder tokens through round-trip', async () => {
    resetIdCounter();
    const buffer = await createMinimalDocx();
    const doc1 = await parseDocx(buffer);

    const blob = await serializeDocx(doc1);
    const buffer2 = await blob.arrayBuffer();

    resetIdCounter();
    const doc2 = await parseDocx(buffer2);

    const allPlaceholders = doc2.body
      .filter(e => e.type === 'paragraph')
      .flatMap(p => (p as any).runs)
      .filter((r: any) => r.type === 'placeholder')
      .map((r: any) => r.placeholderName);

    expect(allPlaceholders).toContain('student_name');
    expect(allPlaceholders).toContain('course_name');
  });
});
