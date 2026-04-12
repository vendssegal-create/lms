from django.db import migrations


def forward(apps, schema_editor):
    SidebarMenu = apps.get_model("users", "SidebarMenu")
    SidebarMenu.objects.filter(key="legacy-retake-exam-calendar").update(
        label="Exam calendar",
        spa_path="/retake/exam-calendar",
        description="Retake exam calendar SPA sahifasi",
    )


def backward(apps, schema_editor):
    SidebarMenu = apps.get_model("users", "SidebarMenu")
    SidebarMenu.objects.filter(key="legacy-retake-exam-calendar").update(
        label="Imtihon kalendari",
        spa_path="/legacy/retake/db-manager/exam-calendar/",
        description="Retake imtihon kalendari",
    )


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0009_update_schedules_sidebar_path"),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
