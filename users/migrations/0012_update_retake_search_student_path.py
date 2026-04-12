from django.db import migrations


def forward(apps, schema_editor):
    SidebarMenu = apps.get_model("users", "SidebarMenu")
    SidebarMenu.objects.filter(key="legacy-retake-search-student").update(
        label="Talaba qidirish",
        spa_path="/retake/search-student",
        description="Retake talaba qidirish (SPA)",
    )


def backward(apps, schema_editor):
    SidebarMenu = apps.get_model("users", "SidebarMenu")
    SidebarMenu.objects.filter(key="legacy-retake-search-student").update(
        label="Talaba qidirish",
        spa_path="/legacy/retake/search-student/",
        description="Retake ariza uchun talaba qidirish",
    )


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0011_update_retake_dashboard_paths"),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
