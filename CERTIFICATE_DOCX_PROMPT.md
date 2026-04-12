# 🎓 DOCX-Based Certificate System — Senior Fullstack Prompt

## Loyiha konteksti

**Stack:** Django 5 · Python 3.11 · `docxtpl` · `qrcode` · `Pillow` · LibreOffice headless  
**Mavjud:** `lms/models.py` → `CertificateTemplate`, `UserCertificate`  
**Muammo:** Hozirgi `generate_certificate_pdf_content()` HTML+xhtml2pdf ishlatadi → cheklangan dizayn, QR kod pozitsiyasi noaniq, shablon yuklash yo'q  
**Maqsad:** DOCX shablon yuklash → placeholderlarni to'ldirish → QR kod joylashtirish → PDF eksport

---

## 📁 QADAM 1 — Kerakli paketlar

```bash
pip install docxtpl qrcode[pil] Pillow --break-system-packages
```

`core/requirements.txt` yoki `requirements.txt` ga qo'shing:
```
docxtpl>=1.2.0
qrcode[pil]>=7.4
Pillow>=10.0
```

---

## 📁 QADAM 2 — `CertificateTemplate` modeli yangilash

### `lms/models.py` — `CertificateTemplate` ga yangi fieldlar:

```python
class CertificateTemplate(models.Model):
    name             = models.CharField(max_length=200)
    background_image = models.ImageField(upload_to='certificate_templates/', null=True, blank=True)

    # ── Yangi fieldlar ──────────────────────────────────────────────────────
    docx_file        = models.FileField(
        upload_to='certificate_templates/docx/',
        null=True, blank=True,
        help_text="DOCX shablon fayli. Ichida {{student_name}}, {{course_name}}, "
                  "{{certificate_date}}, {{serial_number}}, {{hours}}, {{score}}, "
                  "{{max_score}}, {{issued_by}}, {{position}}, {{verify_url}}, "
                  "{{qr_placeholder}} placeholder'lari bo'lishi kerak."
    )
    generation_mode  = models.CharField(
        max_length=8,
        choices=[("html", "HTML (xhtml2pdf)"), ("docx", "DOCX (LibreOffice)")],
        default="docx",
        help_text="DOCX rejimi tavsiya etiladi — yuqori sifatli PDF chiqaradi."
    )
    institution_name = models.CharField(
        max_length=255, blank=True, default="",
        help_text="Sertifikatda ko'rsatiladigan muassasa nomi"
    )
    issued_by        = models.CharField(
        max_length=200, blank=True, default="",
        help_text="Imzolagan shaxs (masalan: Prof. Karimov Alisher)"
    )
    position         = models.CharField(
        max_length=200, blank=True, default="",
        help_text="Imzolagan shaxs lavozimi (masalan: Rektor)"
    )
    hours_per_course = models.IntegerField(
        null=True, blank=True,
        help_text="Kurs soatlari soni — sertifikatda ko'rsatish uchun"
    )
    # ── Mavjud ──────────────────────────────────────────────────────────────
    html_template    = models.TextField(
        help_text="HTML shablon (generation_mode=html bo'lsa ishlatiladi).",
        blank=True, default=""
    )
    css_style        = models.TextField(blank=True, default="")
    course           = models.ForeignKey(
        'Course', on_delete=models.CASCADE, null=True, blank=True,
        related_name='certificate_templates'
    )
    is_active        = models.BooleanField(default=True)
    created_at       = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
```

### Migration:

```bash
python manage.py makemigrations lms --name="certificate_template_docx_fields"
python manage.py migrate
```

---

## 📁 QADAM 3 — Certificate Assets papkasini yaratish

```bash
mkdir -p lms/certificate_assets
# certificate_template.docx ni shu papkaga ko'chiring
cp /path/to/certificate_template.docx lms/certificate_assets/
```

`lms/certificate_assets/certificate_template.docx` — bu loyihada **bilan birga** git'ga commit qilinadi.

---

## 📁 QADAM 4 — `lms/services/certificate_docx_service.py`

