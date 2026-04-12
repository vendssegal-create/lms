from __future__ import annotations

from urllib.parse import urlencode

from django.http import HttpRequest, HttpResponseRedirect


class LegacyEmbedRedirectMiddleware:
    """
    Force all legacy template pages to be shown inside the SPA shell.

    Backend legacy pages are mounted under /__legacy/.
    If a user opens them directly (without ?embed=1), redirect to SPA route /legacy/*,
    which embeds the backend via iframe.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request: HttpRequest):
        path = request.path or ""
        if path.startswith("/__legacy/"):
            # Allow iframe loads.
            if request.GET.get("embed") == "1":
                return self.get_response(request)

            rest = path[len("/__legacy") :]  # keeps leading slash
            qs = request.GET.copy()
            qs.pop("embed", None)
            query = qs.urlencode()
            target = f"/legacy{rest}"
            if query:
                target = f"{target}?{query}"
            return HttpResponseRedirect(target)

        return self.get_response(request)

