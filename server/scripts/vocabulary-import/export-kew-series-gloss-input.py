"""Dump compact gloss-generation inputs for 4500/7200 books."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BOOKS = ROOT / "data" / "vocabulary" / "books"
OUT = ROOT / "data" / "sources" / "kew" / "series" / "input"

CODES = [
    "kew4500-1",
    "kew4500-2",
    "kew4500-3",
    "kew4500-4",
    "kew7200-1",
    "kew7200-2",
    "kew7200-3",
]


def pos_from_tags(tags: list) -> str:
    for tag in tags or []:
        if str(tag).startswith("pos:"):
            return str(tag)[4:]
    return ""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for code in CODES:
        book = json.loads((BOOKS / f"{code}.json").read_text(encoding="utf-8"))
        rows = []
        for item in book["words"]:
            word = item["word"]
            sense = item.get("senseKey") or ""
            rows.append(
                {
                    "key": f"{word}::{sense}",
                    "word": word,
                    "senseKey": sense,
                    "senseLabel": item.get("senseLabel") or "",
                    "pos": pos_from_tags(item.get("tags") or []),
                    "hint": item.get("englishMeaning") or "",
                    "meaningNow": item.get("meaning") or "",
                }
            )
        path = OUT / f"{code}.json"
        path.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(code, len(rows), "->", path)


if __name__ == "__main__":
    main()
