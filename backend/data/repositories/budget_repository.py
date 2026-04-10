from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from categories import EXPENSE_CATEGORIES
from data.models.budget_default import BudgetDefault
from data.models.monthly_budget import MonthlyBudget


class BudgetRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_defaults(self) -> dict[str, float]:
        q = select(BudgetDefault)
        rows = list(self._session.execute(q).scalars().all())
        return {r.category: float(r.amount) for r in rows}

    def replace_defaults(self, amounts: dict[str, float]) -> None:
        self._session.execute(delete(BudgetDefault))
        for category in EXPENSE_CATEGORIES:
            amt = float(amounts.get(category, 0.0))
            self._session.add(BudgetDefault(category=category, amount=amt))

    def legacy_latest_snapshot(self) -> dict[str, float] | None:
        """Most recent month in legacy `monthly_budgets`, if any."""
        q = (
            select(MonthlyBudget.year, MonthlyBudget.month)
            .order_by(MonthlyBudget.year.desc(), MonthlyBudget.month.desc())
            .limit(1)
        )
        row = self._session.execute(q).first()
        if not row:
            return None
        y, m = int(row[0]), int(row[1])
        legacy_rows = self.list_for_month(y, m)
        if not legacy_rows:
            return None
        return {r.category: float(r.amount) for r in legacy_rows}

    def list_for_month(self, year: int, month: int) -> list[MonthlyBudget]:
        q = select(MonthlyBudget).where(
            MonthlyBudget.year == year,
            MonthlyBudget.month == month,
        )
        return list(self._session.execute(q).scalars().all())
