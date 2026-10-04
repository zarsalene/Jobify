"""Value sets shared by models, schemas and services. Stored as plain strings in the database."""

from enum import StrEnum


class WorkMode(StrEnum):
    REMOTE = "remote"
    HYBRID = "hybrid"
    ONSITE = "onsite"


class EmploymentType(StrEnum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACT = "contract"
    INTERNSHIP = "internship"


class Seniority(StrEnum):
    INTERN = "intern"
    JUNIOR = "junior"
    MID = "mid"
    SENIOR = "senior"
    LEAD = "lead"


SENIORITY_ORDER = list(Seniority)


class SalaryPeriod(StrEnum):
    YEAR = "year"
    MONTH = "month"
    DAY = "day"
    HOUR = "hour"


class MatchLevel(StrEnum):
    STRONG = "strong"
    GOOD = "good"
    PARTIAL = "partial"
    WEAK = "weak"


MATCH_LEVEL_ORDER = list(MatchLevel)


class FactorStatus(StrEnum):
    GOOD = "good"
    OK = "ok"
    POOR = "poor"
    UNKNOWN = "unknown"


class CvSection(StrEnum):
    SKILLS = "skills"
    EXPERIENCE = "experience"
    EDUCATION = "education"
    CERTIFICATIONS = "certifications"


class CvItemStatus(StrEnum):
    PENDING = "pending"
    CONFIRMED = "confirmed"


class JobSourceKind(StrEnum):
    FEED = "feed"
    IMPORTED = "imported"


class ApplicationStatus(StrEnum):
    SAVED = "saved"
    PREPARING = "preparing"
    APPLIED = "applied"
    INTERVIEW = "interview"
    OFFER = "offer"
    REJECTED = "rejected"


class TimelineKind(StrEnum):
    SAVED = "saved"
    STATUS = "status"
    NOTE = "note"
    REMINDER = "reminder"
