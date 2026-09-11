"""OCR-parse 7200 Key English Words TOC pages into a catalog JSON."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OCR_DIR = ROOT / "data" / "sources" / "kew" / "_toc_extract"
OUT = ROOT / "data" / "sources" / "kew" / "kew7200-units.json"
ECDICT = ROOT / "data" / "sources" / "ecdict.csv"

SKIP = {
    "unit",
    "review",
    "table",
    "of",
    "contents",
    "appendix",
    "index",
    "page",
    "key",
    "english",
    "words",
}

BOOK_META = {
    1: {"code": "kew7200-1", "name": "7200高频词 1", "level": "B2+", "targetWordCount": 800},
    2: {"code": "kew7200-2", "name": "7200高频词 2", "level": "C1", "targetWordCount": 800},
    3: {"code": "kew7200-3", "name": "7200高频词 3", "level": "C1+", "targetWordCount": 800},
}


def load_dictionary() -> set[str]:
    words: set[str] = set()
    if not ECDICT.exists():
        return words
    with ECDICT.open(encoding="utf-8", errors="ignore") as f:
        next(f, None)
        for line in f:
            raw = line.split(",", 1)[0].strip().strip('"').lower()
            if re.fullmatch(r"[a-z][a-z' -]{1,40}", raw):
                words.add(raw)
    return words


def extract_tokens(text: str, dictionary: set[str]) -> list[str]:
    tokens = re.findall(r"[A-Za-z][A-Za-z'-]*", text)
    out: list[str] = []
    for tok in tokens:
        word = tok.lower().replace("'", "'")
        if word in SKIP:
            continue
        if len(word) <= 1:
            continue
        if dictionary:
            if word in dictionary or (len(word) >= 6 and word.endswith("s") and word[:-1] in dictionary):
                out.append(word)
            elif len(word) >= 8:
                # keep long OCR candidates for manual review
                out.append(word)
        else:
            if len(word) >= 3:
                out.append(word)
    return out


def parse_book(n: int, dictionary: set[str]) -> dict:
    texts = []
    for page in (5, 6):
        path = OCR_DIR / f"7200-{n}-00{page}.txt"
        texts.append(path.read_text(encoding="utf-8", errors="ignore"))
    tokens = extract_tokens("\n".join(texts), dictionary)
    # Drop leading noise before first real unit word if needed
    units = []
    for i in range(0, min(800, len(tokens)), 20):
        chunk = tokens[i : i + 20]
        if len(chunk) < 20:
            break
        uid = f"u{len(units) + 1}"
        units.append({"id": uid, "title": f"Unit {len(units) + 1}", "words": chunk})
    meta = BOOK_META[n]
    return {
        "code": meta["code"],
        "name": meta["name"],
        "description": (
            f"Seed Learning《7200 Key English Words {n}》。从目录提取每单元 New Words 主题词，"
            "不含课文句子用词。"
        ),
        "level": meta["level"],
        "targetWordCount": meta["targetWordCount"],
        "units": units,
        "_tokenCount": len(tokens),
        "_extraTokens": tokens[800:],
    }


def main() -> None:
    dictionary = load_dictionary()
    print(f"dictionary {len(dictionary)}")
    books = []
    for n in range(1, 4):
        book = parse_book(n, dictionary)
        extra = book.pop("_extraTokens")
        token_count = book.pop("_tokenCount")
        books.append(book)
        print(f"{book['code']}: tokens={token_count} units={len(book['units'])} extra={extra[:20]}")
        if book["units"]:
            print("  u1", book["units"][0]["words"])
            print("  last", book["units"][-1]["words"])

    catalog = {
        "series": "7200 Key English Words",
        "publisher": "Seed Learning",
        "author": "Paul Nation",
        "source": "Table of Contents — unit target words only (not passage running words)",
        "books": books,
    }
    OUT.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