```python
"""
lms/services/certificate_docx_service.py
─────────────────────────────────────────────────────────────────────────────
DOCX shablon → QR kod qo'yish → PDF eksport

Ishlatish:
    service  = CertificateDocxService(template_model=cert_template)
    pdf_bytes = service.generate(
        student=user, course=course,
        serial="CERT-2026-00042",
        score=95, max_score=100, hours=120,
    )
─────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations
import io, logging, os, subprocess, sys, tempfile
from datetime import date
from pathlib import Path
from typing import Optional

import qrcode, qrcode.constants
from django.conf import settings
from docx.shared import Mm
from docxtpl import DocxTemplate, InlineImage
from PIL import Image

logger = logging.getLogger(__name__)

BASE_DIR         = Path(settings.BASE_DIR)
DEFAULT_TEMPLATE = BASE_DIR / "lms" / "certificate_assets" / "certificate_template.docx"
_SOFFICE         = BASE_DIR / "scripts" / "office" / "soffice.py"  # LibreOffice wrapper


def _build_qr_image(data: str, size_mm: int = 28) -> io.BytesIO:
    """QR kod generatsiya — PNG BytesIO qaytaradi."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=8, border=2,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#1B3A6B", back_color="white")
    px  = int(size_mm * 300 / 25.4)   # 300 DPI
    img = img.resize((px, px), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


def _docx_to_pdf(docx_path: str | Path) -> bytes:
    """LibreOffice headless: DOCX → PDF baytlari."""
    docx_path = Path(docx_path)
    with tempfile.TemporaryDirectory() as tmpdir:
        # LibreOffice soffice orqali
        if _SOFFICE.exists():
            cmd = [sys.executable, str(_SOFFICE),
                   "--headless", "--convert-to", "pdf",
                   "--outdir", tmpdir, str(docx_path)]
        else:
            # Tizimda to'g'ridan-to'g'ri LibreOffice
            cmd = ["libreoffice", "--headless", "--convert-to", "pdf",
                   "--outdir", tmpdir, str(docx_path)]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
        if result.returncode != 0:
            raise RuntimeError(f"LibreOffice xatosi: {result.stderr[:300]}")

        pdf_path = Path(tmpdir) / (docx_path.stem + ".pdf")
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF topilmadi: {pdf_path}")
        return pdf_path.read_bytes()


class CertificateDocxService:

    MONTHS_UZ = ["","yanvar","fevral","mart","aprel","may","iyun",
                 "iyul","avgust","sentabr","oktabr","noyabr","dekabr"]

    def __init__(self, template_model=None):
        self.template_model = template_model

    def _resolve_template(self, override=None) -> Path:
        if override:
            p = Path(override)
            if p.exists(): return p
            raise FileNotFoundError(f"Shablon yo'q: {override}")
        if self.template_model:
            df = getattr(self.template_model, "docx_file", None)
            if df and df.name:
                p = Path(df.path)
                if p.exists(): return p
        if DEFAULT_TEMPLATE.exists():
            return DEFAULT_TEMPLATE
        raise FileNotFoundError(
            f"Sertifikat DOCX shabloni topilmadi: {DEFAULT_TEMPLATE}\n"
            "lms/certificate_assets/ papkasiga certificate_template.docx joylashtiring."
        )

    def _full_name(self, user) -> str:
        n = user.get_full_name().strip()
        return n or user.username

    def _format_date(self, d: date) -> str:
        return f"{d.day}-{self.MONTHS_UZ[d.month]} {d.year}"

    def _verify_url(self, serial: str) -> str:
        base = getattr(settings, "LMS_BASE_URL", "https://lms.example.uz")
        return f"{base}/verify/{serial}"

    def generate(
        self, *,
        student,
        course,
        serial: str,
        score: float = 0,
        max_score: float = 100,
        hours: int = 0,
        issued_by: str = "",
        position: str = "",
        issued_date: Optional[date] = None,
        template_path=None,
        as_docx: bool = False,
    ) -> bytes:
        """
        Sertifikat generatsiya qiladi.
        Qaytaradi: PDF baytlari (as_docx=True bo'lsa DOCX baytlari).
        """
        tmpl_path    = self._resolve_template(template_path)
        issued_date  = issued_date or date.today()
        verify_url   = self._verify_url(serial)

        # QR kod
        qr_buf = _build_qr_image(verify_url, size_mm=28)
        tpl    = DocxTemplate(str(tmpl_path))
        qr_img = InlineImage(tpl, qr_buf, width=Mm(28), height=Mm(28))

        # Template model fieldlaridan fallback
        m = self.template_model
        ctx_issued_by = issued_by or (m.issued_by if m else "") or \
                        getattr(settings, "LMS_RECTOR_NAME", "")
        ctx_position  = position  or (m.position  if m else "") or \
                        getattr(settings, "LMS_RECTOR_POSITION", "Muassasa rahbari")
        ctx_inst      = (m.institution_name if m else "") or \
                        getattr(settings, "LMS_INSTITUTION_NAME",
                                "O'ZBEKISTON XALQARO ISLOM AKADEMIYASI")
        ctx_hours     = hours or (m.hours_per_course if m else 0) or 0

        context = {
            "institution_name" : ctx_inst,
            "student_name"     : self._full_name(student),
            "course_name"      : course.title,
            "certificate_date" : self._format_date(issued_date),
            "serial_number"    : serial,
            "hours"            : str(ctx_hours) if ctx_hours else "—",
            "score"            : str(int(score) if score == int(score) else round(score, 1)),
            "max_score"        : str(max_score),
            "issued_by"        : ctx_issued_by,
            "position"         : ctx_position,
            "verify_url"       : verify_url,
            "qr_placeholder"   : qr_img,
        }

        tpl.render(context)

        if as_docx:
            buf = io.BytesIO()
            tpl.save(buf)
            buf.seek(0)
            return buf.read()

        with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
            tpl.save(tmp.name)
            tmp_docx = tmp.name
        try:
            return _docx_to_pdf(tmp_docx)
        finally:
            os.unlink(tmp_docx)
```

