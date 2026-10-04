import json

import httpx
import pytest

from app.services.job_import import NoJobDataError, parse_job_page
from app.services.job_text import html_to_blocks, seniority_from_title
from app.services.safe_fetch import FetchError, UrlFetcher

POSTING = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    "title": "Senior UX Designer",
    "hiringOrganization": {"@type": "Organization", "name": "Harbor &amp; Pine"},
    "jobLocation": {
        "@type": "Place",
        "address": {"addressLocality": "Sfax", "addressCountry": "TN"},
    },
    "employmentType": ["FULL_TIME"],
    "datePosted": "2026-09-28",
    "baseSalary": {
        "@type": "MonetaryAmount",
        "currency": "TND",
        "value": {
            "@type": "QuantitativeValue",
            "minValue": 3500,
            "maxValue": 4500,
            "unitText": "MONTH",
        },
    },
    "description": (
        "<p>Join our team to design booking flows for patients across Tunisia and abroad.</p>"
        "<h3>Requirements</h3><ul><li>3+ years with Figma</li><li>User research</li></ul>"
    ),
}


def page(*blobs: object) -> str:
    scripts = "".join(f'<script type="application/ld+json">{json.dumps(b)}</script>' for b in blobs)
    return f"<html><head>{scripts}</head><body>Hello</body></html>"


def test_reads_jobposting_fields_and_flags_requirements() -> None:
    job = parse_job_page(page({"@type": "Organization"}, POSTING), "https://www.jobs.example/1")
    assert job.title == "Senior UX Designer"
    assert job.company == "Harbor & Pine"
    assert job.location == "Sfax, TN"
    assert job.employment_type == "full_time"
    assert job.seniority == "senior"
    assert (job.salary_min, job.salary_max, job.salary_currency, job.salary_period) == (
        3500,
        4500,
        "TND",
        "month",
    )
    assert job.host_label == "jobs.example"
    assert {"type": "bullet", "text": "3+ years with Figma", "requirement": True} in job.description
    assert "Figma" in job.skills and "User research" in job.skills
    assert job.missing == ["Work mode"]


def test_jobposting_inside_graph_and_remote() -> None:
    posting = {**POSTING, "jobLocationType": "TELECOMMUTE", "jobLocation": None}
    job = parse_job_page(page({"@graph": [{"@type": "WebPage"}, posting]}), "https://x.example")
    assert job.work_mode == "remote"
    assert job.location == "Remote"


def test_salary_without_period_is_dropped_not_guessed() -> None:
    posting = {**POSTING, "baseSalary": {"currency": "TND", "value": 4000}}
    job = parse_job_page(page(posting), "https://x.example")
    assert job.salary_min is None and job.salary_max is None
    assert "Salary" in job.missing


def test_page_without_job_data_is_refused() -> None:
    with pytest.raises(NoJobDataError):
        parse_job_page("<html><title>Careers</title></html>", "https://x.example")


def test_html_blocks_and_seniority_helpers() -> None:
    blocks = html_to_blocks("<h2>About</h2><p>Hi</p><script>evil()</script><ul><li>One</li></ul>")
    assert blocks == [
        {"type": "heading", "text": "About"},
        {"type": "paragraph", "text": "Hi"},
        {"type": "bullet", "text": "One"},
    ]
    assert seniority_from_title("Product Designer") is None
    assert seniority_from_title("Junior Product Designer") == "junior"


async def public(_: str) -> list[str]:
    return ["93.184.216.34"]


def fetcher(handler: object, resolver: object = public) -> UrlFetcher:
    return UrlFetcher(resolver=resolver, transport=httpx.MockTransport(handler))  # type: ignore[arg-type]


@pytest.mark.parametrize(
    "url",
    [
        "ftp://jobs.example/1",
        "file:///etc/passwd",
        "https://user:pw@jobs.example/1",
        "https://jobs.example:8080/1",
        "jobs.example/1",
    ],
)
async def test_fetcher_refuses_unsafe_urls(url: str) -> None:
    with pytest.raises(FetchError):
        await fetcher(lambda r: httpx.Response(200, text="ok")).fetch(url)


@pytest.mark.parametrize(
    "address", ["127.0.0.1", "10.0.0.5", "169.254.169.254", "::1", "::ffff:192.168.1.1"]
)
async def test_fetcher_refuses_private_addresses(address: str) -> None:
    async def resolver(_: str) -> list[str]:
        return [address]

    with pytest.raises(FetchError) as caught:
        await fetcher(lambda r: httpx.Response(200, text="ok"), resolver).fetch("https://a.example")
    assert caught.value.code == "invalid_url"


async def test_fetcher_checks_every_redirect_hop() -> None:
    async def resolver(host: str) -> list[str]:
        return ["10.0.0.1"] if host == "internal.example" else ["93.184.216.34"]

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"location": "http://internal.example/admin"})

    with pytest.raises(FetchError):
        await fetcher(handler, resolver).fetch("https://a.example/job")


async def test_fetcher_follows_public_redirect_and_caps_size() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/short":
            return httpx.Response(301, headers={"location": "/long"})
        return httpx.Response(200, text="<html>job</html>")

    result = await fetcher(handler).fetch("https://a.example/short")
    assert result.url == "https://a.example/long"

    big = fetcher(lambda r: httpx.Response(200, content=b"x" * (3 * 1024 * 1024)))
    with pytest.raises(FetchError) as caught:
        await big.fetch("https://a.example/")
    assert caught.value.code == "too_large"
