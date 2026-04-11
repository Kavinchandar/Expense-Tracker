from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Integer, case, cast, delete, func, select
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
            StoredTransaction.line_fingerprint.in_(digests),
            StoredTransaction.deleted_at.is_(None),
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
            fingerprint_from_stored(t.posted_date, t.amount, t.description)
            for t in rows
            if t.deleted_at is None
        }

    def soft_delete(self, ref: str) -> bool:
        row = self.get_by_ref(ref)
        if row is None or row.deleted_at is not None:
            return False
        row.deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)
        return True

    def restore(self, ref: str) -> bool:
        row = self.get_by_ref(ref)
        if row is None or row.deleted_at is None:
            return False
        row.deleted_at = None
        return True

    def monthly_cashflow_aggregates(
        self, start: date, end: date
    ) -> dict[tuple[int, int], tuple[float, float]]:
        """Sum inflow and outflow per calendar month for non-deleted rows in [start, end]."""
        y = cast(func.strftime("%Y", StoredTransaction.posted_date), Integer).label("y")
        m = cast(func.strftime("%m", StoredTransaction.posted_date), Integer).label("m")
        inflow = func.coalesce(
            func.sum(case((StoredTransaction.amount > 0, StoredTransaction.amount), else_=0.0)),
            0.0,
        )
        outflow = func.coalesce(
            func.sum(case((StoredTransaction.amount < 0, -StoredTransaction.amount), else_=0.0)),
            0.0,
        )
        q = (
            select(y, m, inflow.label("total_inflow"), outflow.label("total_outflow"))
            .where(
                StoredTransaction.posted_date >= start,
                StoredTransaction.posted_date <= end,
                StoredTransaction.deleted_at.is_(None),
            )
            .group_by(y, m)
        )
        out: dict[tuple[int, int], tuple[float, float]] = {}
        for row in self._session.execute(q).all():
            yy, mm, ti, to = int(row.y), int(row.m), float(row.total_inflow), float(row.total_outflow)
            out[(yy, mm)] = (ti, to)
        return out

    def yearly_cashflow_totals(self, year: int) -> tuple[float, float]:
        """Sum credits and debits (as positive outflow) for calendar year, non-deleted rows only."""
        start = date(year, 1, 1)
        end = date(year, 12, 31)
        inflow = func.coalesce(
            func.sum(case((StoredTransaction.amount > 0, StoredTransaction.amount), else_=0.0)),
            0.0,
        )
        outflow = func.coalesce(
            func.sum(case((StoredTransaction.amount < 0, -StoredTransaction.amount), else_=0.0)),
            0.0,
        )
        q = select(inflow, outflow).where(
            StoredTransaction.posted_date >= start,
            StoredTransaction.posted_date <= end,
            StoredTransaction.deleted_at.is_(None),
        )
        row = self._session.execute(q).one()
        return float(row[0] or 0.0), float(row[1] or 0.0)

    def last_balance_on_or_before(self, on_or_before: date) -> float | None:
        """Latest running balance from imports, after the chronologically last line on or before the date."""
        q = (
            select(StoredTransaction.balance_after)
            .where(
                StoredTransaction.posted_date <= on_or_before,
                StoredTransaction.deleted_at.is_(None),
                StoredTransaction.balance_after.is_not(None),
            )
            .order_by(StoredTransaction.posted_date.desc(), StoredTransaction.id.desc())
            .limit(1)
        )
        val = self._session.execute(q).scalar_one_or_none()
        return float(val) if val is not None else None
