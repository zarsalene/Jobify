"""Turn job-post text from external sources into the app's structured, plain-text shapes."""

import re
from html import unescape
from html.parser import HTMLParser
from typing import Any

from app.domain.enums import EmploymentType, Seniority

_REQUIREMENT_HEADING = re.compile(
    r"require|qualif|must|you have|you bring|we.re looking|looking for|profile|skills|experience",
    re.IGNORECASE,
)
_BLOCK_TAGS = {"p", "div", "section", "br", "tr"}
_HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
MAX_BLOCKS = 120
SUMMARY_CHARS = 280


class _BlockParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.blocks: list[dict[str, Any]] = []
        self._kind = "paragraph"
        self._buffer: list[str] = []
        self._skip = 0
        self._in_requirements = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("script", "style"):
            self._skip += 1
        elif tag in _HEADING_TAGS or tag in ("strong", "b") and not self._buffer:
            self._flush()
            self._kind = "heading"
        elif tag == "li":
            self._flush()
            self._kind = "bullet"
        elif tag in _BLOCK_TAGS:
            self._flush()

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style"):
            self._skip = max(0, self._skip - 1)
        elif tag in _HEADING_TAGS or tag in ("li", "p", "div", "section", "tr"):
            self._flush()
        elif tag in ("strong", "b") and self._kind == "heading":
            # A bold run on its own line acts as a heading; inside a sentence it is just text.
            self._flush()

    def handle_data(self, data: str) -> None:
        if not self._skip:
            self._buffer.append(data)

    def _flush(self) -> None:
        text = " ".join("".join(self._buffer).split())
        self._buffer = []
        kind, self._kind = self._kind, "paragraph"
        if not text or len(self.blocks) >= MAX_BLOCKS:
            return
        if kind == "heading" and len(text) > 120:
            kind = "paragraph"
        if kind == "heading":
            self._in_requirements = bool(_REQUIREMENT_HEADING.search(text))
            self.blocks.append({"type": "heading", "text": text})
        elif kind == "bullet":
            block: dict[str, Any] = {"type": "bullet", "text": text}
            if self._in_requirements:
                block["requirement"] = True
            self.blocks.append(block)
        else:
            self.blocks.append({"type": "paragraph", "text": text})

    def close(self) -> None:
        super().close()
        self._flush()


def html_to_blocks(html: str) -> list[dict[str, Any]]:
    """Headings, paragraphs and bullets. Bullets under a requirements heading are flagged."""
    if "<" not in html:
        return [
            {"type": "paragraph", "text": " ".join(p.split())}
            for p in re.split(r"\n\s*\n", unescape(html))
            if p.strip()
        ][:MAX_BLOCKS]
    parser = _BlockParser()
    parser.feed(html)
    parser.close()
    return parser.blocks


def blocks_to_text(blocks: list[dict[str, Any]]) -> str:
    return "\n".join(str(b.get("text", "")) for b in blocks)


def summarize(blocks: list[dict[str, Any]]) -> str:
    """The first paragraph, trimmed at a word boundary. Never rewritten or paraphrased."""
    for block in blocks:
        if block["type"] == "paragraph" and len(block["text"]) > 40:
            text: str = block["text"]
            if len(text) <= SUMMARY_CHARS:
                return text
            return text[:SUMMARY_CHARS].rsplit(" ", 1)[0] + "…"
    return ""


_SENIORITY_PATTERNS: list[tuple[Seniority, re.Pattern[str]]] = [
    (Seniority.INTERN, re.compile(r"\b(intern|internship|stagiaire|trainee)\b", re.I)),
    (Seniority.JUNIOR, re.compile(r"\b(junior|jr\.?|entry[- ]level|graduate)\b", re.I)),
    (Seniority.LEAD, re.compile(r"\b(lead|principal|staff|head of|director)\b", re.I)),
    (Seniority.SENIOR, re.compile(r"\b(senior|sr\.?)\b", re.I)),
    (Seniority.MID, re.compile(r"\b(mid[- ]level|intermediate|confirmed|confirmé)\b", re.I)),
]


def seniority_from_title(title: str) -> Seniority | None:
    """Only when the title says so. A plain "Designer" stays unknown rather than assumed mid."""
    for level, pattern in _SENIORITY_PATTERNS:
        if pattern.search(title):
            return level
    return None


_EMPLOYMENT_ALIASES: dict[str, EmploymentType] = {
    "full_time": EmploymentType.FULL_TIME,
    "fulltime": EmploymentType.FULL_TIME,
    "full-time": EmploymentType.FULL_TIME,
    "part_time": EmploymentType.PART_TIME,
    "parttime": EmploymentType.PART_TIME,
    "part-time": EmploymentType.PART_TIME,
    "contract": EmploymentType.CONTRACT,
    "contractor": EmploymentType.CONTRACT,
    "freelance": EmploymentType.CONTRACT,
    "temporary": EmploymentType.CONTRACT,
    "intern": EmploymentType.INTERNSHIP,
    "internship": EmploymentType.INTERNSHIP,
}


def employment_type_from(value: object) -> EmploymentType | None:
    """Accepts schema.org values (FULL_TIME) and common feed values. Lists use the first hit."""
    candidates = value if isinstance(value, list) else [value]
    for candidate in candidates:
        if isinstance(candidate, str):
            key = candidate.strip().lower().replace(" ", "_")
            if key in _EMPLOYMENT_ALIASES:
                return _EMPLOYMENT_ALIASES[key]
    return None
