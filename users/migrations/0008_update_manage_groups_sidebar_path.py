from django.db import migrations


def forward(apps, schema_editor):
    SidebarMenu = apps.get_model("users", "SidebarMenu")
    SidebarMenu.objects.filter(key="legacy-retake-groups").update(
        label="Retake groups",
        spa_path="/retake/groups",
        description="Retake groups SPA sahifasi",
    )


def backward(apps, schema_editor):
    SidebarMenu = apps.get_model("users", "SidebarMenu")
    SidebarMenu.objects.filter(key="legacy-retake-groups").update(
        label="Retake guruhlari",
        spa_path="/legacy/retake/db-manager/groups/",
        description="Retake guruhlarini boshqarish",
    )


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0007_update_cycles_sidebar_path"),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