---

## 📁 QADAM 5 — `lms/api_views.py` — sertifikat download endpoint

Mavjud `course_certificate_download()` funksiyasini quyidagicha to'liq almashtiring:

```python
@login_required_api
def course_certificate_download(request, course_id):
    """
    GET /api/lms/courses/<id>/certificate/
    Query params:
      ?format=pdf   (standart)
      ?format=docx  (DOCX yuklab olish)
      ?regen=1      (mavjud sertifikatni qayta generatsiya qilish)
    """
    from lms.services.certificate_docx_service import CertificateDocxService
    from lms.services.certificate_service import (
        check_certificate_eligibility, issue_certificate
    )
    from django.core.files.base import ContentFile

    course = get_object_or_404(Course, id=course_id)
    fmt    = request.GET.get("format", "pdf")  # "pdf" | "docx"
    regen  = request.GET.get("regen", "0") == "1"

    # 1) Talaba sertifikat olishga haqliligini tekshirish
    is_eligible, result = check_certificate_eligibility(request.user, course)
    if not is_eligible:
        return JsonResponse({"error": result}, status=403)

    template = result  # CertificateTemplate instance

    # 2) UserCertificate olish yoki yaratish
    user_cert, created = UserCertificate.objects.get_or_create(
        user=request.user,
        course=course,
        defaults={
            "template"      : template,
            "serial_number" : _generate_serial(request.user, course),
            "qr_data"       : "",
        }
    )
    if created or not user_cert.serial_number:
        user_cert.serial_number = _generate_serial(request.user, course)
    verify_url = getattr(settings, "LMS_BASE_URL", "https://lms.example.uz") + \
                 f"/verify/{user_cert.serial_number}"
    if not user_cert.qr_data:
        user_cert.qr_data = verify_url
        user_cert.save(update_fields=["qr_data", "serial_number"])

    # 3) Generation mode tanlash
    use_docx_mode = (
        getattr(template, "generation_mode", "docx") == "docx"
        or getattr(template, "docx_file", None)
        or (BASE_DIR / "lms" / "certificate_assets" / "certificate_template.docx").exists()
    )

    if use_docx_mode:
        # ── DOCX/PDF via docxtpl + LibreOffice ──────────────────────────────
        if not regen and user_cert.pdf_file and fmt == "pdf":
            # Kesh — avvalgi PDF
            return _pdf_response(user_cert.pdf_file.read(),
                                  user_cert.serial_number)

        service = CertificateDocxService(template_model=template)

        # Ball va soatlarni GradebookEntry dan olish
        score, max_score, hours = _get_grade_info(request.user, course, template)

        try:
            if fmt == "docx":
                content = service.generate(
                    student=request.user, course=course,
                    serial=user_cert.serial_number,
                    score=score, max_score=max_score, hours=hours,
                    as_docx=True,
                )
                resp = HttpResponse(
                    content,
                    content_type=(
                        "application/vnd.openxmlformats-officedocument"
                        ".wordprocessingml.document"
                    ),
                )
                fname = f"sertifikat_{user_cert.serial_number}.docx"
                resp["Content-Disposition"] = f'attachment; filename="{fname}"'
                return resp

            else:
                pdf_bytes = service.generate(
                    student=request.user, course=course,
                    serial=user_cert.serial_number,
                    score=score, max_score=max_score, hours=hours,
                )
                # PDF ni model ga saqlash (kesh uchun)
                fname = f"cert_{user_cert.serial_number}.pdf"
                user_cert.pdf_file.save(fname, ContentFile(pdf_bytes), save=True)
                return _pdf_response(pdf_bytes, user_cert.serial_number)

        except Exception as exc:
            logger.exception("DOCX sertifikat generatsiya xatosi: %s", exc)
            return JsonResponse({"error": str(exc)}, status=500)

    else:
        # ── Fallback: eski HTML/xhtml2pdf rejimi ────────────────────────────
        from lms.services.certificate_service import generate_certificate_pdf_content
        pdf = generate_certificate_pdf_content(user_cert)
        if not pdf:
            return JsonResponse({"error": "PDF generatsiya muvaffaqiyatsiz."}, status=500)
        return _pdf_response(pdf, user_cert.serial_number)


def _generate_serial(user, course) -> str:
    """Noyob seriya raqam: CERT-YYYY-{user_id:05d}{course_id:04d}"""
    from django.utils import timezone
    prefix = getattr(settings, "CERTIFICATE_SERIAL_PREFIX", "CERT")
    year   = timezone.now().year
    return f"{prefix}-{year}-{user.id:05d}{course.id:04d}"


def _get_grade_info(user, course, template):
    """Ball va soatlarni GradebookEntry dan oladi."""
    score = max_score = hours = 0
    try:
        from lms.models import GradebookEntry
        entry = GradebookEntry.objects.filter(
            gradebook__course=course, student=user
        ).first()
        if entry and entry.total_score is not None:
            score     = float(entry.total_score)
            max_score = float(entry.gradebook.current_max +
                              entry.gradebook.midterm_max +
                              entry.gradebook.final_max)
    except Exception:
        pass
    if template and template.hours_per_course:
        hours = template.hours_per_course
    return score, max_score, hours


def _pdf_response(pdf_bytes: bytes, serial: str):
    from django.http import HttpResponse
    resp = HttpResponse(pdf_bytes, content_type="application/pdf")
    resp["Content-Disposition"] = (
        f'attachment; filename="sertifikat_{serial}.pdf"'
    )
    return resp
```

