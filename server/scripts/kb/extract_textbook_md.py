#!/usr/bin/env python3
"""Extract English textbook PDF text layers into Markdown (dialogues + vocabulary).

Personal study use only. Skips image-only / empty-text PDFs.
"""

from __future__ import annotations

import argparse
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

import fitz

NOISE = re.compile(
    r"^(?:"
    r"\d{1,3}|A|B|C|D|E|F|"
    r"Look and (?:think|match|say)|Role-play|Self-check|"
    r"Listen and (?:chant|sing|do|circle|repeat)|"
    r"Write and say\.?|Project:.*|Reading time|Contents|"
    r"Can you read\s*the words\?|"
    r"Letters and sounds|"
    r"Start to read|"
    r"How (?:do|can|are) .*\?$"
    r")$",
    re.I,
)

SECTION_MARKERS = [
    ("lets-talk", re.compile(r"^Let['’]s talk\b", re.I)),
    ("lets-learn", re.compile(r"^Let['’]s learn\b", re.I)),
    ("lets-try", re.compile(r"^Let['’]s try\b", re.I)),
    ("lets-read", re.compile(r"^Let['’]s read\b", re.I)),
    ("read-and-write", re.compile(r"^Read and write\b", re.I)),
    ("listen-and-say", re.compile(r"^Listen and say\b", re.I)),
    ("listen-and-do", re.compile(r"^Listen and do\b", re.I)),
    ("start-to-read", re.compile(r"^Start to read\b", re.I)),
    ("just-talk", re.compile(r"^Just talk\b", re.I)),
    ("just-practise", re.compile(r"^Just practise\b", re.I)),
]

UNIT_LINE = re.compile(r"Unit\s*(\d+)\s*[.\-–—:]?\s*(.*)$", re.I)
UNIT_WORD = re.compile(
    r"Unit\s+(One|Two|Three|Four|Five|Six|Seven|Eight)\b(.*)$",
    re.I,
)
PAGE_NUM = re.compile(r"^\d{1,3}$")
WORD_TOKEN = re.compile(r"^[A-Za-z][A-Za-z'\-]{0,24}$")
WORD_ENTRY = re.compile(
    r"^\*?([A-Za-z][A-Za-z '\-]{0,40}?)\s*(?:/[^/]+/\s*)?(?:[^\u4e00-\u9fff]*)([\u4e00-\u9fff].+)?$"
)
SPEAKER_LINE = re.compile(
    r"^(?P<speaker>[A-Z][a-z]+(?:\s[A-Z][a-z]+)?|Miss\s+[A-Z][a-z]+|Mr\s+[A-Z][a-z]+|"
    r"Mrs\s+[A-Z][a-z]+|Ms\s+[A-Z][a-z]+|Mum|Dad|Zoom|Zip|All)\s*[:：\-–—]\s*(?P<text>.+)$"
)
DIALOGUE_LIKE = re.compile(
    r"^(?:Hi[!.,]?|Hello[!.,]?|Bye[!.,]?|Yes[,.]?|No[,.]?|Thanks?[!.,]?|"
    r"Nice to meet you(?: too)?[!.,]?|"
    r"I(?:'m| am)\b|My name\b|This is\b|That is\b|What(?:'s| is)\b|Where\b|Who\b|"
    r"How\b|Look[!.,]?|Great[!.,]?|Oh no[!.,]?|It's\b|Is (?:he|she|this|that)\b|"
    r"We can\b|I like\b|I have\b|I listen\b|I smile\b|I help\b|I share\b|"
    r"Do you\b|Can (?:I|you)\b|Wave your\b|Point to\b|Look into\b).+",
    re.I,
)

WORD_NUM = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
}


@dataclass
class UnitInfo:
    number: int
    title: str = ""
    start_book_page: int | None = None
    start_pdf: int | None = None
    end_pdf: int | None = None


@dataclass
class BookMeta:
    series_key: str
    series_label: str
    grade: str
    term: str
    edition: str
    stem: str
    source_pdf: Path


@dataclass
class ExtractResult:
    meta: BookMeta
    units: list[UnitInfo] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    wrote: list[Path] = field(default_factory=list)


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "-", text)
    text = re.sub(r"-{2,}", "-", text).strip("-")
    return text[:60] or "untitled"


def parse_filename(path: Path, series_dir: str) -> BookMeta:
    name = path.stem
    grade_m = re.search(r"([三四五六]年级)", name)
    term_m = re.search(r"(上册|下册)", name)
    edition_m = re.search(r"\((\d{4}[秋春冬夏]?版?)\)", name)
    grade = grade_m.group(1) if grade_m else "未知年级"
    term = term_m.group(1) if term_m else ""
    edition = edition_m.group(1) if edition_m else ""
    if series_dir.startswith("人教版(PEP)"):
        series_key, series_label = "人教版-PEP", "人教版 PEP"
    else:
        series_key, series_label = "人教版-精通", "人教版 精通"
    gmap = {"三年级": "03", "四年级": "04", "五年级": "05", "六年级": "06"}
    gcode = gmap.get(grade, grade)
    tcode = "上" if "上" in term else ("下" if "下" in term else "")
    ed = edition.replace("版", "") if edition else ""
    stem = f"{gcode}{tcode}" + (f"-{ed}" if ed else "")
    return BookMeta(series_key, series_label, grade, term, edition, stem, path)


def _looks_like_speaker_label(line: str) -> bool:
    return bool(
        re.match(
            r"^(Miss\s+[A-Z][a-z]+|Mr\s+[A-Z][a-z]+|Mrs\s+[A-Z][a-z]+|Ms\s+[A-Z][a-z]+|"
            r"Mum|Dad|All|Both|Class|Zoom|Zip|[A-Z][a-z]+)(?:\s[A-Z][a-z]+)?\s*[:：]\s*$",
            line,
        )
    )


def normalize_lines(text: str) -> list[str]:
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("\u2003", " ").replace("\u00a0", " ")
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", text)
    raw = [re.sub(r"[ \t]+", " ", ln).strip() for ln in text.splitlines()]
    raw = [ln for ln in raw if ln]
    joined: list[str] = []
    i = 0
    while i < len(raw):
        cur = raw[i]
        while i + 1 < len(raw):
            nxt = raw[i + 1]
            # never glue speaker labels together or onto dialogue
            if _looks_like_speaker_label(cur) or _looks_like_speaker_label(nxt):
                break
            if (
                len(cur) < 42
                and not cur.endswith((".", "!", "?", "。", "！", "？", ":", "："))
                and not PAGE_NUM.match(nxt)
                and not UNIT_LINE.match(nxt)
                and not UNIT_WORD.match(nxt)
                and not any(p.match(nxt) for _, p in SECTION_MARKERS)
                and not re.match(r"^(Part\s*[ABC]|Unit\s*\d+|Appendix|Lesson\s*\d+)\b", nxt, re.I)
            ):
                cur = f"{cur} {nxt}".strip()
                i += 1
                continue
            break
        joined.append(cur)
        i += 1
    return joined


