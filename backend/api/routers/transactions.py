from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.dependencies import get_db
from api.schemas import CategoryBody, TransactionsResponse
from services.statement_service import StatementService

router = APIRouter(tags=["transactions"])


@router.get("/transactions", response_model=TransactionsResponse)
def get_transactions(
    year: int,
    month: int,
    db: Session = Depends(get_db),
):
    svc = StatementService(db)
    result = svc.monthly_transactions(year, month)
    return TransactionsResponse(
        year=result.year,
        month=result.month,
        month_total=result.month_total,
        buckets=result.buckets,
        display_timezone=result.display_timezone,
    )


@router.patch("/transactions/{transaction_id}/category")
def patch_transaction_category(
    transaction_id: int,
    body: CategoryBody,
    db: Session = Depends(get_db),
):
    svc = StatementService(db)
    svc.set_transaction_category(transaction_id, body.category)
    return {"ok": True}