---

## 📁 QADAM 6 — Sertifikatni tekshirish (verify) endpoint

### `lms/api_views.py` ga qo'shing:

```python
def certificate_verify(request, serial):
    """
    GET /verify/<serial>/
    QR koddan skanerlaganda sertifikatni tasdiqlash.
    JSON javob qaytaradi (SPA → o'z sahifasida ko'rsatadi).
    """
    from lms.models import UserCertificate
    cert = UserCertificate.objects.filter(serial_number=serial).first()
    if not cert:
        return JsonResponse({
            "valid"  : False,
            "message": "Sertifikat topilmadi yoki haqiqiy emas.",
        }, status=404)

    student_name = cert.user.get_full_name() or cert.user.username
    return JsonResponse({
        "valid"          : True,
        "serial_number"  : cert.serial_number,
        "student_name"   : student_name,
        "course_name"    : cert.course.title,
        "issued_at"      : cert.issued_at.strftime("%d.%m.%Y"),
        "institution"    : getattr(settings, "LMS_INSTITUTION_NAME", ""),
        "message"        : "Sertifikat haqiqiy va tekshirildi ✅",
    })
```

### `lms/api_urls.py` ga qo'shing:

```python
path("verify/<str:serial>/", views.certificate_verify, name="certificate_verify"),
```

