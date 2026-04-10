from __future__ import annotations

from datetime import date
from types import SimpleNamespace
from unittest.mock import patch

from data.models.statement import StatementUpload, StoredTransaction
from services.transaction_fingerprint import (
    line_fingerprint_digest_from_stored,
    normalize_description,
)


def test_insights_empty_month_returns_message_without_gemini(client):
    r = client.get("/api/insights", params={"year": 2024, "month": 6})
    assert r.status_code == 200
    body = r.json()
    assert "insights" in body
    assert "no transactions" in body["insights"].lower()


def test_insights_requires_api_key_when_transactions_exist(client, memory_engine):
    from sqlalchemy.orm import sessionmaker

    Session = sessionmaker(bind=memory_engine)
    session = Session()
    try:
        upload = StatementUpload(filename="t.pdf")
        session.add(upload)
        session.flush()
        session.add(
            StoredTransaction(
                upload_id=upload.id,
                line_fingerprint=line_fingerprint_digest_from_stored(
                    date(2024, 6, 10), -5.0, "coffee"
                ),
                posted_date=date(2024, 6, 10),
                description="coffee",
                merchant_key=normalize_description("coffee"),
                amount=-5.0,
                category="FOOD_AND_DINING",
            )
        )
        session.commit()
    finally:
        session.close()

    with patch("services.gemini_insights_service.get_settings") as gs:
        gs.return_value = SimpleNamespace(gemini_api_key="", gemini_model="gemini-2.0-flash")
        r = client.get("/api/insights", params={"year": 2024, "month": 6})
    assert r.status_code == 503
    assert "GEMINI_API_KEY" in r.json()["detail"]


def test_insights_invalid_month(client):
    r = client.get("/api/insights", params={"year": 2024, "month": 13})
    assert r.status_code == 400
