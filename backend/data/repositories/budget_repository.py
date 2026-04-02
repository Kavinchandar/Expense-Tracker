from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from data.models.monthly_budget import MonthlyBudget


class BudgetRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_for_month(self, year: int, month: int) -> list[MonthlyBudget]:
        q = select(MonthlyBudget).where(
            MonthlyBudget.year == year,
            MonthlyBudget.month == month,
        )
        return list(self._session.execute(q).scalars().all())

    def replace_month(self, year: int, month: int, amounts: dict[str, float]) -> None:
        self._session.execute(
            delete(MonthlyBudget).where(
                MonthlyBudget.year == year,
                MonthlyBudget.month == month,
            )
        )
        for category, amount in amounts.items():
            if amount is None:
                continue
            self._session.add(
                MonthlyBudget(
                    year=year,
                    month=month,
                    category=category,
                    amount=float(amount),
                )
            )
