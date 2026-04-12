from django.db import migrations


def forward(apps, schema_editor):
    SidebarMenu = apps.get_model("users", "SidebarMenu")
    SidebarMenu.objects.filter(key="legacy-retake-teacher-groups").update(
        label="Teacher groups",
        spa_path="/retake/teacher/groups",
        description="Retake teacher groups SPA sahifasi",
    )


def backward(apps, schema_editor):
    SidebarMenu = apps.get_model("users", "SidebarMenu")
    SidebarMenu.objects.filter(key="legacy-retake-teacher-groups").update(
        label="Retake teacher groups",
        spa_path="/legacy/retake/teacher/groups/",
        description="Retake o'qituvchi guruhlari",
    )


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0005_seed_sidebar_navigation"),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
