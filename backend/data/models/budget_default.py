from __future__ import annotations

from sqlalchemy import Float, String
from sqlalchemy.orm import Mapped, mapped_column

from db import Base


class BudgetDefault(Base):
    """Single set of budget amounts per category, shared across all months."""

    __tablename__ = "budget_defaults"

    category: Mapped[str] = mapped_column(String(128), primary_key=True)
    amount: Mapped[float] = mapped_column(Float)
