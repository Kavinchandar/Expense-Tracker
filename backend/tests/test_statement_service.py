from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy.orm import sessionmaker

from data.models.statement import StatementUpload, StoredTransaction
from services.exceptions import NotFoundError, ValidationError
from services.statement_service import StatementService
from services.transaction_fingerprint import (
    line_fingerprint_digest_from_stored,
    normalize_description,
)


def test_set_category_not_found(memory_engine):
    Session = sessionmaker(bind=memory_engine)
    session = Session()
    try:
        svc = StatementService(session)
        with pytest.raises(NotFoundError):
            svc.set_transaction_category("999", "FOOD_AND_DINING")
    finally:
        session.close()


def test_set_category_invalid(memory_engine):
    Session = sessionmaker(bind=memory_engine)
    session = Session()
    try:
        upload = StatementUpload(filename="x.pdf")
        session.add(upload)
        session.flush()
        fp = line_fingerprint_digest_from_stored(
            date(2024, 6, 1), -5.0, "coffee"
        )
        row = StoredTransaction(
            upload_id=upload.id,
            line_fingerprint=fp,
            posted_date=date(2024, 6, 1),
            description="coffee",
            merchant_key=normalize_description("coffee"),
            amount=-5.0,
            category="UNCATEGORIZED",
        )
        session.add(row)
        session.commit()

        svc = StatementService(session)
        with pytest.raises(ValidationError, match="Unknown category"):
            svc.set_transaction_category(fp, "NOT_A_REAL_CATEGORY")
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
                line_fingerprint=line_fingerprint_digest_from_stored(
                    date(2024, 6, 15), -12.5, "lunch"
                ),
                posted_date=date(2024, 6, 15),
                description="lunch",
                merchant_key=normalize_description("lunch"),
                amount=-12.5,
                category="FOOD_AND_DINING",
            )
        )
        session.commit()

        svc = StatementService(session)
        result = svc.monthly_transactions(2024, 6)
        assert result.month_total == pytest.approx(-12.5)
        assert result.total_inflow == pytest.approx(0.0)
        assert result.total_outflow == pytest.approx(12.5)
        assert result.opening_balance is None
        assert result.closing_balance is None
        assert len(result.buckets) == 1
        assert result.buckets[0]["name"] == "FOOD_AND_DINING"
    finally:
        session.close()


def test_monthly_balances_from_running_balance(memory_engine):
    Session = sessionmaker(bind=memory_engine)
    session = Session()
    try:
        upload = StatementUpload(filename="x.pdf")
        session.add(upload)
        session.flush()
        session.add(
            StoredTransaction(
                upload_id=upload.id,
                line_fingerprint=line_fingerprint_digest_from_stored(
                    date(2024, 6, 1), -100.0, "withdraw"
                ),
                posted_date=date(2024, 6, 1),
                description="withdraw",
                merchant_key=normalize_description("withdraw"),
                amount=-100.0,
                balance_after=900.0,
                category="UNCATEGORIZED",
            )
        )
        session.add(
            StoredTransaction(
                upload_id=upload.id,
                line_fingerprint=line_fingerprint_digest_from_stored(
                    date(2024, 6, 2), 50.0, "deposit"
                ),
                posted_date=date(2024, 6, 2),
                description="deposit",
                merchant_key=normalize_description("deposit"),
                amount=50.0,
                balance_after=950.0,
                category="UNCATEGORIZED",
            )
        )
        session.commit()

        svc = StatementService(session)
        result = svc.monthly_transactions(2024, 6)
        assert result.opening_balance == pytest.approx(1000.0)
        assert result.closing_balance == pytest.approx(950.0)
        assert result.total_inflow == pytest.approx(50.0)
        assert result.total_outflow == pytest.approx(100.0)
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


def test_upload_skips_lines_already_stored_incremental_import(monkeypatch, memory_engine):
    Session = sessionmaker(bind=memory_engine)
    session = Session()
    try:
        import services.statement_service as ss

        def fake_extract(_b: bytes):
            return [
                {"date": date(2024, 6, 15), "description": "coffee", "amount": -5.0},
            ]

        monkeypatch.setattr(
            ss.pdf_statement, "extract_transaction_lines_from_pdf", fake_extract
        )

        svc = StatementService(session)
        r1 = svc.upload_pdf("a.pdf", b"%PDF")
        assert r1.parsed_count == 1
        assert r1.skipped_duplicates == 0
        assert r1.replaced_count == 0

        r2 = svc.upload_pdf("b.pdf", b"%PDF")
        assert r2.parsed_count == 0
        assert r2.skipped_duplicates == 1
        assert r2.replaced_count == 0
    finally:
        session.close()
