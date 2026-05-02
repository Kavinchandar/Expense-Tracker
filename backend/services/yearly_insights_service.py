from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from data.repositories.stored_transaction_repository import StoredTransactionRepository
from services.exceptions import ValidationError

# Gross debits in these categories for the year (for a savings-inclusive net-worth view).
_FD_INVESTMENT_CATEGORIES_FOR_YEAR: tuple[str, ...] = (
    "FDS",
    "MUTUAL_FUNDS",
    "INVESTMENTS",
)
_FD_CATEGORY: tuple[str, ...] = ("FDS",)
_MF_CATEGORY: tuple[str, ...] = ("MUTUAL_FUNDS",)


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
    lifetime_inflow, lifetime_outflow = repo.lifetime_cashflow_totals()
    lifetime_net_surplus = max(0.0, lifetime_inflow - lifetime_outflow)
    fd_debits_all_time = repo.lifetime_abs_debit_sum_by_categories(_FD_CATEGORY)
    mf_debits_all_time = repo.lifetime_abs_debit_sum_by_categories(_MF_CATEGORY)
    inv_debits_all_time = repo.lifetime_abs_debit_sum_by_categories(
        ("INVESTMENTS",)
    )
    # "Total surplus" includes allocations already moved into FDs/MF.
    all_time_surplus = (
        lifetime_net_surplus
    )
    liquid_all_time_surplus = max(
        0.0,
        all_time_surplus
        - fd_debits_all_time
        - mf_debits_all_time
        - inv_debits_all_time,
    )
    end = date(year, 12, 31)
    total_worth = repo.last_balance_on_or_before(end)
    available_to_spend = repo.last_balance_on_or_before(date(2100, 12, 31))
    if available_to_spend is None:
        # Keep fallback conservative/realistic for liquid funds.
        available_to_spend = min(liquid_all_time_surplus, lifetime_net_surplus)
    if total_worth is None:
        total_worth = available_to_spend
    fd_investment_debits_year = repo.yearly_abs_debit_sum_by_categories(
        year, _FD_INVESTMENT_CATEGORIES_FOR_YEAR
    )
    return {
        "year": year,
        "total_inflow": total_inflow,
        "total_outflow": total_outflow,
        "gross_movement": gross,
        "net_flow": net_flow,
        "inflow_pct_of_gross": inflow_pct,
        "outflow_pct_of_gross": outflow_pct,
        "total_worth": total_worth,
        "all_time_surplus": all_time_surplus,
        "available_to_spend": available_to_spend,
        "fd_debits_all_time": fd_debits_all_time,
        "mf_debits_all_time": mf_debits_all_time,
        "fd_investment_debits_year": fd_investment_debits_year,
    }
