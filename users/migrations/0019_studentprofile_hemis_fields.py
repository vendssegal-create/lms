from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('hemis', '0001_initial'),
        ('users', '0018_rename_retake_applications_sidebar_label'),
    ]

    operations = [
        migrations.AddField(
            model_name='studentprofile',
            name='hemis_student_id',
            field=models.BigIntegerField(
                blank=True,
                help_text='HEMIS ichki talaba ID (HemisStudentSnapshot.hemis_student_id bilan mos)',
                null=True,
                unique=True,
            ),
        ),
        migrations.AddField(
            model_name='studentprofile',
            name='hemis_snapshot',
            field=models.OneToOneField(
                blank=True,
                help_text="HEMIS snapshot bilan to'g'ridan-to'g'ri bog'liq",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='student_profile',
                to='hemis.hemisstudentsnapshot',
            ),
        ),
    ]
