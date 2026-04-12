from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import SidebarMenu, SidebarMenuAccess, StudentProfile, TeacherProfile, User

class StudentProfileInline(admin.StackedInline):
    model = StudentProfile
    can_delete = False
    verbose_name_plural = 'Talaba Profili'

class TeacherProfileInline(admin.StackedInline):
    model = TeacherProfile
    can_delete = False
    verbose_name_plural = 'O\'qituvchi Profili'

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'role', 'is_staff')
    list_filter = ('role', 'is_staff', 'is_superuser', 'is_active')
    fieldsets = UserAdmin.fieldsets + (
        (None, {'fields': ('role',)}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        (None, {'fields': ('role',)}),
    )
    inlines = [StudentProfileInline, TeacherProfileInline]

@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'student_id_number', 'university', 'group_name')
    search_fields = ('full_name', 'student_id_number')

@admin.register(TeacherProfile)
class TeacherProfileAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'university', 'department', 'hemis_id')
    search_fields = ('full_name', 'hemis_id')


class SidebarMenuAccessInline(admin.TabularInline):
    model = SidebarMenuAccess
    extra = 0
    ordering = ("role", "order_index")
    fields = ("role", "order_index", "is_visible")


@admin.register(SidebarMenu)
class SidebarMenuAdmin(admin.ModelAdmin):
    list_display = ("label", "key", "section", "icon_lucide", "is_enabled")
    list_filter = ("section", "is_enabled")
    search_fields = ("label", "key", "spa_path", "url_name", "external_url")
    fieldsets = (
        (None, {"fields": ("label", "key", "description", "section", "icon_lucide", "is_enabled")}),
        ("Navigation Target", {"fields": ("spa_path", "url_name", "external_url")}),
    )
    inlines = [SidebarMenuAccessInline]


@admin.register(SidebarMenuAccess)
class SidebarMenuAccessAdmin(admin.ModelAdmin):
    list_display = ("menu", "role", "order_index", "is_visible")
    list_editable = ("order_index", "is_visible")
    list_filter = ("role", "is_visible", "menu__section")
    search_fields = ("menu__label", "menu__key")
    ordering = ("role", "order_index")
