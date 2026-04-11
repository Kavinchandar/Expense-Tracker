from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from data.repositories.stored_transaction_repository import StoredTransactionRepository
from services.exceptions import ValidationError


def _validate_year(year: int) -> None:
    if year < 1970 or year > 2100:
        raise ValidationError("year must be between 1970 and 2100")


def get_yearly_insights(session: Session, year: int) -> dict[str, float | int | None]:
    _validate_year(year)
    repo = StoredTransactionRepository(session)
    total_inflow, total_outflow = repo.yearly_cashflow_totals(year)
    gross = total_inflow + total_outflow
    if gross > 0:
        inflow_pct = round(100.0 * total_inflow / gross, 1)
        outflow_pct = round(100.0 * total_outflow / gross, 1)
    else:
        inflow_pct = 0.0
        outflow_pct = 0.0
    net_flow = total_inflow - total_outflow
    end = date(year, 12, 31)
    total_worth = repo.last_balance_on_or_before(end)
    return {
        "year": year,
        "total_inflow": total_inflow,
        "total_outflow": total_outflow,
        "gross_movement": gross,
        "net_flow": net_flow,
        "inflow_pct_of_gross": inflow_pct,
        "outflow_pct_of_gross": outflow_pct,
        "total_worth": total_worth,
    }
