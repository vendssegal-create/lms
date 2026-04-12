from django.db import migrations


def forward(apps, schema_editor):
    SidebarMenu = apps.get_model("users", "SidebarMenu")
    SidebarMenu.objects.filter(key="legacy-retake-schedules").update(
        label="Retake schedules",
        spa_path="/retake/schedules",
        description="Retake schedules SPA sahifasi",
    )


def backward(apps, schema_editor):
    SidebarMenu = apps.get_model("users", "SidebarMenu")
    SidebarMenu.objects.filter(key="legacy-retake-schedules").update(
        label="Dars jadvallari",
        spa_path="/legacy/retake/db-manager/schedules/",
        description="Retake dars jadvallari",
    )


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0008_update_manage_groups_sidebar_path"),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
