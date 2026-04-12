from django.db import migrations


def forward(apps, schema_editor):
    SidebarMenu = apps.get_model("users", "SidebarMenu")
    SidebarMenu.objects.filter(key="legacy-admin-dashboard").update(
        label="Admin dashboard",
        spa_path="/admin/dashboard",
        description="LMS admin dashboard (SPA)",
    )
    SidebarMenu.objects.filter(key="legacy-create-teacher").update(
        label="O'qituvchi qo'shish",
        spa_path="/admin/teachers/create",
        description="Teacher create form (SPA)",
    )
    SidebarMenu.objects.filter(key="legacy-create-student").update(
        label="Talaba qo'shish",
        spa_path="/admin/students/create",
        description="Student create form (SPA)",
    )


def backward(apps, schema_editor):
    SidebarMenu = apps.get_model("users", "SidebarMenu")
    SidebarMenu.objects.filter(key="legacy-admin-dashboard").update(
        label="Admin dashboard",
        spa_path="/legacy/lms/admin-dashboard/",
        description="Legacy admin dashboard",
    )
    SidebarMenu.objects.filter(key="legacy-create-teacher").update(
        label="O'qituvchi yaratish",
        spa_path="/legacy/lms/admin/teachers/create/",
        description="Legacy o'qituvchi yaratish formasi",
    )
    SidebarMenu.objects.filter(key="legacy-create-student").update(
        label="Talaba yaratish",
        spa_path="/legacy/lms/admin/students/create/",
        description="Legacy talaba yaratish formasi",
    )


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0013_update_retake_sync_path"),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
