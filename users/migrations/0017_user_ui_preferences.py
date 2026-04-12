from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0016_enforce_spa_paths_for_legacy_sidebar_keys"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="ui_preferences",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
