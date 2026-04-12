from django.db import migrations


def forward(apps, schema_editor):
    SidebarMenu = apps.get_model("users", "SidebarMenu")
    SidebarMenu.objects.filter(key="legacy-retake-sync").update(
        label="HEMIS sync",
        spa_path="/retake/sync",
        description="Retake HEMIS sync panel (SPA)",
    )


def backward(apps, schema_editor):
    SidebarMenu = apps.get_model("users", "SidebarMenu")
    SidebarMenu.objects.filter(key="legacy-retake-sync").update(
        label="HEMIS sinxronlash",
        spa_path="/legacy/retake/sync/",
        description="HEMIS ma'lumotlarini sinxronlash paneli",
    )


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0012_update_retake_search_student_path"),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
