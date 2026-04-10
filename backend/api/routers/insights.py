from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.dependencies import get_db
from api.schemas import InsightsResponse
from services.gemini_insights_service import generate_insights_for_month

router = APIRouter(tags=["insights"])


@router.get("/insights", response_model=InsightsResponse)
def get_insights(
    year: int,
    month: int,
    db: Session = Depends(get_db),
):
    text = generate_insights_for_month(db, year, month)
    return InsightsResponse(insights=text)
