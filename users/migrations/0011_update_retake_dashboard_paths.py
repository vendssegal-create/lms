from django.db import migrations


def forward(apps, schema_editor):
    SidebarMenu = apps.get_model("users", "SidebarMenu")
    SidebarMenu.objects.filter(key="legacy-retake-dashboard").update(
        label="Retake dashboard",
        spa_path="/retake",
        description="Retake boshqaruv paneli (SPA)",
    )
    SidebarMenu.objects.filter(key="legacy-retake-applications").update(
        label="Retake arizalari",
        spa_path="/retake/applications",
        description="Retake arizalari ro'yxati (SPA)",
    )
    SidebarMenu.objects.filter(key="legacy-retake-accounting").update(
        label="Buxgalteriya tekshiruvi",
        spa_path="/retake/applications",
        description="Accounting ko'rigi (SPA)",
    )
    SidebarMenu.objects.filter(key="legacy-retake-supervisor").update(
        label="Supervisor tasdiqlari",
        spa_path="/retake/applications",
        description="Supervisor ko'rigi (SPA)",
    )


def backward(apps, schema_editor):
    SidebarMenu = apps.get_model("users", "SidebarMenu")
    SidebarMenu.objects.filter(key="legacy-retake-dashboard").update(
        label="Retake dashboard",
        spa_path="/legacy/retake/dashboard/",
        description="Legacy retake boshqaruv paneli",
    )
    SidebarMenu.objects.filter(key="legacy-retake-applications").update(
        label="Retake arizalari",
        spa_path="/legacy/retake/applications/",
        description="Retake arizalari ro'yxati",
    )
    SidebarMenu.objects.filter(key="legacy-retake-accounting").update(
        label="Buxgalteriya tekshiruvi",
        spa_path="/legacy/retake/accounting/list/",
        description="To'lovlarni buxgalteriya tekshiradi",
    )
    SidebarMenu.objects.filter(key="legacy-retake-supervisor").update(
        label="Supervisor tasdiqlari",
        spa_path="/legacy/retake/supervisor/list/",
        description="Supervisor ko'rib chiqish navbati",
    )


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0010_update_exam_calendar_sidebar_path"),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
