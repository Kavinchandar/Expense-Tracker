from __future__ import annotations

from sqlalchemy import Float, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from db import Base


class MonthlyBudget(Base):
    __tablename__ = "monthly_budgets"
    __table_args__ = (
        UniqueConstraint("year", "month", "category", name="uq_budget_year_month_category"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    year: Mapped[int] = mapped_column(Integer, index=True)
    month: Mapped[int] = mapped_column(Integer, index=True)
    category: Mapped[str] = mapped_column(String(128))
    amount: Mapped[float] = mapped_column(Float)  # budget in account currency (e.g. INR)
