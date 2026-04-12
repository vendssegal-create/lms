from django.db import migrations


def forward(apps, schema_editor):
    SidebarMenu = apps.get_model("users", "SidebarMenu")
    SidebarMenu.objects.filter(key="legacy-retake-cycles").update(
        label="Retake cycles",
        spa_path="/retake/cycles",
        description="Retake cycles SPA sahifasi",
    )


def backward(apps, schema_editor):
    SidebarMenu = apps.get_model("users", "SidebarMenu")
    SidebarMenu.objects.filter(key="legacy-retake-cycles").update(
        label="Retake sikllari",
        spa_path="/legacy/retake/cycles/",
        description="Retake davrlari va sikllari",
    )


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0006_update_teacher_groups_sidebar_path"),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
