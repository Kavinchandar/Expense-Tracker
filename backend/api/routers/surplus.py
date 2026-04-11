from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.dependencies import get_db
from api.schemas import (
    SurplusBudgetsPutBody,
    SurplusBudgetsResponse,
    SurplusMonthlySeriesItem,
    SurplusMonthlySeriesResponse,
)
from services.surplus_budget_service import SurplusBudgetService

router = APIRouter(prefix="/surplus", tags=["surplus"])


@router.get("/budgets", response_model=SurplusBudgetsResponse)
def get_surplus_budgets(year: int, month: int, db: Session = Depends(get_db)):
    svc = SurplusBudgetService(db)
    result = svc.get_surplus_budgets(year, month)
    return SurplusBudgetsResponse(
        year=result.year,
        month=result.month,
        budgets=result.budgets,
    )


@router.put("/budgets", response_model=SurplusBudgetsResponse)
def put_surplus_budgets(
    year: int,
    month: int,
    body: SurplusBudgetsPutBody,
    db: Session = Depends(get_db),
):
    svc = SurplusBudgetService(db)
    result = svc.save_surplus_budgets(year, month, body.budgets)
    return SurplusBudgetsResponse(
        year=result.year,
        month=result.month,
        budgets=result.budgets,
    )


@router.get("/monthly", response_model=SurplusMonthlySeriesResponse)
def get_surplus_monthly(
    end_year: int,
    end_month: int,
    months: int,
    db: Session = Depends(get_db),
):
    svc = SurplusBudgetService(db)
    result = svc.get_monthly_surplus_series(end_year, end_month, months)
    return SurplusMonthlySeriesResponse(
        end_year=result.end_year,
        end_month=result.end_month,
        months=result.months,
        series=[
            SurplusMonthlySeriesItem(
                year=row.year,
                month=row.month,
                total_inflow=row.total_inflow,
                total_outflow=row.total_outflow,
                surplus=row.surplus,
            )
            for row in result.series
        ],
    )
