from __future__ import annotations

from pathlib import Path

from django.http import HttpResponse, HttpResponseNotFound


def spa_index(_request, _path: str | None = None):
    """
    Serve the built React app (Vite) from design/dist.

    We intentionally host it under /app/ to avoid colliding with existing
    server-rendered routes like /profile, /change-password, etc.
    """
    base_dir = Path(__file__).resolve().parent.parent
    index_path = base_dir / "design" / "dist" / "index.html"
    if not index_path.exists():
        return HttpResponseNotFound(
            "SPA build topilmadi. `cd design && npm.cmd run build` ni ishga tushiring."
        )

    # Vite produces a static HTML file; we return it as-is.
    html = index_path.read_text(encoding="utf-8", errors="replace")
    return HttpResponse(html, content_type="text/html; charset=utf-8")

