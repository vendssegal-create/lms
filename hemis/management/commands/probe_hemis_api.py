import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from hemis.utils.client import HemisRestClient, HemisRestApiError


def _keys_preview(obj: dict) -> list[str]:
    return sorted(str(k) for k in obj.keys())


class Command(BaseCommand):
    help = (
        "HEMIS REST: student-list, employee-list (teacher), auditorium-list dan "
        "birinchi sahifani olib, kalitlar va namunani chiqaradi — model mapping ni tekshirish uchun."
    )

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=3, help="Har bir ro'yxatdan nechta qator (max 50)")
        parser.add_argument("--students", action="store_true", help="Faqat talabalar")
        parser.add_argument("--teachers", action="store_true", help="Faqat o'qituvchilar (employee-list)")
        parser.add_argument("--rooms", action="store_true", help="Faqat auditoriyalar")
        parser.add_argument(
            "--out",
            type=str,
            default="",
            help="Natijani JSON faylga yozish (masalan: hemis_probe.json)",
        )

    def handle(self, *args, **options):
        limit = max(1, min(int(options["limit"]), 50))
        flags = [options["students"], options["teachers"], options["rooms"]]
        run_all = not any(flags)
        run_students = run_all or options["students"]
        run_teachers = run_all or options["teachers"]
        run_rooms = run_all or options["rooms"]

        client = HemisRestClient()
        out: dict = {}

        try:
            if run_students:
                items, pag = client.list_students(page=1, limit=limit)
                out["students"] = {
                    "endpoint": "/v1/data/student-list",
                    "pagination": pag,
                    "count": len(items),
                    "first_row_keys": _keys_preview(items[0]) if items else [],
                    "samples": items[:limit],
                }

            if run_teachers:
                items, pag = client.list_teachers(page=1, limit=limit)
                out["teachers"] = {
                    "endpoint": "/v1/data/employee-list?type=teacher",
                    "pagination": pag,
                    "count": len(items),
                    "first_row_keys": _keys_preview(items[0]) if items else [],
                    "samples": items[:limit],
                }

            if run_rooms:
                items, pag = client.list_rooms(page=1, limit=limit)
                out["rooms"] = {
                    "endpoint": "/v1/data/auditorium-list",
                    "pagination": pag,
                    "count": len(items),
                    "first_row_keys": _keys_preview(items[0]) if items else [],
                    "samples": items[:limit],
                }
        except HemisRestApiError as exc:
            raise CommandError(str(exc)) from exc

        text = json.dumps(out, ensure_ascii=False, indent=2, default=str)
        self.stdout.write(text)

        out_path = (options.get("out") or "").strip()
        if out_path:
            path = Path(out_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
            self.stdout.write(self.style.SUCCESS(f"Yozildi: {path.resolve()}"))
