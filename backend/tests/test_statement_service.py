from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy.orm import sessionmaker

from data.models.statement import StatementUpload, StoredTransaction
from services.exceptions import NotFoundError, ValidationError
from services.statement_service import StatementService


def test_set_category_not_found(memory_engine):
    Session = sessionmaker(bind=memory_engine)
    session = Session()
    try:
        svc = StatementService(session)
        with pytest.raises(NotFoundError):
            svc.set_transaction_category(999, "FOOD_AND_DRINK")
    finally:
        session.close()


def test_set_category_invalid(memory_engine):
    Session = sessionmaker(bind=memory_engine)
    session = Session()
    try:
        upload = StatementUpload(filename="x.pdf")
        session.add(upload)
        session.flush()
        row = StoredTransaction(
            upload_id=upload.id,
            posted_date=date(2024, 6, 1),
            description="coffee",
            amount=-5.0,
            category="UNCATEGORIZED",
        )
        session.add(row)
        session.commit()

        svc = StatementService(session)
        with pytest.raises(ValidationError, match="Unknown category"):
            svc.set_transaction_category(row.id, "NOT_A_REAL_CATEGORY")
    finally:
        session.close()


def test_monthly_transactions_after_upload(memory_engine):
    Session = sessionmaker(bind=memory_engine)
    session = Session()
    try:
        upload = StatementUpload(filename="x.pdf")
        session.add(upload)
        session.flush()
        session.add(
            StoredTransaction(
                upload_id=upload.id,
                posted_date=date(2024, 6, 15),
                description="lunch",
                amount=-12.5,
                category="FOOD_AND_DRINK",
            )
        )
        session.commit()

        svc = StatementService(session)
        result = svc.monthly_transactions(2024, 6)
        assert result.month_total == pytest.approx(-12.5)
        assert len(result.buckets) == 1
        assert result.buckets[0]["name"] == "FOOD_AND_DRINK"
    finally:
        session.close()


def test_upload_pdf_rejects_non_pdf(memory_engine):
    Session = sessionmaker(bind=memory_engine)
    session = Session()
    try:
        svc = StatementService(session)
        with pytest.raises(ValidationError, match="PDF"):
            svc.upload_pdf("notes.txt", b"%PDF-fake")
    finally:
        session.close()
