from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.dependencies import get_db
from api.schemas import InsightsResponse, YearlyInsightsResponse
from services.gemini_insights_service import generate_insights_for_month
from services.yearly_insights_service import get_yearly_insights

router = APIRouter(tags=["insights"])


@router.get("/insights", response_model=InsightsResponse)
def get_insights(
    year: int,
    month: int,
    db: Session = Depends(get_db),
):
    text = generate_insights_for_month(db, year, month)
    return InsightsResponse(insights=text)


@router.get("/insights/yearly", response_model=YearlyInsightsResponse)
def get_yearly_insights_route(
    year: int,
    db: Session = Depends(get_db),
):
    data = get_yearly_insights(db, year)
    return YearlyInsightsResponse(**data)
