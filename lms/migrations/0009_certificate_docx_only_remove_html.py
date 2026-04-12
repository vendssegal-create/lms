# Sertifikat faqat DOCX — HTML/CSS/background/generation_mode olib tashlandi.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("lms", "0008_certificatetemplate_generation_mode_html_default"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="certificatetemplate",
            name="background_image",
        ),
        migrations.RemoveField(
            model_name="certificatetemplate",
            name="css_style",
        ),
        migrations.RemoveField(
            model_name="certificatetemplate",
            name="generation_mode",
        ),
        migrations.RemoveField(
            model_name="certificatetemplate",
            name="html_template",
        ),
    ]
