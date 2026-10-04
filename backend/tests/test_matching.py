from datetime import UTC, datetime

from app.domain.enums import FactorStatus, MatchLevel
from app.domain.models import SearchPreferences
from app.services.matching import MatchResult, compute_match, level_for
from tests.helpers import make_job

NOW = datetime(2026, 10, 4, tzinfo=UTC)


def prefs(**overrides: object) -> SearchPreferences:
    fields: dict[str, object] = {
        "target_role": "Product Designer",
        "location": "Tunis",
        "salary_min": 3000,
        "salary_currency": "TND",
        "salary_period": "month",
        "seniority": "mid",
        "employment_types": ["full_time"],
        "work_modes": ["hybrid"],
    }
    fields.update(overrides)
    return SearchPreferences(**fields)


def factor(result: MatchResult, key: str) -> FactorStatus:
    return next(f.status for f in result.deterministic if f.key == key)


def test_full_fit_is_strong_and_explained() -> None:
    job = make_job(salary_min=3500, salary_max=4500, salary_currency="TND", salary_period="month")
    result = compute_match(job, prefs(), ["Figma", "user research", "Design systems"], NOW)
    assert result.level == MatchLevel.STRONG
    assert result.strengths == ["Figma", "User research", "Design systems"]
    assert [g.label for g in result.gaps] == ["Prototyping"]
    assert "3 of 4 listed skills match" in result.reason
    assert all(f.status == FactorStatus.UNKNOWN for f in result.ai)


def test_unknown_factors_are_not_guessed_or_scored() -> None:
    job = make_job(seniority=None, employment_type=None)
    result = compute_match(job, None, [], NOW)
    assert all(f.status == FactorStatus.UNKNOWN for f in result.deterministic)
    assert result.score == 0
    assert "isn't enough information" in result.reason
    assert result.based_on == ["The job post"]


def test_missing_salary_is_unknown_not_poor() -> None:
    result = compute_match(make_job(), prefs(), ["Figma"], NOW)
    assert factor(result, "salary") == FactorStatus.UNKNOWN


def test_salary_compares_across_month_and_year_but_not_currency_or_day_rates() -> None:
    yearly = make_job(salary_max=30000, salary_currency="TND", salary_period="year")
    assert factor(compute_match(yearly, prefs(), [], NOW), "salary") == FactorStatus.POOR
    euros = make_job(salary_max=90000, salary_currency="EUR", salary_period="year")
    assert factor(compute_match(euros, prefs(), [], NOW), "salary") == FactorStatus.UNKNOWN
    daily = make_job(salary_max=500, salary_currency="TND", salary_period="day")
    assert factor(compute_match(daily, prefs(), [], NOW), "salary") == FactorStatus.UNKNOWN


def test_remote_job_fits_when_remote_is_wanted() -> None:
    job = make_job(work_mode="remote", location="Anywhere")
    result = compute_match(job, prefs(work_modes=["remote"], location=""), [], NOW)
    assert factor(result, "location") == FactorStatus.GOOD


def test_seniority_distance() -> None:
    assert factor(compute_match(make_job(seniority="senior"), prefs(), [], NOW), "seniority") == (
        FactorStatus.OK
    )
    assert factor(compute_match(make_job(seniority="lead"), prefs(), [], NOW), "seniority") == (
        FactorStatus.POOR
    )


def test_level_thresholds() -> None:
    assert [level_for(s) for s in (80, 79, 65, 64, 45, 44)] == [
        MatchLevel.STRONG,
        MatchLevel.GOOD,
        MatchLevel.GOOD,
        MatchLevel.PARTIAL,
        MatchLevel.PARTIAL,
        MatchLevel.WEAK,
    ]
