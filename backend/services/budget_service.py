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
        rows = self._repo.list_for_month(year, month)
        by_cat = {r.category: r.amount for r in rows}
        budgets = {k: float(by_cat.get(k, 0.0)) for k in EXPENSE_CATEGORIES}
        return MonthlyBudgetsResult(year=year, month=month, budgets=budgets)

    def save_monthly_budgets(
        self, year: int, month: int, budgets: dict[str, float]
    ) -> MonthlyBudgetsResult:
        month_date_range(year, month)
        unknown = set(budgets.keys()) - set(EXPENSE_CATEGORIES)
        if unknown:
            raise ValidationError(f"Unknown categories: {', '.join(sorted(unknown))}")
        if any(float(v) < 0 for v in budgets.values()):
            raise ValidationError("Budget amounts must be zero or positive.")
        clean = {k: float(v) for k, v in budgets.items() if float(v) > 0}
        self._repo.replace_month(year, month, clean)
        self._session.commit()
        return self.get_monthly_budgets(year, month)
