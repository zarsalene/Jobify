"""Rule-based match between a job and the user's preferences and confirmed skills.

Pure functions, no I/O. Every factor either has the data to judge or says "unknown"; unknown
factors are left out of the score instead of being guessed. The AI factors stay unknown until
AI matching is switched on, and are reported as such.
"""

from dataclasses import dataclass, field
from datetime import datetime

from app.domain.enums import (
    SENIORITY_ORDER,
    FactorStatus,
    MatchLevel,
    SalaryPeriod,
    Seniority,
    WorkMode,
)
from app.domain.models.job import Job
from app.domain.models.profile import SearchPreferences
from app.domain.skills import normalize_skill

WEIGHTS = {
    "location": 25,
    "salary": 15,
    "seniority": 15,
    "employment_type": 10,
    "required_skills": 35,
}
_POINTS = {FactorStatus.GOOD: 1.0, FactorStatus.OK: 0.6, FactorStatus.POOR: 0.15}
_LABELS = {
    "location": "Location and work mode",
    "salary": "Salary",
    "seniority": "Seniority",
    "employment_type": "Employment type",
    "required_skills": "Required skills",
    "skill_equivalence": "Skill equivalence",
    "experience_relevance": "Experience relevance",
    "career_alignment": "Career alignment",
}
# Annualizing a day or hour rate needs a guess about days worked, so those are not compared.
_PER_YEAR = {SalaryPeriod.YEAR: 1, SalaryPeriod.MONTH: 12}
MAX_STRENGTHS = 6
MAX_GAPS = 5


@dataclass(frozen=True)
class Factor:
    key: str
    status: FactorStatus
    detail: str

    @property
    def label(self) -> str:
        return _LABELS[self.key]


@dataclass(frozen=True)
class Gap:
    label: str
    how_to_close: str


@dataclass(frozen=True)
class MatchResult:
    score: int
    level: MatchLevel
    reason: str
    strengths: list[str]
    gaps: list[Gap]
    deterministic: list[Factor]
    ai: list[Factor]
    based_on: list[str]
    generated_at: datetime
    checks_used: int = field(default=0)


def level_for(score: int) -> MatchLevel:
    if score >= 80:
        return MatchLevel.STRONG
    if score >= 65:
        return MatchLevel.GOOD
    if score >= 45:
        return MatchLevel.PARTIAL
    return MatchLevel.WEAK


def _location(job: Job, prefs: SearchPreferences | None) -> Factor:
    if prefs is None or (not prefs.location and not prefs.work_modes):
        return Factor("location", FactorStatus.UNKNOWN, "Set where and how you want to work.")
    wanted_modes = set(prefs.work_modes)
    if job.work_mode == WorkMode.REMOTE and WorkMode.REMOTE in wanted_modes:
        return Factor("location", FactorStatus.GOOD, "Remote, which you're open to.")
    if not job.location and job.work_mode is None:
        return Factor("location", FactorStatus.UNKNOWN, "The posting doesn't say where.")
    place_ok = bool(prefs.location) and prefs.location.casefold() in job.location.casefold()
    mode_ok = not wanted_modes or job.work_mode is None or job.work_mode in wanted_modes
    if place_ok and mode_ok:
        return Factor("location", FactorStatus.GOOD, f"{job.location}, as you prefer.")
    if place_ok:
        return Factor("location", FactorStatus.OK, "Right place, but not your preferred work mode.")
    if job.work_mode == WorkMode.REMOTE:
        return Factor("location", FactorStatus.OK, "Remote, but you didn't select remote work.")
    return Factor(
        "location", FactorStatus.POOR, f"{job.location or 'Elsewhere'}, outside your area."
    )


def _salary(job: Job, prefs: SearchPreferences | None) -> Factor:
    if prefs is None or prefs.salary_min is None:
        return Factor("salary", FactorStatus.UNKNOWN, "You haven't set a minimum salary.")
    job_top = job.salary_max or job.salary_min
    if job_top is None or job.salary_period is None:
        return Factor("salary", FactorStatus.UNKNOWN, "The posting doesn't state a salary.")
    if (job.salary_currency or "").upper() != (prefs.salary_currency or "").upper():
        return Factor(
            "salary", FactorStatus.UNKNOWN, "Stated in another currency, so not compared."
        )
    job_factor = _PER_YEAR.get(SalaryPeriod(job.salary_period))
    pref_factor = _PER_YEAR.get(SalaryPeriod(prefs.salary_period or SalaryPeriod.YEAR))
    if job_factor is None or pref_factor is None:
        return Factor("salary", FactorStatus.UNKNOWN, "Paid by the day or hour, so not compared.")
    job_yearly = job_top * job_factor
    wanted_yearly = prefs.salary_min * pref_factor
    if job_yearly >= wanted_yearly:
        return Factor("salary", FactorStatus.GOOD, "At or above your minimum.")
    if job_yearly >= wanted_yearly * 0.9:
        return Factor("salary", FactorStatus.OK, "Slightly below your minimum.")
    return Factor("salary", FactorStatus.POOR, "Below your minimum.")


