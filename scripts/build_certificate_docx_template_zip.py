"""
docxtpl uchun certificate_template.docx — faqat zipfile + OOXML (python-docx siz).
python scripts/build_certificate_docx_template_zip.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from lms.utils.default_certificate_docx import write_default_certificate_docx_if_missing


def main() -> None:
    out = write_default_certificate_docx_if_missing(ROOT)
    print(f"Yozildi: {out}")


if __name__ == "__main__":
    main()
