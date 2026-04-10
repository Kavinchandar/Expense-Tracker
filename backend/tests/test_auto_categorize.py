from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from data.models.statement import StatementUpload, StoredTransaction
from services.auto_categorize import classify, history_suggest
from services.statement_service import StatementService
from services.transaction_fingerprint import (
    line_fingerprint_digest_from_stored,
    normalize_description,
)


def test_classify_rule_swiggy(memory_engine):
    Session = sessionmaker(bind=memory_engine)
    session = Session()
    try:
        cat = classify(session, "PAYMENT SWIGGY BANGALORE", -500.0)
        assert cat == "FOOD_ORDERED"
    finally:
        session.close()


def test_classify_fallback_when_no_rule_or_history(memory_engine):
    Session = sessionmaker(bind=memory_engine)
    session = Session()
    try:
        cat = classify(session, "XYZUNKNOWN MERCHANT 99999", -10.0)
        assert cat == "UNCATEGORIZED"
    finally:
        session.close()


def test_history_suggest_majority(memory_engine):
    Session = sessionmaker(bind=memory_engine)
    session = Session()
    try:
        mk = normalize_description("same merchant text")
        upload = StatementUpload(filename="x.pdf")
        session.add(upload)
        session.flush()
        for i, amt, cat in [
            (1, -1.0, "GROCERIES"),
            (2, -2.0, "GROCERIES"),
            (3, -3.0, "GROCERIES"),
            (4, -4.0, "COFFEE"),
        ]:
            d = date(2024, 5, i)
            fp = line_fingerprint_digest_from_stored(d, amt, "same merchant text")
            session.add(
                StoredTransaction(
                    upload_id=upload.id,
                    line_fingerprint=fp,
                    posted_date=d,
                    description="same merchant text",
                    merchant_key=mk,
                    amount=amt,
                    category=cat,
                )
            )
        session.commit()

        assert history_suggest(session, mk) == "GROCERIES"

        cat = classify(session, "same merchant text", -5.0)
        assert cat == "GROCERIES"
    finally:
        session.close()


def test_history_tiebreak_most_recent(memory_engine):
    Session = sessionmaker(bind=memory_engine)
    session = Session()
    try:
        mk = normalize_description("tie merchant")
        upload = StatementUpload(filename="x.pdf")
        session.add(upload)
        session.flush()
        session.add(
            StoredTransaction(
                upload_id=upload.id,
                line_fingerprint=line_fingerprint_digest_from_stored(
                    date(2024, 3, 1), -1.0, "tie merchant"
                ),
                posted_date=date(2024, 3, 1),
                description="tie merchant",
                merchant_key=mk,
                amount=-1.0,
                category="SHOPPING",
            )
        )
        session.add(
            StoredTransaction(
                upload_id=upload.id,
                line_fingerprint=line_fingerprint_digest_from_stored(
                    date(2024, 4, 1), -1.0, "tie merchant"
                ),
                posted_date=date(2024, 4, 1),
                description="tie merchant",
                merchant_key=mk,
                amount=-1.0,
                category="COFFEE",
            )
        )
        session.commit()
        assert history_suggest(session, mk) == "COFFEE"
    finally:
        session.close()


def test_upload_sets_category_from_rule(monkeypatch, memory_engine):
    import services.statement_service as ss

    Session = sessionmaker(bind=memory_engine)
    session = Session()
    try:

        def fake_extract(_b: bytes):
            return [
                {
                    "date": date(2024, 6, 15),
                    "description": "POS SWIGGY",
                    "amount": -100.0,
                },
            ]

        monkeypatch.setattr(
            ss.pdf_statement, "extract_transaction_lines_from_pdf", fake_extract
        )

        svc = StatementService(session)
        r = svc.upload_pdf("a.pdf", b"%PDF")
        assert r.parsed_count == 1
        row = session.execute(select(StoredTransaction)).scalar_one()
        assert row.category == "FOOD_ORDERED"
        assert row.merchant_key == normalize_description("POS SWIGGY")
    finally:
        session.close()
