from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

class User(AbstractUser):
    class Role(models.TextChoices):
        SUPER_ADMIN = 'SUPER_ADMIN', _('Super Admin')
        TEACHER = 'TEACHER', _('O\'qituvchi')
        STUDENT = 'STUDENT', _('Talaba')
        ACADEMIC_BOARD = 'ACADEMIC_BOARD', _('O\'quv bo\'limi')
        DIRECTION = 'DIRECTION', _('Rahbariyat')
        REGISTRATOR = 'REGISTRATOR', _('Registrator ofisi')
        RET_REGISTRATOR = 'RET_REGISTRATOR', _('Registrator (xizmat ko\'rsatish)')
        RET_ACCOUNTING = 'RET_ACCOUNTING', _('Registrator (buxgalteriya)')
        RET_SUPERVISOR = 'RET_SUPERVISOR', _('Registrator boshlig\'i')
        RET_DB_MANAGER = 'RET_DB_MANAGER', _('Registrator (MB menejeri)')

    role = models.CharField(
        max_length=50,
        choices=Role.choices,
        default=Role.STUDENT
    )
    
    first_name = models.CharField(_("first name"), max_length=150, blank=True)
    last_name = models.CharField(_("last name"), max_length=150, blank=True)
    email = models.EmailField(_("email address"), blank=True)
    phone = models.CharField(max_length=20, blank=True, default="")
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    ui_preferences = models.JSONField(default=dict, blank=True)

    def save(self, *args, **kwargs):
        # Automatically set is_staff for administrative roles
        staff_roles = {
            self.Role.SUPER_ADMIN,
            self.Role.TEACHER,
            self.Role.ACADEMIC_BOARD,
            self.Role.DIRECTION,
            self.Role.REGISTRATOR,
            self.Role.RET_REGISTRATOR,
            self.Role.RET_ACCOUNTING,
            self.Role.RET_SUPERVISOR,
            self.Role.RET_DB_MANAGER,
        }
        
        if self.role == self.Role.SUPER_ADMIN:
            self.is_superuser = True
            self.is_staff = True
        elif self.role in staff_roles:
            self.is_staff = True
            
        # Ensure superusers always have staff access
        if self.is_superuser:
            self.is_staff = True
            
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

class StudentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    full_name = models.CharField(max_length=255)
    student_id_number = models.CharField(max_length=20, unique=True)
    university = models.CharField(max_length=255)
    image = models.ImageField(upload_to='students/', null=True, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    faculty_name = models.CharField(max_length=255, default="")
    group_name = models.CharField(max_length=255, default="")
    specialty_name = models.CharField(max_length=255, default="")
    education_lang = models.CharField(max_length=100, default="")
    level = models.CharField(max_length=100, default="")
    education_form = models.CharField(max_length=100, default="")
    education_type = models.CharField(max_length=100, default="")
    payment_form = models.CharField(max_length=100, default="")
    student_status = models.CharField(max_length=100, default="")
    address = models.TextField(default="")
    country = models.CharField(max_length=100, default="", blank=True)
    province = models.CharField(max_length=100, default="", blank=True)
    district = models.CharField(max_length=100, default="", blank=True)
    social_category = models.CharField(max_length=100, default="", blank=True)
    accommodation = models.CharField(max_length=100, default="", blank=True)
    
    # HEMIS data
    bstu_token = models.CharField(max_length=255, default="", blank=True)
    hemis_student_id = models.BigIntegerField(
        null=True, blank=True, unique=True,
        help_text="HEMIS ichki talaba ID (HemisStudentSnapshot.hemis_student_id bilan mos)"
    )
    hemis_snapshot = models.OneToOneField(
        'hemis.HemisStudentSnapshot',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='student_profile',
        help_text="HEMIS snapshot bilan to'g'ridan-to'g'ri bog'liq"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.full_name

    @property
    def image_url(self):
        if self.image and hasattr(self.image, 'url'):
            return self.image.url
        return f"https://ui-avatars.com/api/?name={self.full_name}&background=random"

class TeacherProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='teacher_profile')
    full_name = models.CharField(max_length=255)
    university = models.CharField(max_length=255, default="")
    department = models.CharField(max_length=255, default="")
    hemis_id = models.CharField(max_length=64, default="", blank=True)
    hemis_uuid = models.CharField(max_length=64, unique=True, null=True, blank=True)
    hemis_position = models.CharField(max_length=255, default="")
    avatar = models.ImageField(upload_to='teachers/', null=True, blank=True)
    avatar_full_url = models.URLField(max_length=500, null=True, blank=True)
    auth_provider = models.CharField(max_length=32, default="", blank=True)
    profile_payload = models.JSONField(default=dict, blank=True)
    experience_years = models.IntegerField(default=0)
    phone = models.CharField(max_length=20, default="", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.full_name

    @property
    def avatar_url(self):
        if self.avatar and hasattr(self.avatar, 'url'):
            return self.avatar.url
        if self.avatar_full_url:
            return self.avatar_full_url
        return f"https://ui-avatars.com/api/?name={self.full_name}&background=random"


class SidebarMenu(models.Model):
    class Section(models.TextChoices):
        MAIN = "MAIN", _("Asosiy")
        RETAKE = "RETAKE", _("Retake")
        ADMIN = "ADMIN", _("Admin")
        LEGACY = "LEGACY", _("Legacy")

    key = models.SlugField(max_length=80, unique=True)
    label = models.CharField(max_length=120)
    section = models.CharField(max_length=20, choices=Section.choices, default=Section.MAIN)
    icon_lucide = models.CharField(max_length=80, default="layout-dashboard")
    spa_path = models.CharField(max_length=255, blank=True, default="")
    url_name = models.CharField(max_length=255, blank=True, default="")
    external_url = models.CharField(max_length=500, blank=True, default="")
    is_enabled = models.BooleanField(default=True)
    description = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ["section", "label"]
        verbose_name = "Sidebar menu"
        verbose_name_plural = "Sidebar menus"

    def clean(self):
        targets = [bool(self.spa_path), bool(self.url_name), bool(self.external_url)]
        if sum(targets) != 1:
            raise ValidationError("spa_path, url_name yoki external_url dan faqat bittasi berilishi kerak.")

    def __str__(self):
        return self.label


class SidebarMenuAccess(models.Model):
    menu = models.ForeignKey(SidebarMenu, on_delete=models.CASCADE, related_name="role_access")
    role = models.CharField(max_length=50, choices=User.Role.choices)
    order_index = models.PositiveIntegerField(default=100)
    is_visible = models.BooleanField(default=True)

    class Meta:
        ordering = ["role", "order_index", "menu__label"]
        constraints = [
            models.UniqueConstraint(fields=["menu", "role"], name="uniq_sidebar_menu_role"),
        ]
        verbose_name = "Sidebar menu access"
        verbose_name_plural = "Sidebar menu access rules"

    def __str__(self):
        return f"{self.menu.label} -> {self.get_role_display()}"