def page_texts(doc: fitz.Document) -> list[str]:
    return [page.get_text("text") for page in doc]


def find_contents_page(pages: list[str]) -> int | None:
    for i, text in enumerate(pages[:15]):
        if re.search(r"\bContents\b", text, re.I) and re.search(r"\bUnit\s*(?:1|One)\b", text, re.I):
            return i
    return None


def parse_toc_units(contents_text: str) -> list[UnitInfo]:
    lines = normalize_lines(contents_text)
    units: list[UnitInfo] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        m = UNIT_LINE.match(line)
        mw = UNIT_WORD.match(line) if not m else None
        if m or mw:
            if m:
                num = int(m.group(1))
                title = m.group(2).strip(" .\t")
            else:
                num = WORD_NUM[mw.group(1).lower()]
                title = mw.group(2).strip(" .\t")
            start = None
            trailing = re.search(r"(\d{1,3})\s*$", title)
            if trailing and not re.search(r"[A-Za-z]", trailing.group(0)):
                maybe = int(trailing.group(1))
                # avoid swallowing year-like; book pages usually < 120
                if maybe <= 120:
                    start = maybe
                    title = title[: trailing.start()].strip()
            for j in range(i + 1, min(i + 4, len(lines))):
                if PAGE_NUM.match(lines[j]):
                    start = int(lines[j])
                    break
                if not title and re.search(r"[A-Za-z]{3,}", lines[j]) and len(lines[j]) < 70:
                    if not UNIT_LINE.match(lines[j]) and not UNIT_WORD.match(lines[j]):
                        title = lines[j]
            if not title:
                for k in range(max(0, i - 3), min(len(lines), i + 4)):
                    if k == i:
                        continue
                    cand = lines[k]
                    if PAGE_NUM.match(cand) or UNIT_LINE.match(cand) or UNIT_WORD.match(cand):
                        continue
                    if re.search(r"[A-Za-z]{3,}", cand) and len(cand) < 70:
                        title = cand
                        break
            units.append(UnitInfo(number=num, title=title or f"Unit {num}", start_book_page=start))
        i += 1

    # 精通 TOC often lists Unit N and title/page in scrambled order; pair pages after units
    if units and sum(1 for u in units if u.start_book_page) < len(units) // 2:
        pages_found = [int(ln) for ln in lines if PAGE_NUM.match(ln) and 1 <= int(ln) <= 120]
        # heuristic: first N distinct ascending pages near top half
        uniq_pages = []
        for p in pages_found:
            if not uniq_pages or p >= uniq_pages[-1]:
                if p not in uniq_pages:
                    uniq_pages.append(p)
        if len(uniq_pages) >= len(units):
            for u, p in zip(units, uniq_pages):
                if u.start_book_page is None:
                    u.start_book_page = p

    seen: dict[int, UnitInfo] = {}
    for u in units:
        if u.number not in seen:
            seen[u.number] = u
    return [seen[k] for k in sorted(seen)]


def discover_unit_headers(pages: list[str]) -> dict[int, int]:
    """Map unit number -> first PDF index of a likely unit opener."""
    contents_i = find_contents_page(pages)
    found: dict[int, tuple[int, int]] = {}
    for i, text in enumerate(pages):
        if contents_i is not None and i == contents_i:
            continue
        # skip contents-like listings even without the word Contents
        if len(re.findall(r"\bUnit\s*\d+\b", text, re.I)) >= 4 and re.search(r"Appendix|Revision", text, re.I):
            continue
        if re.search(r"Appendix|Words in each unit|Vocabulary in each unit|Useful expressions|Songs\b", text, re.I):
            if len(text.strip()) > 400:
                continue
        lines = normalize_lines(text)[:12]
        compact = "\n".join(lines)
        candidates: list[tuple[int, int]] = []
        for ln in lines:
            m = UNIT_LINE.fullmatch(ln) or UNIT_LINE.match(ln)
            if m and len(ln) < 20:
                candidates.append((int(m.group(1)), 6))
            mw = UNIT_WORD.match(ln)
            if mw:
                candidates.append((WORD_NUM[mw.group(1).lower()], 5))
        for m in UNIT_WORD.finditer(compact):
            candidates.append((WORD_NUM[m.group(1).lower()], 3))
        for m in re.finditer(r"\bUnit\s*(\d+)\b", compact, re.I):
            candidates.append((int(m.group(1)), 2 if len(text.strip()) < 250 else 1))
        # opener pages often include a theme word + book page number
        if re.search(r"\bUnit\s*\d+\b", compact, re.I) and len(text.strip()) < 200:
            for m in re.finditer(r"\bUnit\s*(\d+)\b", compact, re.I):
                candidates.append((int(m.group(1)), 7))
        for num, score in candidates:
            if 1 <= num <= 8:
                prev = found.get(num)
                if prev is None or score > prev[0] or (score == prev[0] and i < prev[1]):
                    found[num] = (score, i)
    return {n: idx for n, (_, idx) in found.items()}


def discover_lesson1_starts(pages: list[str]) -> list[int]:
    """精通教材单元起点：

    - 旧版：全局 Lesson 1/7/13/19/25/31
    - 新版（如 2024 秋三年级）：每单元重新从 Lesson 1 起

    注意：旧版 Lesson 标题常在页内偏后（插图后），需扫描足够行数。
    """
    lesson1_pages: list[int] = []
    global_starts: list[int] = []
    seen_global: set[int] = set()
    for i, text in enumerate(pages):
        # 跳过目录与附录区
        if i < 6 and re.search(r"\bContents\b", text, re.I):
            continue
        if re.search(r"Words in each unit|Vocabulary in each unit|Useful expressions", text, re.I):
            if i > len(pages) * 0.7:
                continue
        lines = normalize_lines(text)
        lesson_no = None
        for ln in lines[:40]:
            m = re.search(r"\bLesson\s*(\d+)\b", ln, re.I)
            if m:
                lesson_no = int(m.group(1))
                break
        if lesson_no is None:
            # 原文层偶发 "Lesson19" 无空格
            m = re.search(r"\bLesson\s*(\d+)\b", text[:800], re.I)
            if m:
                lesson_no = int(m.group(1))
        if lesson_no is None:
            continue
        if lesson_no == 1:
            if not lesson1_pages or i - lesson1_pages[-1] >= 4:
                lesson1_pages.append(i)
        if lesson_no % 6 == 1 and lesson_no not in seen_global:
            if not global_starts or i - global_starts[-1] >= 4:
                seen_global.add(lesson_no)
                global_starts.append(i)
    # Prefer restarted Lesson 1 pattern when we clearly see multiple Unit openers
    if len(lesson1_pages) >= 4:
        return lesson1_pages[:6]
    return global_starts


