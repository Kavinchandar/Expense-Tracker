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
        total_inflow=result.total_inflow,
        total_outflow=result.total_outflow,
        opening_balance=result.opening_balance,
        closing_balance=result.closing_balance,
        buckets=result.buckets,
        display_timezone=result.display_timezone,
    )


@router.patch("/transactions/{transaction_id}/category")
def patch_transaction_category(
    transaction_id: str,
    body: CategoryBody,
    db: Session = Depends(get_db),
):
    svc = StatementService(db)
    svc.set_transaction_category(transaction_id, body.category)
    return {"ok": True}


@router.delete("/transactions/{transaction_id}")
def delete_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
):
    svc = StatementService(db)
    svc.soft_delete_transaction(transaction_id)
    return {"ok": True}


@router.post("/transactions/{transaction_id}/restore")
def restore_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
):
    svc = StatementService(db)
    svc.restore_transaction(transaction_id)
    return {"ok": True}
