from __future__ import annotations

from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from data.models.statement import StoredTransaction
from services.transaction_fingerprint import fingerprint_from_stored


class StoredTransactionRepository:
    """Read/update persisted statement line items."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def delete_in_date_range(self, start: date, end: date) -> int:
        """Remove all stored lines in [start, end]. Used to refresh a period on re-upload."""
        stmt = delete(StoredTransaction).where(
            StoredTransaction.posted_date >= start,
            StoredTransaction.posted_date <= end,
        )
        result = self._session.execute(stmt)
        return int(result.rowcount or 0)

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

    def existing_line_fingerprints(self, digests: set[str]) -> set[str]:
        """Return which of the given line fingerprints already exist in the database."""
        if not digests:
            return set()
        q = select(StoredTransaction.line_fingerprint).where(
            StoredTransaction.line_fingerprint.in_(digests)
        )
        return set(self._session.scalars(q).all())

    def get_by_ref(self, ref: str) -> StoredTransaction | None:
        """Resolve by numeric primary key (legacy) or by unique line_fingerprint."""
        ref = ref.strip()
        if ref.isdigit():
            row = self.get(int(ref))
            if row is not None:
                return row
        return self._session.scalar(
            select(StoredTransaction).where(StoredTransaction.line_fingerprint == ref)
        )

    def fingerprints_in_date_range(self, start: date, end: date) -> set[tuple[str, float, str]]:
        rows = self.list_for_date_range(start, end)
        return {
            fingerprint_from_stored(t.posted_date, t.amount, t.description) for t in rows
        }
