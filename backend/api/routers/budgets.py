from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.dependencies import get_db
from api.schemas import BudgetsPutBody, BudgetsResponse
from services.budget_service import BudgetService

router = APIRouter(tags=["budgets"])


@router.get("/budgets", response_model=BudgetsResponse)
def get_budgets(year: int, month: int, db: Session = Depends(get_db)):
    svc = BudgetService(db)
    result = svc.get_monthly_budgets(year, month)
    return BudgetsResponse(
        year=result.year,
        month=result.month,
        budgets=result.budgets,
    )


@router.put("/budgets", response_model=BudgetsResponse)
def put_budgets(
    year: int,
    month: int,
    body: BudgetsPutBody,
    db: Session = Depends(get_db),
):
    svc = BudgetService(db)
    result = svc.save_monthly_budgets(year, month, body.budgets)
    return BudgetsResponse(
        year=result.year,
        month=result.month,
        budgets=result.budgets,
    )
