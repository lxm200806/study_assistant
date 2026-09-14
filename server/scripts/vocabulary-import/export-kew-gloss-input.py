"""Dump compact gloss-generation inputs for a KEW series."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BOOKS = ROOT / "data" / "vocabulary" / "books"
TMP = ROOT / "tmp" / "kew"
SERIES_BOOKS = {
    "kew1200": ["kew1200-1", "kew1200-2", "kew1200-3"],
    "kew4500": ["kew4500-1", "kew4500-2", "kew4500-3", "kew4500-4"],
    "kew7200": ["kew7200-1", "kew7200-2", "kew7200-3"],
}


def pos_from_tags(tags: list) -> str:
    for tag in tags or []:
        if str(tag).startswith("pos:"):
            return str(tag)[4:]
    return ""


def series_of(code: string) -> str:
    for series in SERIES_BOOKS:
        if code.startswith(f"{series}-") or code == series:
            return series
    raise SystemExit(f"unknown book/series: {code}")


def codes_from_args(args: list[str]) -> dict[str, list[str]]:
    if not args:
        return SERIES_BOOKS
    grouped: dict[str, list[str]] = {}
    for arg in args:
        if arg in SERIES_BOOKS:
            grouped[arg] = list(SERIES_BOOKS[arg])
        else:
            series = series_of(arg)
            grouped.setdefault(series, []).append(arg)
    return grouped


def main() -> None:
    grouped = codes_from_args(sys.argv[1:])
    for series, codes in grouped.items():
        out = TMP / series / "input"
        out.mkdir(parents=True, exist_ok=True)
        for code in codes:
            book = json.loads((BOOKS / f"{code}.json").read_text(encoding="utf-8"))
            rows = []
            for item in book["words"]:
                word = item["word"]
                sense = item.get("senseKey") or ""
                rows.append(
                    {
                        "key": word,
                        "word": word,
                        "senseKey": sense,
                        "senseLabel": item.get("senseLabel") or "",
                        "pos": pos_from_tags(item.get("tags") or []),
                        "hint": item.get("englishMeaning") or "",
                        "meaningNow": item.get("meaning") or "",
                    }
                )
            path = out / f"{code}.json"
            path.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(code, len(rows), "->", path)


if __name__ == "__main__":
    main()
