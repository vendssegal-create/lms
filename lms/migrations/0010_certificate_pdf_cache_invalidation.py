# Generated manually: PDF keshini shablon yangilanishiga bog‘lash

import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("lms", "0009_certificate_docx_only_remove_html"),
    ]

    operations = [
        migrations.AddField(
            model_name="certificatetemplate",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="usercertificate",
            name="pdf_generated_at",
            field=models.DateTimeField(
                blank=True,
                help_text="PDF oxirgi marta generatsiya qilingan vaqt; shablon updated_at dan eski bo‘lsa qayta ishlab chiqariladi.",
                null=True,
            ),
        ),
    ]
