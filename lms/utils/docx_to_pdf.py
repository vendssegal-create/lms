"""
To‘ldirilgan DOCX → PDF.

Mahalliy strategiya: ``CERTIFICATE_STRATEGY=docx_primary`` bo‘lsa PDF ixtiyoriy; PDF uchun shu modul
yoki ``?format=pdf``. Tijoriy SDK/bulut yoki HTML+WeasyPrint — alohida backendlar (reja).

Backendlar (``CERTIFICATE_PDF_BACKEND``):
  - ``libreoffice`` — LibreOffice headless (Linux/server uchun standart).
  - ``docx2pdf`` — `docx2pdf` paketi; **Microsoft Word** kerak (Windows/macOS).
  - ``auto`` — avvalo LibreOffice (topilsa), aks holda Windows/macOS da ``docx2pdf`` (Word).
    ``docx2pdf`` xato bersa va LO bo‘lsa, avtomatik LO ga qaytadi.
"""
from __future__ import annotations

import logging
import subprocess
import sys
import tempfile
from pathlib import Path

from django.conf import settings

from lms.utils.libreoffice import find_soffice_executable

logger = logging.getLogger(__name__)

_LO_MISSING_MSG = (
    "LibreOffice (soffice) topilmadi. "
    "PDF uchun LibreOffice o‘rnatilishi kerak: https://www.libreoffice.org/download "
    "yoki Windows: winget install TheDocumentFoundation.LibreOffice. "
    "Yoki .env da CERTIFICATE_PDF_BACKEND=docx2pdf (Microsoft Word bilan)."
)


def _soffice_wrapper_path() -> Path:
    return Path(settings.BASE_DIR) / "scripts" / "office" / "soffice.py"


def _convert_libreoffice(docx_path: Path) -> bytes:
    docx_path = Path(docx_path)
    wrapper = _soffice_wrapper_path()
    with tempfile.TemporaryDirectory() as tmpdir:
        if wrapper.is_file():
            cmd = [
                sys.executable,
                str(wrapper),
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                tmpdir,
                str(docx_path),
            ]
        else:
            soffice = find_soffice_executable()
            if not soffice:
                raise RuntimeError(_LO_MISSING_MSG)
            cmd = [
                soffice,
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                tmpdir,
                str(docx_path),
            ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
        if result.returncode != 0:
            err = (result.stderr or result.stdout or "").strip()
            if not err:
                err = _LO_MISSING_MSG
            logger.error("LibreOffice DOCX→PDF xatosi: %s", err[:500])
            raise RuntimeError(f"PDF generatsiya muvaffaqiyatsiz: {err[:500]}")

        pdf_path = Path(tmpdir) / f"{docx_path.stem}.pdf"
        if not pdf_path.is_file():
            raise FileNotFoundError(f"Kutilgan PDF topilmadi: {pdf_path}")
        return pdf_path.read_bytes()


def _convert_docx2pdf(docx_path: Path) -> bytes:
    if sys.platform not in ("win32", "darwin"):
        raise RuntimeError(
            "CERTIFICATE_PDF_BACKEND=docx2pdf faqat Windows yoki macOS da "
            "(Microsoft Word o‘rnatilgan) qo‘llaniladi. Server Linux bo‘lsa "
            "CERTIFICATE_PDF_BACKEND=libreoffice qoldiring."
        )
    try:
        from docx2pdf import convert
    except ImportError as exc:
        raise RuntimeError(
            "docx2pdf paketi yo‘q. O‘rnating: pip install docx2pdf "
            "(Windows/macOS; Microsoft Word kerak)."
        ) from exc

    docx_path = Path(docx_path)
    with tempfile.TemporaryDirectory() as tmpdir:
        out_pdf = Path(tmpdir) / f"{docx_path.stem}.pdf"
        try:
            convert(str(docx_path), str(out_pdf))
        except Exception as exc:
            logger.exception("docx2pdf konvertatsiya xatosi")
            raise RuntimeError(f"docx2pdf: {exc}") from exc
        if not out_pdf.is_file():
            raise FileNotFoundError(f"docx2pdf PDF yaratmadi: {out_pdf}")
        return out_pdf.read_bytes()


def _resolved_backend() -> str:
    raw = (getattr(settings, "CERTIFICATE_PDF_BACKEND", None) or "libreoffice").strip().lower()
    if raw == "auto":
        # Avvalo LibreOffice (Windows/macOS da ham Wordsiz ishlashi mumkin)
        if find_soffice_executable():
            return "libreoffice"
        if sys.platform in ("win32", "darwin"):
            try:
                import docx2pdf  # noqa: F401

                return "docx2pdf"
            except ImportError:
                logger.info("auto: docx2pdf import qilinmadi, libreoffice ishlatiladi")
        return "libreoffice"
    if raw in ("libreoffice", "docx2pdf"):
        return raw
    logger.warning("Noma’lum CERTIFICATE_PDF_BACKEND=%s, libreoffice ishlatiladi", raw)
    return "libreoffice"


def convert_docx_to_pdf_bytes(docx_path: str | Path) -> bytes:
    """To‘ldirilgan .docx fayldan PDF baytlarini qaytaradi."""
    docx_path = Path(docx_path)
    backend = _resolved_backend()
    if backend == "docx2pdf":
        try:
            return _convert_docx2pdf(docx_path)
        except Exception as exc:
            if find_soffice_executable():
                logger.warning(
                    "docx2pdf muvaffaqiyatsiz, LibreOffice ga o‘tildi: %s",
                    exc,
                )
                return _convert_libreoffice(docx_path)
            raise
    return _convert_libreoffice(docx_path)
