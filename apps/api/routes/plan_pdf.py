from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field, model_validator

from apps.api.engine.travelplanpdf import build_travel_plan_pdf


router = APIRouter(prefix="/plan", tags=["plan-pdf"])


class PlanPdfTravelInput(BaseModel):
    regions: list[str] = Field(default_factory=list, max_length=20)
    start_date: date
    days: int = Field(ge=1, le=14)
    companion: str = Field(max_length=80)
    purpose: str = Field(max_length=80)
    moments: list[str] = Field(default_factory=list, max_length=20)


class PlanPdfItemInput(BaseModel):
    id: str = Field(max_length=220)
    name: str = Field(min_length=1, max_length=200)
    day: int = Field(ge=1, le=14)
    order: int = Field(ge=1, le=100)
    start_time: str | None = Field(
        default=None,
        pattern=r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$",
    )
    fixed: bool = False
    source: Literal["public_data", "web_search", "user_added"]
    address: str | None = Field(default=None, max_length=300)
    memo: str | None = Field(default=None, max_length=800)
    badge: str | None = Field(default=None, max_length=40)
    source_title: str | None = Field(default=None, max_length=240)
    source_url: str | None = Field(default=None, max_length=2_000)
    checked_at: datetime | None = None
    check_required: list[str] = Field(default_factory=list, max_length=20)


class PlanPdfBody(BaseModel):
    title: str = Field(default="나의 제주 여행", min_length=1, max_length=80)
    travel: PlanPdfTravelInput
    items: list[PlanPdfItemInput] = Field(min_length=1, max_length=100)
    packing_items: list[str] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def validate_item_days(self) -> "PlanPdfBody":
        invalid = [item.name for item in self.items if item.day > self.travel.days]
        if invalid:
            raise ValueError("모든 장소의 day는 전체 여행 일수 이하여야 합니다.")
        return self


@router.post("/pdf", response_class=Response)
def create_plan_pdf(body: PlanPdfBody) -> Response:
    try:
        pdf_bytes = build_travel_plan_pdf(body)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    filename = f"pack-your-jeju-passport_{body.travel.start_date.isoformat()}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
