from __future__ import annotations

from sqlalchemy import Float, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from db import Base


class MonthlyCategoryBudget(Base):
    """Planned spend (or inflow target) per category for a calendar month."""

    __tablename__ = "monthly_category_budgets"
    __table_args__ = (UniqueConstraint("year", "month", "category", name="uq_month_cat"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    year: Mapped[int] = mapped_column(Integer, index=True)
    month: Mapped[int] = mapped_column(Integer, index=True)
    category: Mapped[str] = mapped_column(String(64))
    amount: Mapped[float] = mapped_column(Float)
