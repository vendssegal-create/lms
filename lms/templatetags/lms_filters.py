from django import template
from django.utils import timezone
import datetime

register = template.Library()

@register.filter
def uz_date(value):
    if not value:
        return ""
    if isinstance(value, str):
        try:
            value = datetime.datetime.strptime(value, "%Y-%m-%d").date()
        except ValueError:
            return value
    return value.strftime("%d.%m.%Y")

@register.filter
def uz_datetime(value):
    if not value:
        return ""
    if isinstance(value, str):
        try:
            value = datetime.datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return value
    # Ensure timezone awareness if settings.USE_TZ is True
    if timezone.is_naive(value):
        value = timezone.make_aware(value)
    return value.strftime("%d.%m.%Y %H:%M")

@register.filter
def get_item(dictionary, key):
    if not dictionary:
        return None
    res = dictionary.get(key)
    if res is None:
        res = dictionary.get(str(key))
    if res is None:
        try:
            res = dictionary.get(int(key))
        except (ValueError, TypeError):
            pass
    return res

@register.filter
def add_float(value, arg):
    try:
        v = float(value or 0)
        a = float(arg or 0)
        return v + a
    except (ValueError, TypeError):
        return value

@register.filter
def status_badge_class(status):
    from retake.models import RetakeApplicationStatus
    mapping = {
        RetakeApplicationStatus.DRAFT: "label-default",
        RetakeApplicationStatus.IN_REVIEW: "label-warning",
        RetakeApplicationStatus.PARTIALLY_APPROVED: "label-primary",
        RetakeApplicationStatus.APPROVED: "label-info",
        RetakeApplicationStatus.RETURNED: "label-danger",
        RetakeApplicationStatus.COMPLETED: "label-success",
        RetakeApplicationStatus.CANCELLED: "label-danger",
    }
    return mapping.get(status, "label-default")

@register.filter
def status_label(status):
    from retake.models import RetakeApplicationStatus
    mapping = {
        RetakeApplicationStatus.DRAFT: "Qoralama",
        RetakeApplicationStatus.IN_REVIEW: "Ko'rib chiqilmoqda",
        RetakeApplicationStatus.PARTIALLY_APPROVED: "To'lov tasdiqlangan",
        RetakeApplicationStatus.APPROVED: "Rahbar tasdiqlagan",
        RetakeApplicationStatus.RETURNED: "Qaytarilgan",
        RetakeApplicationStatus.COMPLETED: "Yakunlangan",
        RetakeApplicationStatus.CANCELLED: "Bekor qilingan",
    }
    return mapping.get(status, status)

@register.simple_tag
def define_steps(current_status):
    from retake.models import RetakeApplicationStatus
    steps_config = [
        (RetakeApplicationStatus.DRAFT, "Ariza yaratildi", "fa-pencil"),
        (RetakeApplicationStatus.IN_REVIEW, "Buxgalteriya", "fa-bank"),
        (RetakeApplicationStatus.PARTIALLY_APPROVED, "Rahbar tasdig'i", "fa-user-secret"),
        (RetakeApplicationStatus.APPROVED, "Guruh & Jadval", "fa-calendar"),
        (RetakeApplicationStatus.COMPLETED, "Yakunlandi", "fa-check-circle"),
    ]
    
    order = [s[0] for s in steps_config]
    try:
        cur_idx = order.index(current_status)
    except ValueError:
        cur_idx = -1
        
    result = []
    for i, (status, label, icon) in enumerate(steps_config):
        result.append({
            'status': status,
            'label': label,
            'icon': icon,
            'is_done': (i < cur_idx) if current_status != 'cancelled' else False,
            'is_active': (i == cur_idx) if current_status != 'cancelled' else False,
        })
    return result

@register.simple_tag
def define_progress_val(current_status):
    from retake.models import RetakeApplicationStatus
    order = [
        RetakeApplicationStatus.DRAFT,
        RetakeApplicationStatus.IN_REVIEW, 
        RetakeApplicationStatus.PARTIALLY_APPROVED,
        RetakeApplicationStatus.APPROVED,
        RetakeApplicationStatus.COMPLETED,
    ]
    try:
        idx = order.index(current_status)
        return int((idx / (len(order) - 1)) * 100)
    except (ValueError, ZeroDivisionError):
        return 0
@register.filter
def filter_status(queryset, status):
    if not queryset:
        return []
    # If it's a Django QuerySet
    if hasattr(queryset, 'filter'):
        return queryset.filter(status=status)
    # If it's a regular list
    return [item for item in queryset if getattr(item, 'status', None) == status]
