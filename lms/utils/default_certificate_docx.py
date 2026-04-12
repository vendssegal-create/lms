"""
Standart sertifikat DOCX shabloni (docxtpl placeholderlari bilan).
Fayl yo‘q bo‘lsa yoziladi — DOCX yuklanmagan kurslar ham ishlashi uchun.
"""
from __future__ import annotations

import zipfile
from pathlib import Path
from xml.sax.saxutils import escape


def _p_center(text: str, bold: bool = False, size_half_pts: int | None = None) -> str:
    rpr = ""
    if bold:
        rpr += "<w:b/>"
    if size_half_pts:
        rpr += f'<w:sz w:val="{size_half_pts}"/><w:szCs w:val="{size_half_pts}"/>'
    rpr = f"<w:rPr>{rpr}</w:rPr>" if rpr else ""
    t = escape(text, {"'": "&apos;", '"': "&quot;"})
    return (
        f'<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="120"/></w:pPr>'
        f'<w:r>{rpr}<w:t xml:space="preserve">{t}</w:t></w:r></w:p>'
    )


def _p_left(text: str) -> str:
    t = escape(text, {"'": "&apos;", '"': "&quot;"})
    return (
        f'<w:p><w:pPr><w:spacing w:after="80"/></w:pPr>'
        f'<w:r><w:t xml:space="preserve">{t}</w:t></w:r></w:p>'
    )


def write_default_certificate_docx_if_missing(base_dir: Path) -> Path:
    """
    base_dir — Django loyiha ildizi (BASE_DIR).
    certificate_template.docx bo‘lmasa yaratadi va to‘liq yo‘lni qaytaradi.
    """
    out = base_dir / "lms" / "certificate_assets" / "certificate_template.docx"
    if out.exists():
        return out

    out.parent.mkdir(parents=True, exist_ok=True)

    body_parts = [
        _p_center("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", size_half_pts=14),
        _p_center("SERTIFIKAT", bold=True, size_half_pts=64),
        _p_center("{{ institution_name }}", size_half_pts=26),
        _p_center(""),
        _p_center("Ushbu hujjat quyidagi tinglovchini tasdiqlaydi", size_half_pts=22),
        _p_center("{{ student_name }}", bold=True, size_half_pts=48),
        _p_center(""),
        _p_center(
            "«{{ course_name }}» nomli kurs bo‘yicha o‘qitish jarayonini muvaffaqiyatli tamomladi.",
            size_half_pts=24,
        ),
        _p_center(""),
        _p_left("Soatlar: {{ hours }}"),
        _p_left("Ball: {{ score }} / {{ max_score }}"),
        _p_left("Berilgan sana: {{ certificate_date }}"),
        _p_left("Seriya: {{ serial_number }}"),
        _p_center(""),
        _p_center("{{ qr_placeholder }}", size_half_pts=18),
        _p_center("QR-kod orqali sertifikatni tekshirish", size_half_pts=18),
        _p_center("{{ verify_url }}", size_half_pts=16),
        _p_center(""),
        _p_center("{{ issued_by }}", size_half_pts=22),
        _p_center("{{ position }}", size_half_pts=22),
    ]

    document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    {"".join(body_parts)}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/>
    </w:sectPr>
  </w:body>
</w:document>"""

    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>"""

    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>"""

    doc_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>"""

    core = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>LMS sertifikat shabloni</dc:title>
  <dc:creator>LMS</dc:creator>
</cp:coreProperties>"""

    app_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>LMS</Application>
</Properties>"""

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", rels)
        z.writestr("word/_rels/document.xml.rels", doc_rels)
        z.writestr("word/document.xml", document_xml.encode("utf-8"))
        z.writestr("docProps/core.xml", core)
        z.writestr("docProps/app.xml", app_xml)

    return out
