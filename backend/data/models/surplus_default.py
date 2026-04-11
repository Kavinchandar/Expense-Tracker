from __future__ import annotations

from sqlalchemy import Float, String
from sqlalchemy.orm import Mapped, mapped_column

from db import Base


class SurplusDefault(Base):
    """Single set of surplus target amounts per category, shared across all months."""

    __tablename__ = "surplus_defaults"

    category: Mapped[str] = mapped_column(String(128), primary_key=True)
    amount: Mapped[float] = mapped_column(Float)