---

## 📁 QADAM 7 — `settings.py` — yangi konfiguratsiya konstantalari

```python
# ── Certificate settings ──────────────────────────────────────────────────────
LMS_BASE_URL            = "https://lms.example.uz"   # Ishlab chiqarish URL
LMS_INSTITUTION_NAME    = "O'ZBEKISTON XALQARO ISLOM AKADEMIYASI"
LMS_RECTOR_NAME         = "Prof. Karimov Alisher"
LMS_RECTOR_POSITION     = "Akademiya rektori"
CERTIFICATE_SERIAL_PREFIX = "CERT"
```

---

## 📁 QADAM 8 — Django Admin integratsiyasi

### `lms/admin.py` ga qo'shing:

```python
from django.contrib import admin
from django.utils.html import format_html
from lms.models import CertificateTemplate, UserCertificate


@admin.register(CertificateTemplate)
class CertificateTemplateAdmin(admin.ModelAdmin):
    list_display  = ["name", "course", "generation_mode", "is_active",
                     "docx_preview", "created_at"]
    list_filter   = ["generation_mode", "is_active", "course"]
    search_fields = ["name", "institution_name"]
    fieldsets = [
        ("Asosiy", {
            "fields": ["name", "course", "is_active", "generation_mode"]
        }),
        ("DOCX shablon (tavsiya etiladi)", {
            "fields": ["docx_file", "institution_name", "issued_by",
                       "position", "hours_per_course"],
            "description": (
                "DOCX shablonga quyidagi placeholder'larni kiriting: "
                "{{student_name}}, {{course_name}}, {{certificate_date}}, "
                "{{serial_number}}, {{hours}}, {{score}}, {{max_score}}, "
                "{{issued_by}}, {{position}}, {{verify_url}}, {{qr_placeholder}}"
            ),
        }),
        ("HTML shablon (eski usul)", {
            "fields"  : ["html_template", "css_style", "background_image"],
            "classes" : ["collapse"],
        }),
    ]

    def docx_preview(self, obj):
        if obj.docx_file and obj.docx_file.name:
            return format_html(
                '<a href="{}" target="_blank">📄 DOCX yuklab olish</a>',
                obj.docx_file.url
            )
        return "—"
    docx_preview.short_description = "DOCX fayl"


@admin.register(UserCertificate)
class UserCertificateAdmin(admin.ModelAdmin):
    list_display   = ["serial_number", "user", "course", "issued_at", "pdf_link"]
    list_filter    = ["course", "issued_at"]
    search_fields  = ["serial_number", "user__username",
                      "user__first_name", "user__last_name"]
    readonly_fields = ["serial_number", "issued_at", "qr_data", "pdf_file"]
    actions        = ["regenerate_pdf"]

    def pdf_link(self, obj):
        if obj.pdf_file and obj.pdf_file.name:
            return format_html(
                '<a href="{}" target="_blank">📥 PDF</a>', obj.pdf_file.url
            )
        return "—"
    pdf_link.short_description = "PDF"

    @admin.action(description="Tanlangan sertifikatlarni PDF qayta generatsiya qilish")
    def regenerate_pdf(self, request, queryset):
        from lms.services.certificate_docx_service import CertificateDocxService
        from django.core.files.base import ContentFile

        count = 0
        errors = []
        for cert in queryset.select_related("user", "course", "template"):
            try:
                service = CertificateDocxService(template_model=cert.template)
                pdf = service.generate(
                    student=cert.user, course=cert.course,
                    serial=cert.serial_number,
                )
                fname = f"cert_{cert.serial_number}.pdf"
                cert.pdf_file.save(fname, ContentFile(pdf), save=True)
                count += 1
            except Exception as e:
                errors.append(f"{cert.serial_number}: {e}")

        msg = f"{count} ta sertifikat qayta generatsiya qilindi."
        if errors:
            msg += f" Xatolar: {'; '.join(errors[:3])}"
        self.message_user(request, msg)
```

