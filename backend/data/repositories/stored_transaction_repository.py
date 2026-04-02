from __future__ import annotations

from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from data.models.statement import StoredTransaction
from services.transaction_fingerprint import fingerprint_from_stored


class StoredTransactionRepository:
    """Read/update persisted statement line items."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def list_for_date_range(self, start: date, end: date) -> list[StoredTransaction]:
        q = (
            select(StoredTransaction)
            .where(
                StoredTransaction.posted_date >= start,
                StoredTransaction.posted_date <= end,
            )
            .order_by(StoredTransaction.posted_date.desc(), StoredTransaction.id.desc())
        )
        return list(self._session.execute(q).scalars().all())

    def get(self, transaction_id: int) -> StoredTransaction | None:
        return self._session.get(StoredTransaction, transaction_id)

    def fingerprints_in_date_range(self, start: date, end: date) -> set[tuple[str, float, str]]:
        rows = self.list_for_date_range(start, end)
        return {
            fingerprint_from_stored(t.posted_date, t.amount, t.description) for t in rows
        }
