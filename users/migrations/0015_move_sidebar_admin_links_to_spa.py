from django.db import migrations


def move_sidebar_admin_links_to_spa(apps, schema_editor):
    SidebarMenu = apps.get_model("users", "SidebarMenu")

    SidebarMenu.objects.filter(key="sidebar-menus-admin").update(
        spa_path="/super-admin/sidebar/menus",
        external_url="",
        url_name="",
        description="Sidebar menyularini frontend ichida boshqarish",
    )
    SidebarMenu.objects.filter(key="sidebar-access-admin").update(
        spa_path="/super-admin/sidebar/access",
        external_url="",
        url_name="",
        description="Role bo'yicha menu access va tartibni frontend ichida boshqarish",
    )


def move_sidebar_admin_links_back(apps, schema_editor):
    SidebarMenu = apps.get_model("users", "SidebarMenu")

    SidebarMenu.objects.filter(key="sidebar-menus-admin").update(
        spa_path="",
        external_url="/admin/users/sidebarmenu/",
        url_name="",
        description="Sidebar menyularini boshqarish",
    )
    SidebarMenu.objects.filter(key="sidebar-access-admin").update(
        spa_path="",
        external_url="/admin/users/sidebarmenuaccess/",
        url_name="",
        description="Role bo'yicha menu access va tartibni boshqarish",
    )


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0014_update_admin_paths"),
    ]

    operations = [
        migrations.RunPython(move_sidebar_admin_links_to_spa, move_sidebar_admin_links_back),
    ]