---

## 📁 QADAM 9 — Frontend: Sertifikat yuklab olish tugmasi

### `design/src/pages/CourseDetailPage.tsx` va `design/src/api/lms.ts` ga qo'shing:

```typescript
// ── api/lms.ts ─────────────────────────────────────────────────────────────
export async function downloadCertificate(
  courseId: number,
  format: 'pdf' | 'docx' = 'pdf',
  regen = false
): Promise<void> {
  const params = new URLSearchParams({ format });
  if (regen) params.set('regen', '1');

  const res = await apiFetch(
    `/api/lms/courses/${courseId}/certificate/?${params}`,
    { method: 'GET' }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Yuklab olishda xatolik' }));
    throw new Error(err.error || 'Sertifikat yuklab olishda xatolik');
  }

  const blob     = await res.blob();
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  const ext      = format === 'docx' ? 'docx' : 'pdf';
  a.href         = url;
  a.download     = `sertifikat_kurs_${courseId}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### `CourseDetailPage.tsx` — sertifikat panel:

```tsx
// Sertifikat yuklab olish tugmasi komponenti
function CertificatePanel({ courseId, isEligible }: {
  courseId: number;
  isEligible: boolean;
}) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState<'pdf' | 'docx' | null>(null);

  async function handleDownload(fmt: 'pdf' | 'docx') {
    setLoading(fmt);
    try {
      await downloadCertificate(courseId, fmt);
      success(
        fmt === 'pdf' ? '📥 PDF yuklab olindi' : '📄 DOCX yuklab olindi',
        'Sertifikatingiz tayyor!'
      );
    } catch (err) {
      error('Xatolik', err instanceof Error ? err.message : 'Yuklab olishda xatolik');
    } finally {
      setLoading(null);
    }
  }

  if (!isEligible) {
    return (
      <div className="card p-6 border-dashed border-2 border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center
                          rounded-2xl bg-amber-50">
            <Award className="text-amber-500" size={20} />
          </div>
          <div>
            <p className="text-sm font-black text-text-primary">Sertifikat</p>
            <p className="text-xs font-medium text-text-secondary">
              Sertifikat olish uchun kurs shartlarini bajaring
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card overflow-hidden"
    >
      {/* Gold gradient header */}
      <div className="bg-gradient-to-r from-amber-500 to-yellow-400 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center
                          rounded-2xl bg-white/20 backdrop-blur-sm">
            <Award className="text-white" size={24} />
          </div>
          <div>
            <p className="text-lg font-black text-white">Tabriklaymiz! 🎉</p>
            <p className="text-sm font-medium text-white/80">
              Siz sertifikat olishga haqlirsiz
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-3">
        <p className="text-xs font-medium text-text-secondary">
          Sertifikatingizni quyidagi formatda yuklab oling:
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {/* PDF */}
          <button
            type="button"
            onClick={() => void handleDownload('pdf')}
            disabled={loading !== null}
            className="btn btn-primary flex flex-1 items-center justify-center gap-2 py-3"
          >
            {loading === 'pdf' ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <FileDown size={16} />
            )}
            PDF yuklab olish
          </button>

          {/* DOCX */}
          <button
            type="button"
            onClick={() => void handleDownload('docx')}
            disabled={loading !== null}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl
                       border border-border bg-white px-4 py-3 text-sm font-bold
                       text-text-primary transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {loading === 'docx' ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <FileText size={16} />
            )}
            DOCX yuklab olish
          </button>
        </div>

        <p className="text-[11px] font-medium text-text-secondary text-center">
          QR kod orqali tekshirish mumkin
        </p>
      </div>
    </motion.div>
  );
}
```

---

## 📁 QADAM 10 — Sertifikat tekshirish sahifasi (SPA)

### Yangi fayl: `design/src/pages/CertificateVerifyPage.tsx`

