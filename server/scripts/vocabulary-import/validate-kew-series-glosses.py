"""Validate 4500/7200 series gloss JSON against 1200-style rules."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GLOSS_DIR = ROOT / "data" / "sources" / "kew" / "series"
INPUT_DIR = GLOSS_DIR / "input"
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
    if len(meaning) > 20:
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


def main() -> int:
    codes = sys.argv[1:] or [
        "kew4500-1",
        "kew4500-2",
        "kew4500-3",
        "kew4500-4",
        "kew7200-1",
        "kew7200-2",
        "kew7200-3",
    ]
    failed = 0
    for code in codes:
        input_rows = json.loads((INPUT_DIR / f"{code}.json").read_text(encoding="utf-8"))
        gloss_path = GLOSS_DIR / f"{code}-glosses.json"
        if not gloss_path.exists():
            print(f"{code}: MISSING {gloss_path}")
            failed += 1
            continue
        glosses = json.loads(gloss_path.read_text(encoding="utf-8"))
        missing = []
        bad = []
        for row in input_rows:
            key = row["key"]
            if key not in glosses:
                missing.append(key)
                continue
            errors = validate(row["word"], glosses[key])
            if errors:
                bad.append(f"{key}: {'; '.join(errors)}")
        extra = sorted(set(glosses) - {row["key"] for row in input_rows})
        print(f"{code}: {len(input_rows)} keys, missing {len(missing)}, invalid {len(bad)}, extra {len(extra)}")
        for line in (missing[:8] + bad[:8]):
            print(" ", line)
        if missing or bad:
            failed += 1
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
