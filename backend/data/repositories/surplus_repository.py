from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from categories import SURPLUS_CATEGORIES
from data.models.surplus_default import SurplusDefault


class SurplusRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_defaults(self) -> dict[str, float]:
        q = select(SurplusDefault)
        rows = list(self._session.execute(q).scalars().all())
        return {r.category: float(r.amount) for r in rows}

    def replace_defaults(self, amounts: dict[str, float]) -> None:
        self._session.execute(delete(SurplusDefault))
        for category in SURPLUS_CATEGORIES:
            amt = float(amounts.get(category, 0.0))
            self._session.add(SurplusDefault(category=category, amount=amt))