```tsx
/**
 * /verify/:serial — QR kod orqali sertifikatni tekshirish sahifasi
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Award, CheckCircle2, XCircle, LoaderCircle } from 'lucide-react';

interface VerifyResult {
  valid: boolean;
  serial_number?: string;
  student_name?: string;
  course_name?: string;
  issued_at?: string;
  institution?: string;
  message: string;
}

async function verifyCertificate(serial: string): Promise<VerifyResult> {
  const res = await fetch(`/api/lms/verify/${serial}/`);
  return res.json();
}

export default function CertificateVerifyPage() {
  const { serial } = useParams<{ serial: string }>();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!serial) return;
    verifyCertificate(serial)
      .then(setResult)
      .catch(() => setResult({ valid: false, message: "Tekshirishda xatolik yuz berdi." }))
      .finally(() => setLoading(false));
  }, [serial]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoaderCircle className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md rounded-3xl border border-border bg-white
                   p-8 shadow-[0_24px_72px_rgba(0,0,0,0.12)]"
      >
        {result?.valid ? (
          <>
            {/* Valid */}
            <div className="flex flex-col items-center text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="flex h-20 w-20 items-center justify-center rounded-full
                           bg-emerald-50 ring-8 ring-emerald-50/50"
              >
                <CheckCircle2 className="text-emerald-500" size={40} />
              </motion.div>
              <h1 className="mt-5 text-2xl font-black text-text-primary">
                Sertifikat haqiqiy ✅
              </h1>
              <p className="mt-2 text-sm font-medium text-emerald-600">
                {result.message}
              </p>
            </div>

            <div className="mt-6 space-y-3 rounded-2xl bg-slate-50 p-5">
              {[
                ["Talaba",     result.student_name],
                ["Kurs",       result.course_name],
                ["Berilgan",   result.issued_at],
                ["Seriya",     result.serial_number],
                ["Muassasa",   result.institution],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-xs font-bold uppercase tracking-wide text-text-secondary">
                    {label}
                  </span>
                  <span className="text-right text-sm font-bold text-text-primary">
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-center gap-2">
              <Award className="text-amber-500" size={18} />
              <p className="text-xs font-medium text-text-secondary">
                Bu sertifikat rasman tasdiqlangan
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Invalid */}
            <div className="flex flex-col items-center text-center">
              <div className="flex h-20 w-20 items-center justify-center
                              rounded-full bg-rose-50">
                <XCircle className="text-rose-500" size={40} />
              </div>
              <h1 className="mt-5 text-2xl font-black text-text-primary">
                Sertifikat topilmadi
              </h1>
              <p className="mt-2 text-sm font-medium text-rose-500">
                {result?.message}
              </p>
              <p className="mt-4 text-xs text-text-secondary">
                Seriya raqami: <code className="font-mono font-bold">{serial}</code>
              </p>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
```

### `design/src/app/router.tsx` ga qo'shing:

```tsx
const CertificateVerifyPage = lazy(() => import('@/src/pages/CertificateVerifyPage'));

// AppShell TASHQARISIDA (login talab qilmaydi — barcha scan qilishi mumkin):
<Route path="/verify/:serial" element={<CertificateVerifyPage />} />
```

---

## 📁 QADAM 11 — DOCX Shablon Placeholder jadvali

Shablon ichida **aynan quyidagi** `{{variable}}` formatida yozing:

| Placeholder           | Ma'nosi                        | Misol                              |
|-----------------------|--------------------------------|------------------------------------|
| `{{institution_name}}`| Muassasa nomi                  | O'ZBEKISTON XALQARO ISLOM AKADEMIYASI |
| `{{student_name}}`    | Talaba to'liq ismi             | Abdullayev Jasur Baxtiyorovich     |
| `{{course_name}}`     | Kurs nomi                      | Django va React bilan dasturlash   |
| `{{certificate_date}}`| Berilgan sana                  | 10-aprel 2026                      |
| `{{serial_number}}`   | Seriya raqami                  | CERT-2026-00042                    |
| `{{hours}}`           | Kurs soatlari                  | 120                                |
| `{{score}}`           | Talaba bali                    | 95                                 |
| `{{max_score}}`       | Maksimal bal                   | 100                                |
| `{{issued_by}}`       | Imzolagan shaxs ismi           | Prof. Karimov Alisher              |
| `{{position}}`        | Imzolagan shaxs lavozimi       | Akademiya rektori                  |
| `{{verify_url}}`      | Tekshirish URL                 | https://lms.example.uz/verify/...  |
| `{{qr_placeholder}}`  | **QR kod rasmi (avtomatik)**   | *(rasm joylashtiriladi)*           |

