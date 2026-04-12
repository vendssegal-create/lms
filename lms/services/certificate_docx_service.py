"""
lms/services/certificate_docx_service.py
─────────────────────────────────────────────────────────────────────────────
DOCX → PDF sertifikat generatsiya xizmati.

Stack:
  - docxtpl  (Jinja2-style placeholder to'ldirish)
  - qrcode + Pillow (QR kod generatsiya)
  - DOCX → PDF: ``lms.utils.docx_to_pdf`` — LibreOffice yoki ``docx2pdf`` (Word + Windows/macOS)

Ishlatish:
  from lms.services.certificate_docx_service import CertificateDocxService

  service = CertificateDocxService()
  pdf_bytes = service.generate(
      student     = user_instance,
      course      = course_instance,
      serial      = "CERT-2026-00042",
      score       = 95,
      max_score   = 100,
      hours       = 120,
      issued_by   = "Prof. Karimov Alisher",
      position    = "Akademiya rektori",
  )
  # pdf_bytes → HttpResponse yoki FileField ga saqlash
─────────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import base64
import io
import logging
import os
import tempfile
from datetime import date
from pathlib import Path
from typing import Optional

import qrcode
import qrcode.constants
from django.conf import settings
from docx.shared import Mm
from docxtpl import DocxTemplate, InlineImage
from PIL import Image

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR: Path = Path(settings.BASE_DIR)

# Default template — admin CertificateTemplate.docx_file ga o'zini upload qilsa
# u holda model.docx_file.path ishlatiladi.
DEFAULT_TEMPLATE: Path = BASE_DIR / "lms" / "certificate_assets" / "certificate_template.docx"


# ── QR Code helper ────────────────────────────────────────────────────────────

def _build_qr_image(data: str, size_mm: int = 28) -> io.BytesIO:
    """
    data    — QR ichiga kodlangan URL (masalan tekshirish havolasi)
    size_mm — DOCX ichidagi chop o'lchami (millimetrlarda)
    Qaytaradi: PNG bilan to'ldirilgan BytesIO
    """
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=8,
        border=2,
    )
    qr.add_data(data)
    qr.make(fit=True)

    img: Image.Image = qr.make_image(
        fill_color="#1B3A6B",   # Navy — sertifikat rangiga mos
        back_color="white",
    )
    # 300 DPI standartida o'lcham: size_mm mm * 300/25.4 ≈ piksel
    px = int(size_mm * 300 / 25.4)
    img = img.resize((px, px), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


# ── DOCX → PDF ────────────────────────────────────────────────────────────────


def _docx_to_pdf(docx_path: str | Path) -> bytes:
    from lms.utils.docx_to_pdf import convert_docx_to_pdf_bytes

    return convert_docx_to_pdf_bytes(docx_path)


# ── Ana xizmat sinfi ──────────────────────────────────────────────────────────

class CertificateDocxService:
    """
    DOCX shabloniga asoslangan sertifikat generatsiya xizmati.

    Shablon topish tartibi (birinchi topilgani ishlatiladi):
      1. generate() ga uzatilgan template_path argumenti
      2. CertificateTemplate.docx_file (model fieldidan)
      3. DEFAULT_TEMPLATE (lms/certificate_assets/certificate_template.docx)
    """

    def __init__(self, template_model=None):
        """
        template_model — ixtiyoriy CertificateTemplate instance.
        Agar berilsa, uning docx_file.path dan foydalaniladi.
        """
        self.template_model = template_model

    # ── Template yo'lini aniqlash ─────────────────────────────────────────────

    def _resolve_template(self, override_path: Optional[str | Path] = None) -> Path:
        if override_path:
            p = Path(override_path)
            if p.exists():
                return p
            raise FileNotFoundError(f"Shablon topilmadi: {override_path}")

        if self.template_model and hasattr(self.template_model, "docx_file"):
            df = self.template_model.docx_file
            if df and df.name:
                p = Path(df.path)
                if p.exists():
                    return p
                logger.warning("CertificateTemplate.docx_file mavjud emas: %s", p)

        if not DEFAULT_TEMPLATE.exists():
            try:
                from lms.utils.default_certificate_docx import write_default_certificate_docx_if_missing

                write_default_certificate_docx_if_missing(BASE_DIR)
            except OSError:
                logger.exception("Standart sertifikat shablonini yozib bo'lmadi")

        if DEFAULT_TEMPLATE.exists():
            return DEFAULT_TEMPLATE

        raise FileNotFoundError(
            f"Sertifikat shabloni topilmadi. "
            f"Iltimos {DEFAULT_TEMPLATE} ga shablon faylini joylashtiring "
            f"yoki admin paneldan CertificateTemplate.docx_file yuklang."
        )

    def _certificate_context_values(
        self,
        *,
        student,
        course,
        serial: str,
        score: int | float = 0,
        max_score: int | float = 100,
        hours: int = 0,
        issued_by: str = "",
        position: str = "",
        issued_date: Optional[date] = None,
    ) -> dict:
        """DOCX/HTML uchun bir xil matn maydonlari (qr_placeholder / qr_data_url dan tashqari)."""
        issued_date = issued_date or date.today()
        verify_url = self._build_verify_url(serial)

        m = self.template_model
        ctx_issued_by = issued_by or (m.issued_by if m else "") or getattr(settings, "LMS_RECTOR_NAME", "")
        ctx_position = position or (m.position if m else "") or getattr(
            settings, "LMS_RECTOR_POSITION", "Muassasa rahbari"
        )
        ctx_inst = (m.institution_name if m else "") or getattr(
            settings, "LMS_INSTITUTION_NAME", "O'ZBEKISTON XALQARO ISLOM AKADEMIYASI"
        )
        ctx_hours = hours or (m.hours_per_course if m else None) or 0
        score_f = float(score)
        score_str = str(int(score_f)) if score_f == int(score_f) else str(round(score_f, 1))

        return {
            "institution_name": ctx_inst,
            "student_name": self._full_name(student),
            "course_name": course.title,
            "certificate_date": self._format_date(issued_date),
            "serial_number": serial,
            "hours": str(ctx_hours) if ctx_hours else "—",
            "score": score_str,
            "max_score": str(max_score),
            "issued_by": ctx_issued_by,
            "position": ctx_position,
            "verify_url": verify_url,
        }

    def build_display_context(
        self,
        *,
        student,
        course,
        serial: str,
        score: int | float = 0,
        max_score: int | float = 100,
        hours: int = 0,
        issued_by: str = "",
        position: str = "",
        issued_date: Optional[date] = None,
    ) -> dict:
        """
        HTML chop etish sahifasi uchun kontekst (QR — data URL).
        Brauzer «Chop etish → PDF ga saqlash» bilan serverda konvertor talab qilmaydi.
        """
        vals = self._certificate_context_values(
            student=student,
            course=course,
            serial=serial,
            score=score,
            max_score=max_score,
            hours=hours,
            issued_by=issued_by,
            position=position,
            issued_date=issued_date,
        )
        qr_buf = _build_qr_image(vals["verify_url"], size_mm=28)
        b64 = base64.b64encode(qr_buf.getvalue()).decode("ascii")
        vals["qr_data_url"] = f"data:image/png;base64,{b64}"
        return vals

    # ── Asosiy generate metodi ────────────────────────────────────────────────

    def generate(
        self,
        *,
        student,                     # User instance
        course,                      # Course instance
        serial: str,
        score: int | float = 0,
        max_score: int | float = 100,
        hours: int = 0,
        issued_by: str = "",
        position: str = "",
        issued_date: Optional[date] = None,
        template_path: Optional[str | Path] = None,
        as_docx: bool = False,       # True → DOCX qaytaradi (PDF o'rniga)
    ) -> bytes:
        """
        Sertifikat generatsiya qiladi.

        Qaytaradi: PDF (yoki as_docx=True bo'lsa DOCX) baytlari.
        """
        template_path = self._resolve_template(template_path)

        vals = self._certificate_context_values(
            student=student,
            course=course,
            serial=serial,
            score=score,
            max_score=max_score,
            hours=hours,
            issued_by=issued_by,
            position=position,
            issued_date=issued_date,
        )
        qr_buf = _build_qr_image(vals["verify_url"], size_mm=28)

        tpl = DocxTemplate(str(template_path))

        qr_image = InlineImage(tpl, qr_buf, width=Mm(28), height=Mm(28))

        context = {**vals, "qr_placeholder": qr_image}

        tpl.render(context)

        if as_docx:
            buf = io.BytesIO()
            tpl.save(buf)
            buf.seek(0)
            return buf.read()

        # DOCX → vaqtinchalik fayl → PDF
        with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
            tpl.save(tmp.name)
            tmp_path = tmp.name

        try:
            pdf_bytes = _docx_to_pdf(tmp_path)
        finally:
            os.unlink(tmp_path)

        return pdf_bytes

    # ── Yordamchi metodlar ────────────────────────────────────────────────────

    @staticmethod
    def _full_name(user) -> str:
        name = user.get_full_name().strip()
        return name if name else user.username

    @staticmethod
    def _format_date(d: date) -> str:
        MONTHS_UZ = [
            "", "yanvar", "fevral", "mart", "aprel", "may", "iyun",
            "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
        ]
        return f"{d.day}-{MONTHS_UZ[d.month]} {d.year}"

    @staticmethod
    def _build_verify_url(serial: str) -> str:
        v = getattr(settings, "CERTIFICATE_VERIFY_BASE_URL", "") or ""
        if v:
            return f"{v}{serial}"
        lm = getattr(settings, "LMS_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
        return f"{lm}/verify/{serial}"
