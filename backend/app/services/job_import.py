"""Read a job posting from a web page via its schema.org JobPosting data.

Most job boards (LinkedIn, Indeed, Welcome to the Jungle, Greenhouse, Lever, Workable…) embed
this structured data for search engines. Reading it is reliable and leaves nothing to guess;
pages without it are refused with a clear message instead of being scraped loosely.
"""

import json
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from html import unescape
from typing import Any
from urllib.parse import urlsplit

from app.core.errors import AppError
from app.domain.enums import EmploymentType, SalaryPeriod, Seniority, WorkMode
from app.domain.skills import extract_skills
from app.services.job_text import (
    blocks_to_text,
    employment_type_from,
    html_to_blocks,
    seniority_from_title,
    summarize,
)

_LD_JSON = re.compile(
    r"<script[^>]+type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>",
    re.IGNORECASE | re.DOTALL,
)
_UNITS = {
    "YEAR": SalaryPeriod.YEAR,
    "MONTH": SalaryPeriod.MONTH,
    "DAY": SalaryPeriod.DAY,
    "HOUR": SalaryPeriod.HOUR,
}
MAX_SKILLS = 15


class NoJobDataError(AppError):
    def __init__(self) -> None:
        super().__init__(
            422,
            "no_job_data",
            "We couldn't find job details on this page. Try the link to the original posting "
            "on the company's or job board's site.",
        )


@dataclass
class ImportedJob:
    url: str
    host_label: str
    external_id: str | None
    title: str
    company: str
    location: str
    work_mode: WorkMode | None
    employment_type: EmploymentType | None
    seniority: Seniority | None
    salary_min: int | None
    salary_max: int | None
    salary_currency: str | None
    salary_period: SalaryPeriod | None
    posted_at: datetime | None
    summary: str
    description: list[dict[str, Any]]
    skills: list[str]
    missing: list[str] = field(default_factory=list)


def host_label(url: str) -> str:
    host = urlsplit(url).hostname or ""
    return host.removeprefix("www.")


def _find_posting(node: Any) -> dict[str, Any] | None:
    if isinstance(node, list):
        for child in node:
            found = _find_posting(child)
            if found:
                return found
    elif isinstance(node, dict):
        kind = node.get("@type")
        kinds = kind if isinstance(kind, list) else [kind]
        if "JobPosting" in kinds:
            return node
        if "@graph" in node:
            return _find_posting(node["@graph"])
    return None


def _text(value: Any) -> str:
    if isinstance(value, dict):
        value = value.get("name") or value.get("value") or ""
    if isinstance(value, list):
        value = value[0] if value else ""
    return " ".join(unescape(str(value)).split()) if value else ""


def _location(posting: dict[str, Any]) -> str:
    places = posting.get("jobLocation") or []
    places = places if isinstance(places, list) else [places]
    labels = []
    for place in places:
        address = place.get("address") if isinstance(place, dict) else place
        if isinstance(address, str):
            labels.append(_text(address))
        elif isinstance(address, dict):
            parts = [
                _text(address.get("addressLocality")),
                _text(address.get("addressRegion")),
                _text(address.get("addressCountry")),
            ]
            labels.append(", ".join(dict.fromkeys(p for p in parts if p)))
    return "; ".join(dict.fromkeys(label for label in labels if label))[:300]


def _number(value: Any) -> int | None:
    try:
        number = float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return None
    return round(number) if number > 0 else None


def _salary(
    posting: dict[str, Any],
) -> tuple[int | None, int | None, str | None, SalaryPeriod | None]:
    base = posting.get("baseSalary")
    if not isinstance(base, dict):
        return None, None, None, None
    currency = _text(base.get("currency")).upper()[:3] or None
    value = base.get("value")
    if isinstance(value, dict):
        low = _number(value.get("minValue") or value.get("value"))
        high = _number(value.get("maxValue") or value.get("value"))
        unit = _UNITS.get(_text(value.get("unitText")).upper())
    else:
        low = high = _number(value)
        unit = _UNITS.get(_text(base.get("unitText")).upper())
    if low is None and high is None:
        return None, None, None, None
    # A figure without its currency or period can't be shown honestly, so drop it.
    if currency is None or unit is None:
        return None, None, None, None
    return low, high, currency, unit


def _date(value: Any) -> datetime | None:
    text = _text(value)
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _skills(posting: dict[str, Any], description_text: str, title: str) -> list[str]:
    stated = posting.get("skills")
    if isinstance(stated, str):
        listed = [s.strip() for s in re.split(r"[,;\n•]", stated) if s.strip()]
    elif isinstance(stated, list):
        listed = [_text(s) for s in stated if _text(s)]
    else:
        listed = []
    found = extract_skills(f"{title}\n{description_text}")
    return list(dict.fromkeys([*listed, *found]))[:MAX_SKILLS]


def parse_job_page(html: str, url: str) -> ImportedJob:
    posting = None
    for raw in _LD_JSON.findall(html):
        try:
            data = json.loads(raw.strip(), strict=False)
        except json.JSONDecodeError:
            continue
        posting = _find_posting(data)
        if posting:
            break
    if posting is None:
        raise NoJobDataError()

    title = _text(posting.get("title"))[:300]
    if not title:
        raise NoJobDataError()
    company = _text(posting.get("hiringOrganization"))[:300]
    location = _location(posting)
    remote = _text(posting.get("jobLocationType")).upper() == "TELECOMMUTE"
    description_html = unescape(str(posting.get("description") or ""))
    blocks = html_to_blocks(description_html)
    low, high, currency, period = _salary(posting)
    identifier = posting.get("identifier")
    external_id = _text(identifier)[:300] if identifier else None

    job = ImportedJob(
        url=url,
        host_label=host_label(url),
        external_id=external_id,
        title=title,
        company=company,
        location=location or ("Remote" if remote else ""),
        work_mode=WorkMode.REMOTE if remote else None,
        employment_type=employment_type_from(posting.get("employmentType")),
        seniority=seniority_from_title(title),
        salary_min=low,
        salary_max=high,
        salary_currency=currency,
        salary_period=period,
        posted_at=_date(posting.get("datePosted")),
        summary=summarize(blocks),
        description=blocks,
        skills=_skills(posting, blocks_to_text(blocks), title),
    )
    checks = [
        ("Company", job.company),
        ("Location", job.location),
        ("Work mode", job.work_mode),
        ("Employment type", job.employment_type),
        ("Salary", job.salary_min or job.salary_max),
        ("Posting date", job.posted_at),
    ]
    job.missing = [name for name, value in checks if not value]
    return job