> ⚠️ **Muhim:** `{{qr_placeholder}}` yolg'iz paragrafda bo'lishi va Word'da oddiy matn sifatida yozilishi kerak. `docxtpl` uni `InlineImage` bilan almashtiradi.

---

## 📁 QADAM 12 — LibreOffice yo'l sozlamasi

Agar server da LibreOffice o'rnatilmagan bo'lsa:

```bash
# Ubuntu/Debian
sudo apt-get install -y libreoffice libreoffice-writer

# Docker ichida
RUN apt-get install -y libreoffice --no-install-recommends
```

`settings.py` ga LibreOffice yo'lini ko'rsatish (ixtiyoriy):

```python
LIBREOFFICE_PATH = "/usr/bin/libreoffice"   # standart
# yoki macOS:
# LIBREOFFICE_PATH = "/Applications/LibreOffice.app/Contents/MacOS/soffice"
```

`_docx_to_pdf()` funksiyasida foydalanish:

```python
import shutil
lo_path = getattr(settings, "LIBREOFFICE_PATH", None) or shutil.which("libreoffice") or "soffice"
cmd = [lo_path, "--headless", "--convert-to", "pdf", "--outdir", tmpdir, str(docx_path)]
```

---

## ✅ Yakuniy Tekshiruv Ro'yxati

### Backend
- [ ] `CertificateTemplate` modeli `docx_file`, `generation_mode`, `issued_by`, `position`, `hours_per_course` fieldlari bilan yangilandi
- [ ] Migration bajarildi (`makemigrations lms && migrate`)
- [ ] `lms/certificate_assets/certificate_template.docx` fayl mavjud
- [ ] `CertificateDocxService.generate()` PDF qaytaradi
- [ ] `course_certificate_download()` DOCX/PDF formatlarni qaytaradi
- [ ] `certificate_verify()` endpoint QR skanerlaganda JSON qaytaradi
- [ ] `settings.py` da `LMS_BASE_URL`, `LMS_INSTITUTION_NAME` to'g'ri
- [ ] `pip install docxtpl qrcode[pil] Pillow` o'rnatildi
- [ ] LibreOffice o'rnatildi va ishlaydi

### Frontend
- [ ] `downloadCertificate(courseId, 'pdf')` va `downloadCertificate(courseId, 'docx')` ishlaydi
- [ ] `CertificatePanel` kursi eligibility bo'lsa ko'rinadi
- [ ] `CertificateVerifyPage` QR skanerlaganda ochiladi
- [ ] `/verify/:serial` route `AppShell` tashqarisida (login talab qilmaydi)

### Admin panel
- [ ] `CertificateTemplateAdmin` → DOCX fayl yuklab olish va yuklash
- [ ] "Qayta generatsiya" admin action ishlaydi
- [ ] `UserCertificateAdmin` → PDF yuklab olish havolasi ko'rinadi

---

## 📦 Shablon fayli tarqatish

`certificate_template.docx` faylini loyihaga qo'shing:

```
lms/
  certificate_assets/
    certificate_template.docx   ← Git'ga commit qiling
    README.md                    ← Placeholder hujjati
```

Admin DOCX upload ham ishlasin deb `MEDIA_ROOT/certificate_templates/docx/` papkasi yoziladigan bo'lishi kerak.

---

*Ushbu prompt Django LMS loyihasining `lms/models.py`, `lms/services/certificate_service.py`, `lms/api_views.py`, `design/src/app/router.tsx` va `design/src/features/auth/auth-context.tsx` fayllari asosida yozilgan. `docxtpl` + `qrcode` + LibreOffice zanjiri — zamonaviy LMS sertifikat standartiga mos keladi.*
