from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from data.models.statement import StatementUpload, StoredTransaction


class StatementUploadRepository:
    """Create statement uploads and child transactions."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def create_upload_with_parsed_rows(
        self,
        filename: str,
        parsed_rows: list[dict[str, Any]],
    ) -> tuple[int, int]:
        upload = StatementUpload(filename=filename[:512])
        self._session.add(upload)
        self._session.flush()

        for row in parsed_rows:
            self._session.add(
                StoredTransaction(
                    upload_id=upload.id,
                    posted_date=row["date"],
                    description=row["description"][:1024],
                    amount=row["amount"],
                    category="UNCATEGORIZED",
                )
            )

        return upload.id, len(parsed_rows)
