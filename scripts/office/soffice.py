"""

LibreOffice headless wrapper for DOCX → PDF.

Usage: python soffice.py --headless --convert-to pdf --outdir DIR FILE.docx

"""

from __future__ import annotations



import subprocess

import sys

from pathlib import Path



ROOT = Path(__file__).resolve().parents[2]

if str(ROOT) not in sys.path:

    sys.path.insert(0, str(ROOT))



from lms.utils.libreoffice import find_soffice_executable





def main() -> None:

    soffice = find_soffice_executable()

    if not soffice:

        print(

            "LibreOffice (soffice) topilmadi. Windows: https://www.libreoffice.org/download "

            "yoki `winget install TheDocumentFoundation.LibreOffice`. "

            "PATH ga qo‘shilgan `soffice` / `libreoffice` ham qidiriladi.",

            file=sys.stderr,

        )

        sys.exit(1)

    r = subprocess.run([soffice, *sys.argv[1:]])

    sys.exit(r.returncode)





if __name__ == "__main__":

    main()