def _seniority(job: Job, prefs: SearchPreferences | None) -> Factor:
    if prefs is None or prefs.seniority is None:
        return Factor("seniority", FactorStatus.UNKNOWN, "You haven't set your level.")
    if job.seniority is None:
        return Factor("seniority", FactorStatus.UNKNOWN, "The posting doesn't state a level.")
    distance = abs(
        SENIORITY_ORDER.index(Seniority(job.seniority))
        - SENIORITY_ORDER.index(Seniority(prefs.seniority))
    )
    if distance == 0:
        return Factor("seniority", FactorStatus.GOOD, "Matches your level.")
    if distance == 1:
        return Factor("seniority", FactorStatus.OK, "One level from yours.")
    return Factor("seniority", FactorStatus.POOR, "Well above or below your level.")


def _employment(job: Job, prefs: SearchPreferences | None) -> Factor:
    if prefs is None or not prefs.employment_types:
        return Factor("employment_type", FactorStatus.UNKNOWN, "You haven't chosen job types.")
    if job.employment_type is None:
        return Factor("employment_type", FactorStatus.UNKNOWN, "The posting doesn't say.")
    if job.employment_type in prefs.employment_types:
        return Factor("employment_type", FactorStatus.GOOD, "A job type you want.")
    return Factor("employment_type", FactorStatus.POOR, "Not a job type you selected.")


def _skills(job: Job, confirmed: list[str]) -> tuple[Factor, list[str], list[str]]:
    if not job.skills:
        factor = Factor(
            "required_skills", FactorStatus.UNKNOWN, "No specific skills were found in the post."
        )
        return factor, [], []
    if not confirmed:
        factor = Factor(
            "required_skills", FactorStatus.UNKNOWN, "Confirm your skills to compare them."
        )
        return factor, [], []
    have = {normalize_skill(s) for s in confirmed}
    matched = [s for s in job.skills if normalize_skill(s) in have]
    missing = [s for s in job.skills if normalize_skill(s) not in have]
    ratio = len(matched) / len(job.skills)
    status = (
        FactorStatus.GOOD
        if ratio >= 0.75
        else FactorStatus.OK
        if ratio >= 0.4
        else FactorStatus.POOR
    )
    detail = f"{len(matched)} of {len(job.skills)} in your confirmed profile."
    return Factor("required_skills", status, detail), matched, missing


def _reason(factors: list[Factor], matched: list[str], skills_total: int) -> str:
    known = [f for f in factors if f.status != FactorStatus.UNKNOWN]
    if not known:
        return "There isn't enough information yet. Add your preferences and confirm your skills."
    parts = []
    if skills_total and matched:
        parts.append(f"{len(matched)} of {skills_total} listed skills match your profile")
    good = [
        f.label.lower()
        for f in known
        if f.status == FactorStatus.GOOD and f.key != "required_skills"
    ]
    poor = [
        f.label.lower()
        for f in known
        if f.status == FactorStatus.POOR and f.key != "required_skills"
    ]
    if good:
        parts.append(f"{_join(good)} fit{'s' if len(good) == 1 else ''}")
    sentence = (", and ".join(parts) or "This role partly fits what you're looking for") + "."
    sentence = sentence[0].upper() + sentence[1:]
    if poor:
        sentence += f" Watch out: {_join(poor)}."
    unknown = len(factors) - len(known)
    if unknown:
        sentence += f" {unknown} of {len(factors)} checks had no data."
    return sentence


def _join(items: list[str]) -> str:
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]


def compute_match(
    job: Job,
    prefs: SearchPreferences | None,
    confirmed_skills: list[str],
    now: datetime,
) -> MatchResult:
    skills_factor, matched, missing = _skills(job, confirmed_skills)
    deterministic = [
        _location(job, prefs),
        _salary(job, prefs),
        _seniority(job, prefs),
        _employment(job, prefs),
        skills_factor,
    ]
    known_weight = sum(WEIGHTS[f.key] for f in deterministic if f.status != FactorStatus.UNKNOWN)
    earned = sum(
        WEIGHTS[f.key] * _POINTS[f.status]
        for f in deterministic
        if f.status != FactorStatus.UNKNOWN
    )
    score = round(100 * earned / known_weight) if known_weight else 0

    not_on = "Needs AI matching, which isn't switched on yet."
    ai = [
        Factor(key, FactorStatus.UNKNOWN, not_on)
        for key in ("skill_equivalence", "experience_relevance", "career_alignment")
    ]
    gaps = [
        Gap(
            label=skill,
            how_to_close=(
                f"If you have {skill} experience, add it to your profile. If not, a small "
                "project or short course is a practical way to start."
            ),
        )
        for skill in missing[:MAX_GAPS]
    ]
    based_on = ["The job post"]
    if prefs is not None:
        based_on.append("Your search preferences")
    if confirmed_skills:
        based_on.append("Your confirmed skills")

    return MatchResult(
        score=score,
        level=level_for(score),
        reason=_reason(deterministic, matched, len(job.skills)),
        strengths=matched[:MAX_STRENGTHS],
        gaps=gaps,
        deterministic=deterministic,
        ai=ai,
        based_on=based_on,
        generated_at=now,
        checks_used=sum(1 for f in deterministic if f.status != FactorStatus.UNKNOWN),
    )
