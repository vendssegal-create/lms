from decimal import Decimal, InvalidOperation
from typing import Any
from lms.models import ControlType

def normalize_control_type(value: str | None) -> str:
    if not value:
        return ControlType.OTHER
    text = str(value).strip().lower()
    if "joriy" in text or "current" in text:
        return ControlType.CURRENT
    if "oraliq" in text or "midterm" in text:
        return ControlType.MIDTERM
    if "yakun" in text or "final" in text:
        return ControlType.FINAL
    return ControlType.OTHER

def to_decimal(value: Any) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return None

def exam_code(item: dict[str, Any] | None) -> str:
    if not item:
        return ""
    exam_type = item.get("examType") or item.get("exam_type") or {}
    if isinstance(exam_type, dict):
        return str(exam_type.get("code") or "")
    return ""

def exam_name(item: dict[str, Any] | None) -> str:
    if not item:
        return ""
    exam_type = item.get("examType") or item.get("exam_type") or {}
    if isinstance(exam_type, dict):
        return str(exam_type.get("name") or exam_type.get("code") or "")
    return str(item.get("exam_type") or "")

def nested_name(payload: Any) -> str:
    return str(payload.get("name") or "") if isinstance(payload, dict) else ""

def nested_code(payload: Any) -> str:
    return str(payload.get("code") or "") if isinstance(payload, dict) else ""
