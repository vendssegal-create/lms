from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("hemis", "0003_hemisstudentdebt_control_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="hemisroomsnapshot",
            name="building_code",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="hemisroomsnapshot",
            name="floor",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
    ]
