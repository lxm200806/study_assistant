"""Validate KEW gloss JSON against the matching book JSON."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BOOKS = ROOT / "data" / "vocabulary" / "books"
KEW = ROOT / "data" / "sources" / "kew"
SERIES_BOOKS = {
    "kew1200": ["kew1200-1", "kew1200-2", "kew1200-3"],
    "kew4500": ["kew4500-1", "kew4500-2", "kew4500-3", "kew4500-4"],
    "kew7200": ["kew7200-1", "kew7200-2", "kew7200-3"],
}
IPA = re.compile(r"[ˈˌːɪæɑɒʌəɜɔʊθðʃʒŋ]")
HAN = re.compile(r"[\u4e00-\u9fff]")


def fake_phonetic(word: str, phonetic: str) -> bool:
    inner = phonetic.replace("/", "").replace(" ", "").lower()
    return inner == word.lower()


def validate(word: str, gloss: dict) -> list[str]:
    errors = []
    meaning = str(gloss.get("meaning") or "")
    english = str(gloss.get("englishMeaning") or "")
    phonetic = str(gloss.get("phonetic") or "")
    example = str(gloss.get("exampleSentence") or "")
    if not HAN.search(meaning) or "[待校对]" in meaning:
        errors.append("汉语解释无效")
    if len(meaning) > 30:
        errors.append(f"汉语过长({len(meaning)})")
    if HAN.search(english) or len(english) < 8:
        errors.append("英语解释无效")
    if not re.fullmatch(r"/[^/\n]{1,40}/", phonetic) or fake_phonetic(word, phonetic) or not IPA.search(phonetic):
        errors.append(f"音标无效:{phonetic}")
    if not re.search(rf"\b{re.escape(word)}\b", example, re.I):
        errors.append("例句未包含目标词")
    n = len(example.strip().split())
    if n < 4 or n > 16:
        errors.append(f"例句长度{n}")
    return errors


def series_of(code: string) -> str:
    for series in SERIES_BOOKS:
        if code.startswith(f"{series}-") or code == series:
            return series
    raise SystemExit(f"unknown book/series: {code}")


def codes_from_args(args: list[str]) -> list[tuple[str, str]]:
    if not args:
        return [(series, code) for series, codes in SERIES_BOOKS.items() for code in codes]
    pairs = []
    for arg in args:
        if arg in SERIES_BOOKS:
            pairs.extend((arg, code) for code in SERIES_BOOKS[arg])
        else:
            pairs.append((series_of(arg), arg))
    return pairs


def main() -> int:
    failed = 0
    for series, code in codes_from_args(sys.argv[1:]):
        book_path = BOOKS / f"{code}.json"
        gloss_path = KEW / series / f"{code}-glosses.json"
        if not book_path.exists():
            print(f"{code}: MISSING {book_path}")
            failed += 1
            continue
        if not gloss_path.exists():
            print(f"{code}: MISSING {gloss_path}")
            failed += 1
            continue
        book = json.loads(book_path.read_text(encoding="utf-8"))
        glosses = json.loads(gloss_path.read_text(encoding="utf-8"))
        keys = []
        missing = []
        bad = []
        for item in book["words"]:
            word = item["word"]
            key = word
            keys.append(key)
            if key not in glosses:
                missing.append(key)
                continue
            errors = validate(word, glosses[key])
            if errors:
                bad.append(f"{key}: {'; '.join(errors)}")
        extra = sorted(set(glosses) - set(keys))
        print(f"{code}: {len(keys)} keys, missing {len(missing)}, invalid {len(bad)}, extra {len(extra)}")
        for line in missing[:8] + bad[:8]:
            print(" ", line)
        if missing or bad:
            failed += 1
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
