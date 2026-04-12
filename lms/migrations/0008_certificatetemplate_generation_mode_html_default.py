# Generated manually — mavjud HTML shablonlar DOCX sifatida talab qilmasin.

from django.db import migrations, models


def set_html_mode_without_docx(apps, schema_editor):
    CertificateTemplate = apps.get_model("lms", "CertificateTemplate")
    for t in CertificateTemplate.objects.all():
        if not t.docx_file:
            t.generation_mode = "html"
            t.save(update_fields=["generation_mode"])


class Migration(migrations.Migration):

    dependencies = [
        ("lms", "0007_certificate_template_docx_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="certificatetemplate",
            name="generation_mode",
            field=models.CharField(
                choices=[("html", "HTML (xhtml2pdf)"), ("docx", "DOCX (LibreOffice)")],
                default="html",
                help_text="DOCX — yuqori sifatli PDF; HTML — mavjud loyihalar uchun standart.",
                max_length=8,
            ),
        ),
        migrations.RunPython(set_html_mode_without_docx, migrations.RunPython.noop),
    ]
