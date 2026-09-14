"""Extract official Cambridge MSE vocabulary-list PDFs to plain text."""
from __future__ import annotations

from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
TMP = ROOT / "tmp" / "mse"
OUT = ROOT / "data" / "sources" / "mse"

PDFS = {
    "mse-ket": TMP / "a2-key-2025.pdf",
    "mse-pet": TMP / "b1-preliminary-2025.pdf",
}


def extract_pdf(path: Path) -> str:
    reader = PdfReader(str(path))
    pages = []
    for page in reader.pages:
        pages.append(page.extract_text() or "")
    return "\n".join(pages).replace("\x00", "")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for code, pdf in PDFS.items():
        if not pdf.exists():
            raise SystemExit(f"missing official PDF: {pdf}")
        text = extract_pdf(pdf)
        dest = OUT / f"{code}.txt"
        dest.write_text(text + "\n", encoding="utf-8")
        print(code, pdf.name, "pages", len(PdfReader(str(pdf)).pages), "chars", len(text), "->", dest)


if __name__ == "__main__":
    main()
