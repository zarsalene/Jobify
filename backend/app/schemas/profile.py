import uuid
from datetime import datetime
from typing import Literal, Self

from pydantic import Field, model_validator

from app.domain.enums import (
    CvItemStatus,
    CvSection,
    EmploymentType,
    SalaryPeriod,
    Seniority,
    WorkMode,
)
from app.domain.models.profile import CvDocument, CvItem, SearchPreferences
from app.schemas.base import ApiModel


class SearchSetup(ApiModel):
    target_role: str = Field(default="", max_length=200)
    location: str = Field(default="", max_length=200)
    salary_min: int | None = Field(default=None, ge=0, le=100_000_000)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    salary_period: SalaryPeriod | None = None
    seniority: Seniority | None = None
    employment_types: list[EmploymentType] = Field(default_factory=list, max_length=4)
    work_modes: list[WorkMode] = Field(default_factory=list, max_length=3)

    @model_validator(mode="after")
    def _salary_needs_currency_and_period(self) -> Self:
        if self.salary_min is not None and (self.currency is None or self.salary_period is None):
            raise ValueError("salaryMin needs a currency and a salaryPeriod")
        if self.currency:
            self.currency = self.currency.upper()
        return self

    @classmethod
    def from_model(cls, prefs: SearchPreferences) -> "SearchSetup":
        return cls(
            target_role=prefs.target_role,
            location=prefs.location,
            salary_min=prefs.salary_min,
            currency=prefs.salary_currency,
            salary_period=SalaryPeriod(prefs.salary_period) if prefs.salary_period else None,
            seniority=Seniority(prefs.seniority) if prefs.seniority else None,
            employment_types=[EmploymentType(v) for v in prefs.employment_types],
            work_modes=[WorkMode(v) for v in prefs.work_modes],
        )


class CvItemRead(ApiModel):
    id: uuid.UUID
    section: CvSection
    label: str
    detail: str | None
    confidence: float
    status: CvItemStatus
    origin: Literal["cv", "manual"]

    @classmethod
    def from_model(cls, item: CvItem) -> "CvItemRead":
        return cls.model_validate(item)


class CvItemCreate(ApiModel):
    section: CvSection
    label: str = Field(min_length=1, max_length=300)
    detail: str | None = Field(default=None, max_length=500)


class CvItemUpdate(ApiModel):
    label: str | None = Field(default=None, min_length=1, max_length=300)
    detail: str | None = Field(default=None, max_length=500)
    status: CvItemStatus | None = None


class CvFileRead(ApiModel):
    id: uuid.UUID
    file_name: str
    content_type: str
    size_bytes: int
    uploaded_at: datetime

    @classmethod
    def from_model(cls, doc: CvDocument) -> "CvFileRead":
        return cls(
            id=doc.id,
            file_name=doc.file_name,
            content_type=doc.content_type,
            size_bytes=doc.size_bytes,
            uploaded_at=doc.created_at,
        )


class ParsedCv(ApiModel):
    file: CvFileRead
    # "basic" = vocabulary match on the file's text. AI parsing will report "ai".
    method: Literal["basic", "ai"]
    items: list[CvItemRead]
    notes: list[str]


class ProfileRead(ApiModel):
    setup: SearchSetup | None
    cv: CvFileRead | None
    items: list[CvItemRead]
    # 0..100, from which parts of the profile are filled in. Explained by `missing`.
    completeness: int
    missing: list[str]
