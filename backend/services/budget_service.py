from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from categories import EXPENSE_CATEGORIES
from data.repositories.budget_repository import BudgetRepository
from services.buckets import month_date_range
from services.exceptions import ValidationError


@dataclass(frozen=True)
class MonthlyBudgetsResult:
    year: int
    month: int
    budgets: dict[str, float]


class BudgetService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._repo = BudgetRepository(session)

    def get_monthly_budgets(self, year: int, month: int) -> MonthlyBudgetsResult:
        month_date_range(year, month)  # validates month
        by_cat = self._repo.list_defaults()
        if not by_cat:
            legacy = self._repo.legacy_latest_snapshot()
            if legacy:
                full = {k: float(legacy.get(k, 0.0)) for k in EXPENSE_CATEGORIES}
                self._repo.replace_defaults(full)
                self._session.commit()
                by_cat = self._repo.list_defaults()
        budgets = {k: float(by_cat.get(k, 0.0)) for k in EXPENSE_CATEGORIES}
        return MonthlyBudgetsResult(year=year, month=month, budgets=budgets)

    def save_monthly_budgets(
        self, year: int, month: int, budgets: dict[str, float]
    ) -> MonthlyBudgetsResult:
        month_date_range(year, month)
        unknown = set(budgets.keys()) - set(EXPENSE_CATEGORIES)
        if unknown:
            raise ValidationError(f"Unknown categories: {', '.join(sorted(unknown))}")
        full = {k: float(budgets.get(k, 0.0)) for k in EXPENSE_CATEGORIES}
        if any(v < 0 for v in full.values()):
            raise ValidationError("Budget amounts must be zero or positive.")
        self._repo.replace_defaults(full)
        self._session.commit()
        return self.get_monthly_budgets(year, month)
