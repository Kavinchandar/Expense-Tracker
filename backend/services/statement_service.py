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

MAX_STATEMENT_UPLOAD_BYTES = 10 * 1024 * 1024


@dataclass(frozen=True)
class MonthlyTransactionsResult:
    year: int
    month: int
    month_total: float
    buckets: list
    display_timezone: str


@dataclass(frozen=True)
class UploadStatementResult:
    upload_id: int
    parsed_count: int


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

        upload_id, count = self._uploads.create_upload_with_parsed_rows(name, parsed)
        self._session.commit()
        return UploadStatementResult(upload_id=upload_id, parsed_count=count)

    def monthly_transactions(self, year: int, month: int) -> MonthlyTransactionsResult:
        start, end = month_date_range(year, month)
        rows = self._stored.list_for_date_range(start, end)
        dict_rows = [_stored_to_bucket_row(t) for t in rows]
        buckets, month_total = group_by_bucket(dict_rows)
        settings = get_settings()
        return MonthlyTransactionsResult(
            year=year,
            month=month,
            month_total=month_total,
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
