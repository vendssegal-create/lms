"""
LibreOffice `soffice` ijro faylini topish (Windows / Linux / macOS).
"""
from __future__ import annotations

import glob
import os
import shutil
from pathlib import Path


def find_soffice_executable() -> str | None:
    for env_key in ("LIBREOFFICE_SOFFICE", "SOFFICE_PATH"):
        manual = (os.environ.get(env_key) or "").strip().strip('"')
        if manual and os.path.isfile(manual):
            return manual

    if os.name == "nt":
        candidates: list[str] = []
        seen: set[str] = set()

        def add(p: str) -> None:
            if p and p not in seen:
                seen.add(p)
                candidates.append(p)

        for env in ("ProgramFiles", "ProgramFiles(x86)"):
            base = os.environ.get(env)
            if base:
                add(str(Path(base) / "LibreOffice" / "program" / "soffice.exe"))
                for match in glob.glob(str(Path(base) / "LibreOffice*" / "program" / "soffice.exe")):
                    add(match)

        local = os.environ.get("LOCALAPPDATA")
        if local:
            add(str(Path(local) / "Programs" / "LibreOffice" / "program" / "soffice.exe"))

        for p in candidates:
            if os.path.isfile(p):
                return p

    for name in ("libreoffice", "soffice"):
        p = shutil.which(name)
        if p:
            return p

    mac = Path("/Applications/LibreOffice.app/Contents/MacOS/soffice")
    if mac.is_file():
        return str(mac)

    return None
