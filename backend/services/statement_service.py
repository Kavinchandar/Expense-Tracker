"""Business logic for PDF statement uploads and stored transactions."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from categories import EXPENSE_CATEGORIES
from config import get_settings
from data.repositories.statement_upload_repository import StatementUploadRepository
from data.repositories.stored_transaction_repository import StoredTransactionRepository
from data.models.statement import StoredTransaction
from services import pdf_statement
from services.buckets import group_by_bucket, month_date_range
from services.exceptions import NotFoundError, UnprocessableEntityError, ValidationError
from services.transaction_fingerprint import fingerprint_from_parsed

MAX_STATEMENT_UPLOAD_BYTES = 10 * 1024 * 1024


@dataclass(frozen=True)
class MonthlyTransactionsResult:
    year: int
    month: int
    month_total: float
    total_inflow: float
    total_outflow: float
    opening_balance: float | None
    closing_balance: float | None
    buckets: list
    display_timezone: str


@dataclass(frozen=True)
class UploadStatementResult:
    upload_id: int
    parsed_count: int  # rows inserted
    skipped_duplicates: int  # lines from PDF not inserted (already present or duplicate in file)


def _period_cashflow_and_balances(rows: list[StoredTransaction]) -> tuple[float, float, float | None, float | None]:
    """Sum credits/debits; opening/closing from running balance when ICICI stored it."""
    total_inflow = sum(t.amount for t in rows if t.amount > 0)
    total_outflow = sum(-t.amount for t in rows if t.amount < 0)
    if not rows:
        return total_inflow, total_outflow, None, None
    ordered = sorted(rows, key=lambda t: (t.posted_date, t.id))
    first, last = ordered[0], ordered[-1]
    opening: float | None = None
    closing: float | None = None
    if first.balance_after is not None:
        opening = round(first.balance_after - first.amount, 2)
    if last.balance_after is not None:
        closing = round(last.balance_after, 2)
    return total_inflow, total_outflow, opening, closing


def _stored_to_bucket_row(t: StoredTransaction) -> dict:
    return {
        "transaction_id": str(t.id),
        "date": t.posted_date.isoformat(),
        "name": t.description,
        "amount": t.amount,
        "merchant_name": None,
        "primary_category": t.category,
        "detailed_category": None,
        "pending": False,
    }


class StatementService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._uploads = StatementUploadRepository(session)
        self._stored = StoredTransactionRepository(session)

    def upload_pdf(self, filename: str, file_bytes: bytes) -> UploadStatementResult:
        name = (filename or "").strip()
        if not name.lower().endswith(".pdf"):
            raise ValidationError("Upload a PDF bank statement.")

        if len(file_bytes) > MAX_STATEMENT_UPLOAD_BYTES:
            raise ValidationError("File too large (max 10 MB).")

        try:
            parsed = pdf_statement.extract_transaction_lines_from_pdf(file_bytes)
        except Exception as e:
            raise UnprocessableEntityError(f"Could not read or parse PDF: {e}") from e

        if not parsed:
            return UploadStatementResult(
                upload_id=0, parsed_count=0, skipped_duplicates=0
            )

        # One set: DB rows in this date range + lines we've already accepted from this PDF.
        # Hashable tuple key = (date iso, amount, normalized description); dicts can't live in a set.
        min_d = min(r["date"] for r in parsed)
        max_d = max(r["date"] for r in parsed)
        seen = self._stored.fingerprints_in_date_range(min_d, max_d)

        to_insert: list[dict] = []
        for row in parsed:
            fp = fingerprint_from_parsed(row)
            if fp in seen:
                continue
            seen.add(fp)
            to_insert.append(row)

        skipped = len(parsed) - len(to_insert)

        if not to_insert:
            return UploadStatementResult(
                upload_id=0, parsed_count=0, skipped_duplicates=skipped
            )

        upload_id, count = self._uploads.create_upload_with_parsed_rows(name, to_insert)
        self._session.commit()
        return UploadStatementResult(
            upload_id=upload_id, parsed_count=count, skipped_duplicates=skipped
        )

    def monthly_transactions(self, year: int, month: int) -> MonthlyTransactionsResult:
        start, end = month_date_range(year, month)
        rows = self._stored.list_for_date_range(start, end)
        total_inflow, total_outflow, opening_balance, closing_balance = _period_cashflow_and_balances(
            rows
        )
        dict_rows = [_stored_to_bucket_row(t) for t in rows]
        buckets, month_total = group_by_bucket(dict_rows)
        settings = get_settings()
        return MonthlyTransactionsResult(
            year=year,
            month=month,
            month_total=month_total,
            total_inflow=total_inflow,
            total_outflow=total_outflow,
            opening_balance=opening_balance,
            closing_balance=closing_balance,
            buckets=buckets,
            display_timezone=settings.display_timezone,
        )

    def set_transaction_category(self, transaction_id: int, category: str) -> None:
        if category not in EXPENSE_CATEGORIES:
            allowed = ", ".join(EXPENSE_CATEGORIES)
            raise ValidationError(f"Unknown category. Use one of: {allowed}")

        row = self._stored.get(transaction_id)
        if row is None:
            raise NotFoundError("Transaction not found.")

        row.category = category
        self._session.commit()
