from __future__ import annotations

from django.urls import NoReverseMatch, reverse

from users.models import SidebarMenu, SidebarMenuAccess
from users.utils.roles import Role


SECTION_LABELS = {
    "MAIN": "Asosiy modullar",
    "RETAKE": "Retake modullari",
    "ADMIN": "Admin boshqaruvi",
    "LEGACY": "Legacy modullar",
}


def _resolve_menu_path(menu) -> str:
    if menu.spa_path:
        return menu.spa_path
    if menu.external_url:
        return menu.external_url
    if menu.url_name:
        try:
            return reverse(menu.url_name)
        except NoReverseMatch:
            return menu.url_name
    return "#"


def build_sidebar_items(active_role: str):
    if active_role == Role.SUPER_ADMIN:
        menus = SidebarMenu.objects.filter(is_enabled=True).prefetch_related("role_access").order_by("section", "label")
        items = []
        for menu in menus:
            access = next((entry for entry in menu.role_access.all() if entry.role == Role.SUPER_ADMIN), None)
            items.append({
                "key": menu.key,
                "label": menu.label,
                "path": _resolve_menu_path(menu),
                "icon": menu.icon_lucide,
                "section": SECTION_LABELS.get(menu.section, menu.section),
                "order_index": access.order_index if access else 100,
            })
        return sorted(items, key=lambda item: (item["section"], item["order_index"], item["label"]))

    access_items = (
        SidebarMenuAccess.objects.select_related("menu")
        .filter(role=active_role, is_visible=True, menu__is_enabled=True)
        .order_by("order_index", "menu__label")
    )

    return [
        {
            "key": access.menu.key,
            "label": access.menu.label,
            "path": _resolve_menu_path(access.menu),
            "icon": access.menu.icon_lucide,
            "section": SECTION_LABELS.get(access.menu.section, access.menu.section),
            "order_index": access.order_index,
        }
        for access in access_items
    ]
