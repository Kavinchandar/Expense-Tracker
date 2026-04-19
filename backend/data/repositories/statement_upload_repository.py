from __future__ import annotations

from typing import Any

from sqlalchemy import and_, delete, exists, select
from sqlalchemy.orm import Session

from data.models.statement import StatementUpload, StoredTransaction
from services.transaction_fingerprint import (
    line_fingerprint_digest_from_parsed,
    normalize_description,
)


class StatementUploadRepository:
    """Create statement uploads and child transactions."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def delete_uploads_with_no_transactions(self) -> int:
        """Remove statement_uploads rows that have no child transactions (after a range delete)."""
        stmt = delete(StatementUpload).where(
            ~exists(
                select(1).where(StoredTransaction.upload_id == StatementUpload.id)
            )
        )
        result = self._session.execute(stmt)
        return int(result.rowcount or 0)

    def create_upload_with_parsed_rows(
        self,
        filename: str,
        parsed_rows: list[dict[str, Any]],
    ) -> tuple[int, int, int]:
        """Returns (upload_id, rows_inserted, rows_skipped_global_duplicate)."""
        upload = StatementUpload(filename=filename[:512])
        self._session.add(upload)
        self._session.flush()

        inserted = 0
        skipped_global = 0
        batch_fp: set[str] = set()
        for row in parsed_rows:
            fp = line_fingerprint_digest_from_parsed(row)
            if fp in batch_fp:
                skipped_global += 1
                continue
            exists_id = self._session.scalar(
                select(StoredTransaction.id).where(
                    and_(
                        StoredTransaction.line_fingerprint == fp,
                        StoredTransaction.deleted_at.is_(None),
                    )
                )
            )
            if exists_id is not None:
                skipped_global += 1
                continue
            batch_fp.add(fp)
            bal = row.get("balance_after")
            desc = row["description"][:1024]
            detail = (row.get("detail") or "")[:2048]
            merchant_key = normalize_description(desc)
            category = row.get("category", "UNCATEGORIZED")
            self._session.add(
                StoredTransaction(
                    upload_id=upload.id,
                    line_fingerprint=fp,
                    posted_date=row["date"],
                    description=desc,
                    detail=detail or None,
                    merchant_key=merchant_key,
                    amount=row["amount"],
                    balance_after=bal if bal is not None else None,
                    category=category,
                )
            )
            inserted += 1

        if inserted == 0:
            self._session.delete(upload)
            self._session.flush()
            return 0, 0, skipped_global

        return upload.id, inserted, skipped_global
