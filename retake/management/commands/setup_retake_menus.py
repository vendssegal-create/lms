from django.core.management.base import BaseCommand
from users.models import SidebarMenu, SidebarMenuAccess

RETAKE_MENUS = [
    {
        'key': 'retake-dashboard',
        'label': 'Retake Dashboard',
        'section': 'RETAKE',
        'icon_lucide': 'layout-dashboard',
        'spa_path': '/retake/dashboard',
        'roles': {
            'RET_DB_MANAGER': 1, 'RET_REGISTRATOR': 1, 'RET_ACCOUNTING': 1,
            'RET_SUPERVISOR': 1, 'REGISTRATOR': 1, 'SUPER_ADMIN': 1,
        },
    },
    {
        'key': 'retake-groups',
        'label': 'Fan Guruhlari',
        'section': 'RETAKE',
        'icon_lucide': 'users',
        'spa_path': '/retake/groups',
        'roles': {'RET_DB_MANAGER': 2, 'REGISTRATOR': 3, 'SUPER_ADMIN': 3},
    },
    {
        'key': 'retake-exam-sheets',
        'label': 'Qaydnomalar',
        'section': 'RETAKE',
        'icon_lucide': 'clipboard-list',
        'spa_path': '/retake/exam-sheets',
        'roles': {'RET_DB_MANAGER': 3, 'REGISTRATOR': 4, 'SUPER_ADMIN': 4},
    },
    {
        'key': 'retake-applications',
        'label': "Qayta o'qish arizalari",
        'section': 'RETAKE',
        'icon_lucide': 'file-text',
        'spa_path': '/retake/applications',
        'roles': {'RET_REGISTRATOR': 2, 'REGISTRATOR': 2, 'SUPER_ADMIN': 2},
    },
    {
        'key': 'retake-cycles',
        'label': 'Tsikllar',
        'section': 'RETAKE',
        'icon_lucide': 'repeat',
        'spa_path': '/retake/cycles',
        'roles': {'REGISTRATOR': 5, 'SUPER_ADMIN': 5},
    },
    {
        'key': 'retake-db-manager-faculties',
        'label': 'MB Menejerlari',
        'section': 'RETAKE',
        'icon_lucide': 'user-check',
        'spa_path': '/retake/admin/db-manager-faculties',
        'roles': {'REGISTRATOR': 6, 'SUPER_ADMIN': 6},
    },
    {
        'key': 'retake-sync',
        'label': 'HEMIS Sinxron',
        'section': 'RETAKE',
        'icon_lucide': 'refresh-cw',
        'spa_path': '/retake/sync',
        'roles': {'REGISTRATOR': 7, 'SUPER_ADMIN': 7},
    },
    {
        'key': 'retake-accounting',
        'label': "To'lovlar",
        'section': 'RETAKE',
        'icon_lucide': 'credit-card',
        'spa_path': '/retake/accounting/list',
        'roles': {'RET_ACCOUNTING': 2},
    },
    {
        'key': 'retake-supervisor',
        'label': 'Tasdiqlash',
        'section': 'RETAKE',
        'icon_lucide': 'check-circle',
        'spa_path': '/retake/supervisor/list',
        'roles': {'RET_SUPERVISOR': 2},
    },
    {
        'key': 'retake-teacher-groups',
        'label': 'Guruhlarim',
        'section': 'RETAKE',
        'icon_lucide': 'book-open',
        'spa_path': '/retake/teacher/groups',
        'roles': {'TEACHER': 10},
    },
]


class Command(BaseCommand):
    help = 'Retake menyu elementlarini yaratadi yoki yangilaydi'

    def handle(self, *args, **options):
        for menu_data in RETAKE_MENUS:
            roles = menu_data.pop('roles')
            menu, created = SidebarMenu.objects.update_or_create(
                key=menu_data['key'],
                defaults=menu_data,
            )
            for role, order in roles.items():
                SidebarMenuAccess.objects.update_or_create(
                    menu=menu, role=role,
                    defaults={'order_index': order, 'is_visible': True},
                )
            action = 'Yaratildi' if created else 'Yangilandi'
            self.stdout.write(f"{action}: {menu.label}")
            menu_data['roles'] = roles

        self.stdout.write(self.style.SUCCESS('Retake menyulari muvaffaqiyatli sozlandi!'))
