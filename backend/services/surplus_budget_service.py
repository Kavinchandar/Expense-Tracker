from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date

from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session

from categories import SURPLUS_CATEGORIES
from data.repositories.stored_transaction_repository import StoredTransactionRepository
from data.repositories.surplus_repository import SurplusRepository
from services.buckets import month_date_range
from services.exceptions import ValidationError
from services.pf_service import pf_contribution_for_month


@dataclass(frozen=True)
class SurplusBudgetsResult:
    year: int
    month: int
    budgets: dict[str, float]


@dataclass(frozen=True)
class SurplusMonthlyRow:
    year: int
    month: int
    total_inflow: float
    total_outflow: float
    surplus: float
    pf: float | None = None


@dataclass(frozen=True)
class SurplusMonthlySeriesResult:
    end_year: int
    end_month: int
    months: int
    series: list[SurplusMonthlyRow]


class SurplusBudgetService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._surplus_repo = SurplusRepository(session)
        self._stored = StoredTransactionRepository(session)

    def get_surplus_budgets(self, year: int, month: int) -> SurplusBudgetsResult:
        month_date_range(year, month)
        by_cat = self._surplus_repo.list_defaults()
        budgets = {k: float(by_cat.get(k, 0.0)) for k in SURPLUS_CATEGORIES}
        return SurplusBudgetsResult(year=year, month=month, budgets=budgets)

    def save_surplus_budgets(
        self, year: int, month: int, budgets: dict[str, float]
    ) -> SurplusBudgetsResult:
        month_date_range(year, month)
        unknown = set(budgets.keys()) - set(SURPLUS_CATEGORIES)
        if unknown:
            raise ValidationError(f"Unknown categories: {', '.join(sorted(unknown))}")
        full = {k: float(budgets.get(k, 0.0)) for k in SURPLUS_CATEGORIES}
        if any(v < 0 for v in full.values()):
            raise ValidationError("Surplus budget amounts must be zero or positive.")
        self._surplus_repo.replace_defaults(full)
        self._session.commit()
        return self.get_surplus_budgets(year, month)

    def get_monthly_surplus_series(
        self, end_year: int, end_month: int, months: int
    ) -> SurplusMonthlySeriesResult:
        month_date_range(end_year, end_month)
        if months < 1:
            raise ValidationError("months must be at least 1.")
        if months > 120:
            raise ValidationError("months must be at most 120.")

        first = date(end_year, end_month, 1) - relativedelta(months=months - 1)
        _, last_day = calendar.monthrange(end_year, end_month)
        end_date = date(end_year, end_month, last_day)
        start_date = date(first.year, first.month, 1)

        aggregates = self._stored.monthly_cashflow_aggregates(start_date, end_date)

        series: list[SurplusMonthlyRow] = []
        d = first
        for _ in range(months):
            key = (d.year, d.month)
            ti, to = aggregates.get(key, (0.0, 0.0))
            surplus = max(0.0, ti - to)
            series.append(
                SurplusMonthlyRow(
                    year=d.year,
                    month=d.month,
                    total_inflow=ti,
                    total_outflow=to,
                    surplus=surplus,
                    pf=pf_contribution_for_month(d.year, d.month, date.today()),
                )
            )
            d = d + relativedelta(months=1)

        return SurplusMonthlySeriesResult(
            end_year=end_year,
            end_month=end_month,
            months=months,
            series=series,
        )
