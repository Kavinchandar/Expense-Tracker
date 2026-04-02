from __future__ import annotations

from datetime import date

from db import SessionLocal
from data.models.statement import StatementUpload, StoredTransaction


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_categories(client):
    r = client.get("/api/categories")
    assert r.status_code == 200
    body = r.json()
    assert "categories" in body
    assert "UNCATEGORIZED" in body["categories"]


def test_transactions_empty_month(client):
    r = client.get("/api/transactions", params={"year": 2024, "month": 6})
    assert r.status_code == 200
    data = r.json()
    assert data["buckets"] == []
    assert data["month_total"] == 0.0


def test_transactions_invalid_month(client):
    r = client.get("/api/transactions", params={"year": 2024, "month": 13})
    assert r.status_code == 400
    assert "month" in r.json()["detail"].lower()


def test_upload_rejects_non_pdf(client):
    r = client.post(
        "/api/statements/upload",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert r.status_code == 400


def test_patch_transaction_category(client):
    session = SessionLocal()
    try:
        upload = StatementUpload(filename="seed.pdf")
        session.add(upload)
        session.flush()
        row = StoredTransaction(
            upload_id=upload.id,
            posted_date=date(2024, 6, 10),
            description="cafe",
            amount=-4.0,
            category="UNCATEGORIZED",
        )
        session.add(row)
        session.commit()
        tid = row.id
    finally:
        session.close()

    r = client.patch(
        f"/api/transactions/{tid}/category",
        json={"category": "FOOD_AND_DRINK"},
    )
    assert r.status_code == 200

    listed = client.get("/api/transactions", params={"year": 2024, "month": 6})
    assert listed.status_code == 200
    buckets = listed.json()["buckets"]
    assert any(b["name"] == "FOOD_AND_DRINK" for b in buckets)
