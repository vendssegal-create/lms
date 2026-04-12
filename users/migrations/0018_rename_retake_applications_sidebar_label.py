from django.db import migrations


def rename_retake_applications_label(apps, schema_editor):
    SidebarMenu = apps.get_model("users", "SidebarMenu")
    SidebarMenu.objects.filter(key="retake-applications").update(label="Qayta o'qish arizalari")


def noop_reverse(apps, schema_editor):
    SidebarMenu = apps.get_model("users", "SidebarMenu")
    SidebarMenu.objects.filter(key="retake-applications").update(label="Arizalar")


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0017_user_ui_preferences"),
    ]

    operations = [
        migrations.RunPython(rename_retake_applications_label, noop_reverse),
    ]
