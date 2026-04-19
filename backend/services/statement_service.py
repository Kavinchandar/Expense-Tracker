"""Business logic for PDF statement uploads and stored transactions."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from categories import (
    DELETED_BUCKET_KEY,
    EXPENSE_CATEGORIES,
    SURPLUS_ALLOCATION_EXPENSE_KEYS,
)
from config import get_settings
from data.repositories.statement_upload_repository import StatementUploadRepository
from data.repositories.stored_transaction_repository import StoredTransactionRepository
from data.models.statement import StoredTransaction
from services import pdf_statement
from services.buckets import group_by_bucket, month_date_range
from services.exceptions import NotFoundError, UnprocessableEntityError, ValidationError
from services.auto_categorize import classify
from services.transaction_fingerprint import line_fingerprint_digest_from_parsed

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
    skipped_duplicates: int  # duplicate lines within the same PDF
    replaced_count: int  # legacy; always 0 (incremental import; no date-range wipe)


def _period_cashflow_and_balances(rows: list[StoredTransaction]) -> tuple[float, float, float | None, float | None]:
    """Sum credits/debits; opening/closing from running balance when ICICI stored it."""
    total_inflow = sum(t.amount for t in rows if t.amount > 0)
    surplus_alloc = set(SURPLUS_ALLOCATION_EXPENSE_KEYS)
    total_outflow = sum(
        -t.amount
        for t in rows
        if t.amount < 0 and t.category not in surplus_alloc
    )
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


def _stored_to_bucket_row(t: StoredTransaction, *, is_deleted: bool = False) -> dict:
    # Never emit null: frontend used `patchingId === id` and null===null disabled every row.
    ref = t.line_fingerprint or str(t.id)
    return {
        "transaction_id": ref,
        "date": t.posted_date.isoformat(),
        "name": t.description,
        "detail": t.detail or "",
        "amount": t.amount,
        "merchant_name": None,
        "primary_category": DELETED_BUCKET_KEY if is_deleted else t.category,
        "detailed_category": None,
        "pending": False,
        "is_deleted": is_deleted,
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
                upload_id=0, parsed_count=0, skipped_duplicates=0, replaced_count=0
            )

        intra_seen: set[str] = set()
        to_insert: list[dict] = []
        intra_dup = 0
        for row in parsed:
            d = line_fingerprint_digest_from_parsed(row)
            if d in intra_seen:
                intra_dup += 1
                continue
            intra_seen.add(d)
            to_insert.append(row)

        n_after_intra = len(to_insert)
        global_pre_skip = 0
        if to_insert:
            want = {line_fingerprint_digest_from_parsed(r) for r in to_insert}
            already = self._stored.existing_line_fingerprints(want)
            to_insert = [
                r
                for r in to_insert
                if line_fingerprint_digest_from_parsed(r) not in already
            ]
            global_pre_skip = n_after_intra - len(to_insert)

        for row in to_insert:
            row["category"] = classify(
                self._session, str(row.get("description", "")), float(row["amount"])
            )

        if not to_insert:
            self._session.commit()
            return UploadStatementResult(
                upload_id=0,
                parsed_count=0,
                skipped_duplicates=intra_dup + global_pre_skip,
                replaced_count=0,
            )

        upload_id, count, global_skip = self._uploads.create_upload_with_parsed_rows(
            name, to_insert
        )
        self._session.commit()
        skipped = intra_dup + global_pre_skip + global_skip
        if count == 0:
            return UploadStatementResult(
                upload_id=0,
                parsed_count=0,
                skipped_duplicates=skipped,
                replaced_count=0,
            )
        return UploadStatementResult(
            upload_id=upload_id,
            parsed_count=count,
            skipped_duplicates=skipped,
            replaced_count=0,
        )

    def monthly_transactions(self, year: int, month: int) -> MonthlyTransactionsResult:
        start, end = month_date_range(year, month)
        rows = self._stored.list_for_date_range(start, end)
        active = [t for t in rows if t.deleted_at is None]
        deleted = [t for t in rows if t.deleted_at is not None]
        total_inflow, total_outflow, opening_balance, closing_balance = _period_cashflow_and_balances(
            active
        )
        dict_rows = [_stored_to_bucket_row(t) for t in active]
        buckets, month_total = group_by_bucket(dict_rows)
        if deleted:
            del_rows = [_stored_to_bucket_row(t, is_deleted=True) for t in deleted]
            del_rows.sort(
                key=lambda x: (x["date"], str(x.get("transaction_id", ""))),
                reverse=True,
            )
            buckets.append(
                {
                    "name": DELETED_BUCKET_KEY,
                    "total": sum(x["amount"] for x in del_rows),
                    "transactions": del_rows,
                }
            )
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

    def set_transaction_category(self, transaction_id: str, category: str) -> None:
        if category not in EXPENSE_CATEGORIES:
            allowed = ", ".join(EXPENSE_CATEGORIES)
            raise ValidationError(f"Unknown category. Use one of: {allowed}")

        row = self._stored.get_by_ref(transaction_id)
        if row is None:
            raise NotFoundError("Transaction not found.")
        if row.deleted_at is not None:
            raise ValidationError("Restore a deleted transaction before changing its category.")

        row.category = category
        self._session.commit()

    def set_transaction_detail(self, transaction_id: str, detail: str) -> None:
        row = self._stored.get_by_ref(transaction_id)
        if row is None:
            raise NotFoundError("Transaction not found.")
        if row.deleted_at is not None:
            raise ValidationError("Restore a deleted transaction before editing notes.")

        row.detail = (detail or "")[:2048]
        self._session.commit()

    def soft_delete_transaction(self, transaction_id: str) -> None:
        ok = self._stored.soft_delete(transaction_id)
        if not ok:
            raise NotFoundError("Transaction not found or already deleted.")
        self._session.commit()

    def restore_transaction(self, transaction_id: str) -> None:
        ok = self._stored.restore(transaction_id)
        if not ok:
            raise NotFoundError("Transaction not found or not deleted.")
        self._session.commit()

    def clear_month_transactions(self, year: int, month: int) -> int:
        start, end = month_date_range(year, month)
        deleted_count = self._stored.delete_in_date_range(start, end)
        self._uploads.delete_uploads_with_no_transactions()
        self._session.commit()
        return deleted_count

    def clear_all_transactions(self) -> int:
        deleted_count = self._stored.delete_all()
        self._uploads.delete_uploads_with_no_transactions()
        self._session.commit()
        return deleted_count