def discover_jt_unit_starts(pages: list[str]) -> list[int]:
    """精通单元起点：优先完整 Unit 页眉，否则 Lesson 序列，再合并去重。"""
    headers = discover_unit_headers(pages)
    # 正文 Unit 页眉（排除附录里重复的 Unit 1）
    body_headers = {
        n: idx
        for n, idx in headers.items()
        if idx < int(len(pages) * 0.85) and 1 <= n <= 6
    }
    if len(body_headers) >= 5:
        return [body_headers[n] for n in sorted(body_headers)]

    lessons = discover_lesson1_starts(pages)
    if len(lessons) >= 5:
        return lessons[:6]

    # 合并：以 Lesson 为主，用 Unit 页眉补洞
    starts = list(lessons)
    for n in sorted(body_headers):
        idx = body_headers[n]
        if any(abs(idx - s) < 4 for s in starts):
            continue
        starts.append(idx)
    starts = sorted(starts)
    # 去近邻
    merged: list[int] = []
    for s in starts:
        if not merged or s - merged[-1] >= 5:
            merged.append(s)
    return merged[:6]


def assign_pdf_ranges(units: list[UnitInfo], pages: list[str]) -> None:
    headers = discover_unit_headers(pages)
    lesson_starts = discover_lesson1_starts(pages)

    # Prefer TOC book-page + offset when possible
    offset = None
    if 1 in headers:
        u1 = next((u for u in units if u.number == 1), None)
        if u1 and u1.start_book_page:
            offset = (headers[1] + 1) - u1.start_book_page  # pdf_1based - book_page
    if offset is None and lesson_starts:
        u1 = next((u for u in units if u.number == 1), None)
        if u1 and u1.start_book_page:
            offset = (lesson_starts[0] + 1) - u1.start_book_page

    for unit in units:
        if offset is not None and unit.start_book_page:
            unit.start_pdf = max(0, unit.start_book_page + offset - 1)
        elif unit.number in headers:
            unit.start_pdf = headers[unit.number]
        elif unit.start_book_page and offset is not None:
            unit.start_pdf = max(0, unit.start_book_page + offset - 1)

    # If still missing, fill from headers / Lesson 1 sequence
    for unit in units:
        if unit.start_pdf is None and unit.number in headers:
            unit.start_pdf = headers[unit.number]
    missing = [u for u in units if u.start_pdf is None]
    if missing and lesson_starts:
        # map remaining units in order onto leftover lesson starts
        used = {u.start_pdf for u in units if u.start_pdf is not None}
        free = [i for i in lesson_starts if i not in used]
        for unit, start in zip(sorted(missing, key=lambda u: u.number), free):
            unit.start_pdf = start

    # If almost none located but Lesson 1 list looks complete, remap all by order
    located = sum(1 for u in units if u.start_pdf is not None)
    if located < max(2, len(units) // 2) and len(lesson_starts) >= len(units):
        for unit, start in zip(sorted(units, key=lambda u: u.number), lesson_starts):
            unit.start_pdf = start

    ordered = sorted([u for u in units if u.start_pdf is not None], key=lambda u: (u.start_pdf or 0, u.number))
    for idx, unit in enumerate(ordered):
        start = unit.start_pdf or 0
        if idx + 1 < len(ordered):
            nxt = ordered[idx + 1].start_pdf or start
            end = nxt - 1
        else:
            end = len(pages) - 1
            for j in range(start + 1, len(pages)):
                if re.search(r"Words in each unit|Useful expressions|Appendix 1|Vocabulary", pages[j], re.I):
                    end = j - 1
                    break
        end = min(max(start, end), start + 16, len(pages) - 1)
        unit.end_pdf = end


def is_noise_line(line: str) -> bool:
    if NOISE.match(line):
        return True
    if PAGE_NUM.match(line):
        return True
    if re.fullmatch(r"[=\u25cf\u25a0\u2022·.•]+", line):
        return True
    return False


def classify_section(line: str) -> str | None:
    for name, pattern in SECTION_MARKERS:
        if pattern.match(line):
            return name
    return None


def extract_dialogues(lines: list[str]) -> list[tuple[str, list[str]]]:
    sections: list[tuple[str, list[str]]] = []
    current_name = "课文语句"
    current: list[str] = []
    active = False
    labels = {
        "lets-talk": "Let's talk",
        "lets-learn": "Let's learn",
        "lets-try": "Let's try",
        "lets-read": "Let's read",
        "read-and-write": "Read and write",
        "listen-and-say": "Listen and say",
        "listen-and-do": "Listen and do",
        "start-to-read": "Start to read",
        "just-talk": "Just talk",
        "just-practise": "Just practise",
    }

    def flush():
        nonlocal current
        cleaned = []
        seen = set()
        for line in current:
            if is_noise_line(line) or UNIT_LINE.match(line) or UNIT_WORD.match(line):
                continue
            if re.match(r"^Part\s*[ABC]\b", line, re.I):
                continue
            keep = bool(SPEAKER_LINE.match(line) or DIALOGUE_LIKE.match(line) or (len(line) <= 90 and line.endswith((".", "!", "?"))))
            if not keep:
                continue
            key = line.lower()
            if key in seen:
                continue
            seen.add(key)
            cleaned.append(line)
        if cleaned:
            sections.append((current_name, cleaned[:50]))
        current = []

    for line in lines:
        sec = classify_section(line)
        if sec:
            flush()
            current_name = labels[sec]
            active = True
            continue
        if re.match(r"^Part\s*[BC]\b", line, re.I) and active:
            flush()
            active = False
            continue
        if active:
            current.append(line)
        elif SPEAKER_LINE.match(line) or DIALOGUE_LIKE.match(line):
            if not current:
                current_name = "课文语句"
            current.append(line)
            active = True
    flush()
    return sections


def extract_vocab(lines: list[str]) -> list[str]:
    vocab: list[str] = []
    near = False
    for i, line in enumerate(lines):
        if classify_section(line) in {"lets-learn", "start-to-read"} or re.search(r"\bwords?\b", line, re.I):
            near = True
        if is_noise_line(line):
            continue
        parts = re.split(r"[\t/;|]+|\s{2,}", line)
        for part in parts if len(parts) > 1 else [line]:
            part = part.strip(" .,;:·•*")
            if WORD_TOKEN.match(part) and len(part) >= 2:
                if part.lower() in {"listen", "circle", "write", "read", "repeat", "chant", "play", "look", "think", "match"} and not near:
                    continue
                vocab.append(part)
        if near and classify_section(line) in {"lets-talk", "lets-try"}:
            near = False
    seen = set()
    out = []
    for w in vocab:
        key = w.lower()
        if key in seen or key in {"unit", "part", "yes", "too", "the", "and", "for", "you", "your"}:
            continue
        seen.add(key)
        out.append(w)
    return out[:100]


def find_appendix_page(pages: list[str], heading: str, zh_hint: str = "") -> int | None:
    """Find the real appendix title page, skipping Contents listings."""
    for i, text in enumerate(pages):
        if re.search(r"\bContents\b", text, re.I) and i < 20:
            continue
        lines = normalize_lines(text)[:10]
        if not lines:
            continue
        head = "\n".join(lines[:6])
        if re.search(rf"^{re.escape(heading)}\b", lines[0], re.I):
            return i
        if any(re.fullmatch(rf"{re.escape(heading)}", ln, re.I) for ln in lines[:4]):
            return i
        # heading may be glued: "Words in each unit 单 元 词 汇 表"
        if re.search(rf"\b{re.escape(heading)}\b", lines[0], re.I):
            return i
        if zh_hint and zh_hint in text.replace(" ", "") and re.search(heading, head, re.I):
            return i
    for i, text in enumerate(pages):
        if re.search(r"\bContents\b", text, re.I) and i < 20:
            continue
        lines = normalize_lines(text)[:8]
        if any(re.search(heading, ln, re.I) for ln in lines[:5]):
            return i
    return None


def find_vocab_appendix_start(pages: list[str]) -> int | None:
    """Locate unit vocabulary appendix across PEP / 精通 layout variants."""
    for heading in (
        "Words in each unit",
        "Vocabulary in each unit",
        "Appendix 2",
    ):
        hit = find_appendix_page(pages, heading, zh_hint="单元词汇")
        if hit is not None:
            return hit
    # 旧精通：书末直接 Unit 1 + 中文释义，无 Words 标题
    start = max(0, len(pages) - max(12, len(pages) // 5))
    best: tuple[int, int] | None = None
    for i in range(start, len(pages)):
        text = pages[i]
        if re.search(r"\bContents\b", text, re.I):
            continue
        cn = len(re.findall(r"[\u4e00-\u9fff]", text))
        units = len(re.findall(r"\bUnit\s*[1-8]\b", text, re.I))
        stars = text.count("*")
        score = cn + units * 20 + stars * 3
        if cn >= 20 and units >= 1 and (stars >= 3 or cn >= 40):
            if best is None or score > best[0]:
                best = (score, i)
    return best[1] if best else None


def parse_unit_blocks(pages: list[str], heading: str, zh_hint: str = "") -> dict[int, list[str]]:
    """Parse appendix sections grouped by Unit N."""
    start = find_appendix_page(pages, heading, zh_hint=zh_hint)
    if start is None and heading.lower() in {
        "words in each unit",
        "vocabulary in each unit",
        "appendix 2",
    }:
        start = find_vocab_appendix_start(pages)
    if start is None:
        return {}
    lines: list[str] = []
    for text in pages[start : min(len(pages), start + 18)]:
        lines.extend(normalize_lines(text))

    result: dict[int, list[str]] = {}
    current = None
    for line in lines:
        # Alphabetical word list / alphabet ends the per-unit appendix
        if current is not None and re.match(r"^(Vocabulary|The alphabet)\b", line, re.I):
            if "in each unit" not in line.lower():
                break
        if current is not None and re.match(r"^Useful expressions\b", line, re.I):
            break
        if current is not None and re.match(r"^常用表达", line):
            break
        # alphabetical vocabulary section headers: "A", "B *apple..."
        if current is not None and re.match(r"^[A-Z](?:\s|$|\*)", line) and not re.match(
            r"^(Unit|Appendix|Lesson|Part)\b", line, re.I
        ):
            if len(line) < 4 or re.match(r"^[A-Z]\s+\*", line):
                break
        # "Appendix 3 *nine ..." still belongs to current unit vocab
        if re.match(r"^Appendix\s*\d+\b", line, re.I):
            if re.search(r"[*A-Za-z].*[\u4e00-\u9fff]|/[A-Za-zəɪʊæɑɒʌɜːˈˌθʃŋʒð]+/", line):
                line = re.sub(r"^Appendix\s*\d+\s*", "", line).strip()
                if not line:
                    continue
            else:
                # bare appendix title — keep scanning (next lines may still be unit words)
                continue
        m = UNIT_LINE.match(line)
        mw = UNIT_WORD.match(line)
        if m or mw:
            current = int(m.group(1)) if m else WORD_NUM[mw.group(1).lower()]
            if current > 8:
                continue
            result.setdefault(current, [])
            rest = (m.group(2) if m else mw.group(2)).strip()
            # "Unit 3 Vocabulary in each unit" note line
            if re.search(r"Vocabulary in each unit|Words in each unit|注[:：]", rest, re.I):
                rest = re.split(r"Vocabulary in each unit|Words in each unit|注[:：]", rest, 1, flags=re.I)[0].strip()
            if rest and not PAGE_NUM.match(rest):
                result[current].append(rest)
            continue
        if current is None:
            continue
        if re.match(r"^(Words in each unit|Useful expressions|单元词汇|常用表达)\b", line, re.I):
            continue
        if re.match(r"^注[:：]", line):
            continue
        result[current].append(line)
    return result


VOCAB_ATOM = re.compile(
    r"""
    \*?
    (?P<eng>
        Good\s+(?:morning|afternoon|evening|night)!|
        Goodbye!|
        Bye!|
        Happy\s+birthday!|
        Here\s+you\s+are\.|
        Thank\s+you!|
        You(?:'re|’re)\s+welcome!|
        What\s+about\s+\.\.\.\?|
        [A-Za-z][A-Za-z' =\-]{0,40}
    )
    (?:\s*[（(][^)）]*[)）])?
    \s*
    (?:/[^/\n]+/\s*)?
    (?P<zh>[\u4e00-\u9fff][\u4e00-\u9fff\s；;，,、（）()\.…\<\>]{0,80})?
    """,
    re.VERBOSE,
)


def _flatten_vocab_blob(lines: list[str]) -> str:
    """Join wrapped appendix lines, then keep *markers for splitting."""
    parts: list[str] = []
    for line in lines:
        if UNIT_LINE.match(line) or UNIT_WORD.match(line):
            continue
        if re.match(r"^(注：|黑体|白体|Vocabulary|Words in each unit|单元词汇)", line):
            continue
        parts.append(line)
    blob = " ".join(parts)
    blob = re.sub(r"p\.\s*\d+", " ", blob)
    blob = re.sub(r"\s+", " ", blob)
    return blob


def _is_expression_entry(eng: str) -> bool:
    """Phrase/sentence entries that belong in 常用表达法."""
    eng = eng.strip()
    if re.search(r"[.!?]$", eng):
        return True
    if re.match(
        r"^(Good (?:morning|afternoon|evening|night)|Goodbye|Bye|Happy birthday|"
        r"Here you are|Thank you|You(?:'re|’re) welcome|What about)\b",
        eng,
        re.I,
    ):
        return True
    return False


def appendix_unit_lexicon(pages: list[str]) -> tuple[dict[int, list[str]], dict[int, list[str]]]:
    """Parse end-of-book 单元词汇表 into (words, phrase-expressions)."""
    blocks = parse_unit_blocks(pages, "Words in each unit", zh_hint="单元词汇")
    source = "Words in each unit"
    if not blocks:
        blocks = parse_unit_blocks(pages, "Vocabulary in each unit", zh_hint="单元词汇")
        source = "Vocabulary in each unit"
    if not blocks:
        blocks = parse_unit_blocks(pages, "Appendix 2", zh_hint="单元词汇")
        source = "Appendix 2"
    if not blocks:
        # last-resort: heuristic page near end (旧精通无 Words 标题)
        start = find_vocab_appendix_start(pages)
        if start is not None:
            lines = []
            for text in pages[start : min(len(pages), start + 18)]:
                lines.extend(normalize_lines(text))
            blocks = {}
            current = None
            for line in lines:
                m = UNIT_LINE.match(line)
                if m:
                    current = int(m.group(1))
                    if current > 8:
                        continue
                    blocks.setdefault(current, [])
                    rest = m.group(2).strip()
                    if rest:
                        blocks[current].append(rest)
                    continue
                if current is None:
                    continue
                if re.match(r"^(Vocabulary|The alphabet|Useful expressions)\b", line, re.I):
                    break
                blocks[current].append(line)
            source = f"heuristic@p{start}"
    words_out: dict[int, list[str]] = {}
    phrases_out: dict[int, list[str]] = {}
    for num, lines in blocks.items():
        blob = _flatten_vocab_blob(lines)
        # normalize glued page refs: "名字 p. 4 *nice" → keep VOCAB_ATOM happy
        blob = re.sub(r"\bp\.\s*\d+\b", " ", blob)
        blob = re.sub(r"\s+", " ", blob)
        words: list[str] = []
        phrases: list[str] = []
        for m in VOCAB_ATOM.finditer(blob):
            eng = re.sub(r"\s+", " ", m.group("eng")).strip(" -=")
            zh = (m.group("zh") or "").strip()
            zh = re.sub(r"\s+", "", zh)
            if len(eng) > 48:
                continue
            if len(eng) < 2 and eng.lower() != "i":
                continue
            low = eng.lower()
            if low in {"unit", "appendix", "vocabulary", "words", "the", "a", "an", "m", "s", "re", "ll", "ve", "d", "t"}:
                continue
            if low in {"am", "is", "are", "hi"} and not zh:
                continue
            item = f"{eng} — {zh}" if zh else eng
            if _is_expression_entry(eng):
                phrases.append(item)
            else:
                words.append(item)
        def uniq(items: list[str]) -> list[str]:
            seen = set()
            out = []
            for w in items:
                key = w.split(" — ", 1)[0].lower()
                if key in seen:
                    continue
                seen.add(key)
                out.append(w)
            return out

        cleaned = uniq(words)
        # 若误吸入书末总词汇表，截断到合理单元规模
        if len(cleaned) > 45:
            cleaned = cleaned[:40]
        words_out[num] = cleaned
        phrases_out[num] = uniq(phrases)
    # stash source name for notes via attribute on function
    appendix_unit_lexicon.source = source  # type: ignore[attr-defined]
    return words_out, phrases_out


def appendix_expressions(pages: list[str]) -> dict[int, list[str]]:
    """Parse end-of-book Useful expressions / 常用表达法."""
    blocks = parse_unit_blocks(pages, "Useful expressions", zh_hint="常用表达")
    if not blocks:
        blocks = parse_unit_blocks(pages, "常用表达法", zh_hint="常用表达")
    out: dict[int, list[str]] = {}
    for num, lines in blocks.items():
        merged: list[str] = []
        for line in lines:
            if merged and not re.search(r"[A-Za-z]", line) and re.search(r"[\u4e00-\u9fff]", line):
                # keep gloss on previous as "eng — zh" later; skip pure Chinese line after capturing
                prev = merged[-1]
                if " — " not in prev and re.search(r"[\u4e00-\u9fff]", line):
                    gloss = re.sub(r"\s+", "", line)
                    merged[-1] = f"{prev} — {gloss}"
                continue
            if (
                merged
                and re.search(r"[A-Za-z]", line)
                and not line.endswith((".", "!", "?"))
                and not re.match(r"^[A-Z]", line)
            ):
                if not re.match(
                    r"^(Hi|Hello|Yes|No|Thanks|What|Where|Who|How|This|That|Do|Can|Is|Are|We|My|I|Oh|Hey|Nice|Look|Good|Bye)",
                    line,
                ):
                    merged[-1] = f"{merged[-1]} {line}".strip()
                    continue
            merged.append(line)
        exprs = []
        for line in merged:
            if not re.search(r"[A-Za-z]", line):
                continue
            if " — " in line:
                eng, zh = line.split(" — ", 1)
                eng = eng.strip()
                zh = zh.strip()
            else:
                parts = re.split(r"(?=[\u4e00-\u9fff])", line, maxsplit=1)
                eng = parts[0].strip(" -:\t")
                zh = parts[1].strip() if len(parts) > 1 else ""
            eng = re.sub(r"\s+", " ", eng).strip(" /")
            zh = re.sub(r"\s+", "", zh)
            if len(eng) < 2 or len(eng) > 120:
                continue
            if is_noise_line(eng):
                continue
            if re.search(r"Let['’]s (?:talk|learn|play|read|do)|Role-play|Look and|Listen and|Self-check", eng, re.I):
                continue
            if not (
                eng.endswith((".", "!", "?"))
                or re.match(r"^(Hi|Hello|Bye|Thanks|OK|Great)!?$", eng, re.I)
                or "/" in eng
            ):
                continue
            exprs.append(f"{eng} — {zh}" if zh else eng)
        seen = set()
        uniq = []
        for e in exprs:
            key = e.split(" — ", 1)[0].lower()
            if key in seen:
                continue
            seen.add(key)
            uniq.append(e)
        out[num] = uniq[:60]
    return out


def extract_self_check_talk(lines: list[str]) -> list[str]:
    """Pull complete A/B lines under 'I can talk'."""
    out: list[str] = []
    active = False
    for line in lines:
        if re.search(r"I can talk", line, re.I):
            active = True
            rest = re.split(r"I can talk\s*:?", line, maxsplit=1, flags=re.I)[-1].strip()
            if rest:
                line = rest
            else:
                continue
        if active and re.match(r"^\d+\s*I can\b", line):
            break
        if active and re.match(r"^Self-check\b", line, re.I):
            continue
        if not active:
            continue
        m = re.match(r"^([AB])\s*[:：]\s*(.+)$", line)
        if m:
            out.append(f"{m.group(1)}: {m.group(2).strip()}")
            continue
        if SPEAKER_LINE.match(line) or DIALOGUE_LIKE.match(line):
            out.append(line)
    return out


SPEAKER_ONLY = re.compile(
    r"^(?P<speaker>Miss\s+[A-Z][a-z]+|Mr\s+[A-Z][a-z]+|Mrs\s+[A-Z][a-z]+|Ms\s+[A-Z][a-z]+|"
    r"Mum|Dad|All|Both|Class|Zoom|Zip|"
    r"[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*[:：]\s*$"
)


def _is_utterance(line: str) -> bool:
    if is_noise_line(line):
        return False
    if re.search(
        r"Look,? (?:say|listen)|Let’s play|Let's play|Listen and|Read and|Write and|"
        r"Can you write|Fill in|Circle the|Questions:|Fun time|Act out|Self-check|"
        r"Good to know|Family name|Finger puppet",
        line,
        re.I,
    ):
        return False
    if SPEAKER_ONLY.match(line):
        return False
    if UNIT_LINE.match(line) or UNIT_WORD.match(line) or re.match(r"^Lesson\s*\d+\b", line, re.I):
        return False
    if classify_section(line):
        return False
    # names-only roster lines
    if re.fullmatch(r"[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?){1,6}", line):
        if not re.search(r"[.!?]", line):
            return False
    return bool(
        DIALOGUE_LIKE.match(line)
        or line.endswith((".", "!", "?"))
        or re.match(r"^(Stand up|Sit down|Good morning|Good afternoon|Good evening|Good night|Bye|Hello|Hi)\b", line, re.I)
    )


def _join_wrapped_utterances(raw: list[str]) -> list[str]:
    joined: list[str] = []
    for line in raw:
        if joined and not joined[-1].endswith((".", "!", "?")) and not SPEAKER_ONLY.match(line):
            joined[-1] = f"{joined[-1]} {line}".strip()
            continue
        joined.append(line)
    return joined


def _pair_speakers_utterances(speakers: list[str], utterances: list[str]) -> list[str]:
    """Pair speaker labels with following lines. Extra early lines go to the first speaker."""
    if not speakers or not utterances:
        return []
    utt = list(utterances)
    if len(utt) < len(speakers):
        # not enough lines — zip what we can
        return [f"{sp}: {u}" for sp, u in zip(speakers, utt)]
    if len(utt) == len(speakers):
        return [f"{sp}: {u}" for sp, u in zip(speakers, utt)]
    # More utterances than speakers: give surplus to the first speaker
    # (common: greeting + follow-up question).
    extra = len(utt) - len(speakers)
    first = " ".join(utt[: extra + 1]).strip()
    rest = utt[extra + 1 :]
    out = [f"{speakers[0]}: {first}"]
    for sp, u in zip(speakers[1:], rest):
        out.append(f"{sp}: {u}")
    return out


def extract_speaker_queue_dialogues(lines: list[str]) -> list[tuple[str, list[str]]]:
    """精通教材常见版式：先列 Miss Wu: / Yaoyao:，再列出对白。"""
    sections: list[tuple[str, list[str]]] = []
    i = 0
    lesson_tag = ""
    while i < len(lines):
        line = lines[i]
        lm = re.match(r"^Lesson\s*(\d+)\b", line, re.I)
        if lm:
            lesson_tag = f"Lesson {lm.group(1)}"
            i += 1
            continue
        sec = classify_section(line)
        if sec in {"lets-talk", "just-talk", "lets-read"}:
            title = {
                "lets-talk": "Let's talk",
                "just-talk": "Just talk",
                "lets-read": "Let's read",
            }[sec]
            if lesson_tag:
                title = f"{lesson_tag} · {title}"
            i += 1
            speakers: list[str] = []
            # collect empty speaker labels
            while i < len(lines) and SPEAKER_ONLY.match(lines[i]):
                speakers.append(SPEAKER_ONLY.match(lines[i]).group("speaker"))
                i += 1
            raw_utt: list[str] = []
            while i < len(lines):
                cur = lines[i]
                if SPEAKER_ONLY.match(cur) or classify_section(cur) or re.match(r"^Lesson\s*\d+\b", cur, re.I):
                    break
                if UNIT_LINE.match(cur) or re.match(r"^Part\s*[ABC]\b", cur, re.I):
                    break
                if re.search(r"Look,? (?:say|listen)|Let’s play|Let's play|Listen and|Read the following|Fill in|Circle the|Fun time|Self-check", cur, re.I):
                    break
                if PAGE_NUM.match(cur) or re.fullmatch(r"[A-D]", cur):
                    i += 1
                    continue
                # drop activity letters glued onto dialogue: "A Hi! I'm Mr Li."
                cur = re.sub(r"^[A-D]\s+(?=[A-Z“\"'])", "", cur)
                if _is_utterance(cur):
                    raw_utt.append(cur)
                elif raw_utt and not cur.endswith((".", "!", "?")):
                    raw_utt[-1] = f"{raw_utt[-1]} {cur}".strip()
                i += 1
            utt = _join_wrapped_utterances(raw_utt)
            if speakers and utt:
                # Use only enough lines for this speaker set (+1 for greeting+question).
                need = len(speakers) + 1
                paired = _pair_speakers_utterances(speakers, utt[:need])
                if paired:
                    sections.append((title, paired))
            elif utt:
                keep = [u for u in utt if u.endswith((".", "!", "?"))]
                # skip letter drills / numbered leftovers
                keep = [u for u in keep if not re.match(r"^\d+\s", u) and u not in {"!!!"}]
                if keep:
                    sections.append((title, keep))
            continue
        # speaker queue without explicit Let's talk marker (Lesson 2 classroom greeting)
        if SPEAKER_ONLY.match(line):
            speakers = []
            j = i
            while j < len(lines) and SPEAKER_ONLY.match(lines[j]):
                speakers.append(SPEAKER_ONLY.match(lines[j]).group("speaker"))
                j += 1
            if len(speakers) >= 2:
                raw_utt = []
                k = j
                while k < len(lines) and _is_utterance(lines[k]):
                    raw_utt.append(lines[k])
                    k += 1
                    if len(raw_utt) >= len(speakers) + 2:
                        break
                utt = _join_wrapped_utterances(raw_utt)
                paired = _pair_speakers_utterances(speakers, utt)
                if paired and len(paired) >= 2:
                    title = f"{lesson_tag} · 课堂问候" if lesson_tag else "课堂问候"
                    sections.append((title, paired))
                    i = k
                    continue
        i += 1
    return sections


def extract_clean_talk_sections(lines: list[str]) -> list[tuple[str, list[str]]]:
    """精通/正文：先抽 Let's talk 说话人对位，再附 Self-check 练习对话。"""
    sections = extract_speaker_queue_dialogues(lines)
    # Deduplicate identical blocks
    seen_block = set()
    uniq: list[tuple[str, list[str]]] = []
    for name, items in sections:
        key = tuple(items)
        if key in seen_block:
            continue
        seen_block.add(key)
        uniq.append((name, items))
    practice = extract_self_check_talk(lines)
    if practice:
        uniq.append(("练习对话（I can talk）", practice))
    return uniq


def render_unit_md(
    meta: BookMeta,
    unit: UnitInfo,
    page_slice: list[tuple[int, str]],
    vocab: list[str],
    expressions: list[str],
    *,
    has_useful_appendix: bool,
) -> str:
    all_lines: list[str] = []
    for _, text in page_slice:
        all_lines.extend(normalize_lines(text))

    title = unit.title.strip() if unit.title else f"Unit {unit.number}"
    if not title.lower().startswith("unit "):
        title = f"Unit {unit.number} {title}".strip()

    lines = [
        f"# {title}",
        "",
        f"- 系列：{meta.series_label}",
        f"- 册别：{meta.grade}{meta.term}" + (f"（{meta.edition}）" if meta.edition else ""),
        "- 学科：英语",
        "",
        "## 常用表达法",
        "",
    ]

    if expressions:
        for item in expressions:
            lines.append(f"- {item}")
        lines.append("")
    else:
        lines += ["_书末未找到本单元常用表达法。_", ""]

    # 精通等没有「常用表达法」附录时，保留课文 Let's talk 便于对照
    if not has_useful_appendix:
        talk = extract_clean_talk_sections(all_lines)
        # 练习对话单独可选；正文对话放在常用表达之后
        main = [(n, items) for n, items in talk if not n.startswith("练习对话")]
        if main:
            lines += ["## 课文对话", ""]
            for name, items in main:
                lines += [f"### {name}", ""]
                for item in items:
                    lines.append(f"- {item}")
                lines.append("")

    lines += ["## 词汇表", ""]
    if vocab:
        seen = set()
        for w in vocab:
            key = w.split(" — ", 1)[0].lower()
            if key in seen:
                continue
            seen.add(key)
            lines.append(f"- {w}")
    else:
        lines.append("_书末单元词汇表未抽出本单元词条。_")
    lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def render_index(meta: BookMeta, notes: list[str], files: list[tuple[UnitInfo, str]]) -> str:
    lines = [
        f"# {meta.series_label} · {meta.grade}{meta.term}",
        "",
        f"- 版本：{meta.edition or '未标注'}",
        f"- 源文件：`{meta.source_pdf.name}`",
        f"- 单元数：{len(files)}",
        "",
        "## 目录",
        "",
    ]
    for unit, filename in files:
        lines.append(f"- [Unit {unit.number} {unit.title}](./{filename})")
    if notes:
        lines += ["", "## 说明", ""]
        for note in notes:
            lines.append(f"- {note}")
    lines.append("")
    return "\n".join(lines)


def extract_book(pdf: Path, series_dir: str, out_root: Path) -> ExtractResult:
    meta = parse_filename(pdf, series_dir)
    result = ExtractResult(meta=meta)
    doc = fitz.open(pdf)
    pages = page_texts(doc)
    nonempty = sum(1 for t in pages if len(t.strip()) >= 20)
    book_dir = out_root / meta.series_key / meta.stem
    book_dir.mkdir(parents=True, exist_ok=True)
    for old in book_dir.glob("unit-*.md"):
        old.unlink()

    if nonempty < max(3, doc.page_count // 10):
        result.notes.append("文字层几乎为空（多为扫描版/纯图），已跳过自动抽取。")
        path = book_dir / "00-index.md"
        path.write_text(render_index(meta, result.notes, []), encoding="utf-8")
        result.wrote.append(path)
        return result

    contents_i = find_contents_page(pages)
    units: list[UnitInfo] = []
    if contents_i is not None:
        units = parse_toc_units(pages[contents_i])
    if not units:
        headers = discover_unit_headers(pages)
        units = [UnitInfo(number=n, title=f"Unit {n}", start_pdf=idx) for n, idx in sorted(headers.items())]
        result.notes.append("未解析到 Contents，已用正文 Unit 标题回退。")

    assign_pdf_ranges(units, pages)

    # 精通：Contents 双栏页码经常错位，按 Unit 页眉 / Lesson 1/7/13... 对齐
    if meta.series_key == "人教版-精通":
        jt_starts = discover_jt_unit_starts(pages)
        if len(jt_starts) >= 3:
            # 起点够 6 → 强制 6 课；否则按能定位到的数量
            target_n = 6 if len(jt_starts) >= 6 else min(6, max(len(units), len(jt_starts)))

            have = {u.number for u in units}
            for n in range(1, target_n + 1):
                if n not in have:
                    units.append(UnitInfo(number=n, title=f"Unit {n}"))
            ordered_units = sorted(units, key=lambda u: u.number)
            count = min(len(ordered_units), len(jt_starts), target_n, 6)
            for unit in ordered_units:
                unit.start_pdf = None
                unit.end_pdf = None
            for unit, start in zip(ordered_units[:count], jt_starts[:count]):
                unit.start_pdf = start
            for idx, unit in enumerate(ordered_units[:count]):
                start = unit.start_pdf or 0
                if idx + 1 < count:
                    end = (ordered_units[idx + 1].start_pdf or start) - 1
                else:
                    # 接到附录前
                    end = min(start + 18, len(pages) - 1)
                    for j in range(start + 1, min(len(pages), start + 25)):
                        if re.search(
                            r"Words in each unit|Vocabulary in each unit|Useful expressions|Appendix\s*1",
                            pages[j],
                            re.I,
                        ):
                            end = j - 1
                            break
                unit.end_pdf = min(max(start, end), start + 18, len(pages) - 1)
            units[:] = ordered_units[:count]
            result.notes.append(f"精通教材按 Unit/Lesson 序列对齐了 {count} 个单元。")

    # enrich titles from opener pages / nearby TOC-like phrases
    for unit in units:
        if unit.start_pdf is None:
            continue
        messy = (
            not unit.title
            or re.fullmatch(rf"Unit\s*{unit.number}", unit.title, re.I)
            or re.search(r"\b\d{1,3}\b", unit.title)
            or "Fun Time" in unit.title
        )
        if not messy:
            continue
        opener = normalize_lines(pages[unit.start_pdf])[:12]
        # try dialogue first speaker line topic fallback: previous page title-ish
        prev_lines = normalize_lines(pages[unit.start_pdf - 1])[:8] if unit.start_pdf > 0 else []
        candidates = prev_lines + opener
        for ln in candidates:
            if UNIT_LINE.match(ln) or UNIT_WORD.match(ln) or PAGE_NUM.match(ln):
                continue
            if re.match(r"^Lesson\s*\d+\b", ln, re.I):
                continue
            if re.match(r"^Just (?:talk|practise|write)\b", ln, re.I):
                continue
            if re.search(r"[A-Za-z]{3,}", ln) and 3 < len(ln) < 70:
                unit.title = re.sub(r"\s+\d{1,3}$", "", ln).strip()
                break
    vocab_map, phrase_map = appendix_unit_lexicon(pages)
    expr_map = appendix_expressions(pages)
    has_useful_appendix = bool(expr_map)
    if vocab_map:
        src = getattr(appendix_unit_lexicon, "source", "单元词汇表")
        result.notes.append(f"词汇取自书末附录 {src}。")
    if expr_map:
        result.notes.append("常用表达法取自书末附录 Useful expressions / 常用表达法。")
    elif any(phrase_map.values()):
        result.notes.append("本书无独立常用表达法附录，已从单元词汇表中的短语句式补入。")

    file_pairs: list[tuple[UnitInfo, str]] = []
    for unit in units:
        if unit.start_pdf is None or unit.end_pdf is None:
            result.notes.append(f"Unit {unit.number} 未定位到 PDF 页，已跳过。")
            continue
        page_slice = [(i, pages[i]) for i in range(unit.start_pdf, unit.end_pdf + 1)]
        expressions = list(expr_map.get(unit.number, []))
        if not expressions:
            expressions = list(phrase_map.get(unit.number, []))
        else:
            # merge unique phrase entries from vocab that appendix missed
            have = {e.split(" — ", 1)[0].lower() for e in expressions}
            for p in phrase_map.get(unit.number, []):
                key = p.split(" — ", 1)[0].lower()
                if key not in have:
                    expressions.append(p)
                    have.add(key)
        md = render_unit_md(
            meta,
            unit,
            page_slice,
            vocab_map.get(unit.number, []),
            expressions,
            has_useful_appendix=has_useful_appendix,
        )
        filename = f"unit-{unit.number:02d}-{slugify(unit.title)}.md"
        path = book_dir / filename
        path.write_text(md, encoding="utf-8")
        result.wrote.append(path)
        file_pairs.append((unit, filename))

    index_path = book_dir / "00-index.md"
    index_path.write_text(render_index(meta, result.notes, file_pairs), encoding="utf-8")
    result.wrote.append(index_path)
    result.units = units
    return result


def write_root_index(out_root: Path, results: list[ExtractResult]) -> Path:
    lines = [
        "# 个人课本 Markdown 库",
        "",
        "从本机人教版英语电子课本 PDF 文字层抽取。仅供个人学习，请勿传播完整教材文本。",
        "",
        "重新抽取：",
        "",
        "```bash",
        "python3 scripts/extract_textbook_md.py",
        "```",
        "",
        "## 结构",
        "",
        "```",
        "data/kb/md/",
        "  人教版-PEP/<册别>/00-index.md",
        "  人教版-PEP/<册别>/unit-XX-....md",
        "  人教版-精通/...",
        "```",
        "",
        "## 书目",
        "",
    ]
    by_series: dict[str, list[ExtractResult]] = {}
    for r in results:
        by_series.setdefault(r.meta.series_key, []).append(r)
    for series, items in by_series.items():
        lines += [f"### {series}", ""]
        for r in sorted(items, key=lambda x: x.meta.stem):
            rel = f"./{r.meta.series_key}/{r.meta.stem}/00-index.md"
            count = sum(1 for p in r.wrote if p.name.startswith("unit-"))
            flag = "（无文字层，已跳过）" if any("文字层几乎为空" in n for n in r.notes) else f"（{count} 课）"
            label = f"{r.meta.grade}{r.meta.term}" + (f" {r.meta.edition}" if r.meta.edition else "")
            lines.append(f"- [{label}]({rel}) {flag}")
        lines.append("")
    path = out_root / "00-README.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def main() -> None:
    parser = argparse.ArgumentParser()
    kb_root = Path(__file__).resolve().parents[2] / "data" / "kb"
    parser.add_argument("--src", default=str(kb_root / "downloads"))
    parser.add_argument("--out", default=str(kb_root / "md"))
    args = parser.parse_args()
    src = Path(args.src)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    results: list[ExtractResult] = []
    for series_dir in ["人教版(PEP)", "人教版(精通)"]:
        folder = src / series_dir
        if not folder.is_dir():
            print(f"skip missing: {folder}")
            continue
        for pdf in sorted(folder.glob("*.pdf")):
            print(f"extract: {series_dir}/{pdf.name}")
            result = extract_book(pdf, series_dir, out)
            results.append(result)
            units = sum(1 for p in result.wrote if p.name.startswith("unit-"))
            empty_vocab = sum(
                1
                for p in result.wrote
                if p.name.startswith("unit-") and "未抽出本单元词条" in p.read_text(encoding="utf-8")
            )
            print(f"  -> {units} units, empty_vocab_units={empty_vocab}, notes={result.notes}")

    root = write_root_index(out, results)
    print(f"done: {root}")


if __name__ == "__main__":
    main()
