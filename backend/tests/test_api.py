from __future__ import annotations

from datetime import date, datetime

import db as db_module
from data.models.statement import StatementUpload, StoredTransaction
from services.transaction_fingerprint import (
    line_fingerprint_digest_from_stored,
    normalize_description,
)


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_categories(client):
    r = client.get("/api/categories")
    assert r.status_code == 200
    body = r.json()
    assert "categories" in body
    assert "labels" in body
    assert "UNCATEGORIZED" in body["categories"]
    assert body["labels"].get("UNCATEGORIZED") == "Uncategorized"
    assert body["labels"].get("__DELETED__") == "Deleted"


def test_transactions_empty_month(client):
    r = client.get("/api/transactions", params={"year": 2024, "month": 6})
    assert r.status_code == 200
    data = r.json()
    assert data["buckets"] == []
    assert data["month_total"] == 0.0
    assert data["total_inflow"] == 0.0
    assert data["total_outflow"] == 0.0
    assert data["opening_balance"] is None
    assert data["closing_balance"] is None


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
    session = db_module.SessionLocal()
    try:
        upload = StatementUpload(filename="seed.pdf")
        session.add(upload)
        session.flush()
        fp = line_fingerprint_digest_from_stored(date(2024, 6, 10), -4.0, "cafe")
        row = StoredTransaction(
            upload_id=upload.id,
            line_fingerprint=fp,
            posted_date=date(2024, 6, 10),
            description="cafe",
            merchant_key=normalize_description("cafe"),
            amount=-4.0,
            category="UNCATEGORIZED",
        )
        session.add(row)
        session.commit()
    finally:
        session.close()

    r = client.patch(
        f"/api/transactions/{fp}/category",
        json={"category": "FOOD_AND_DINING"},
    )
    assert r.status_code == 200

    listed = client.get("/api/transactions", params={"year": 2024, "month": 6})
    assert listed.status_code == 200
    buckets = listed.json()["buckets"]
    assert any(b["name"] == "FOOD_AND_DINING" for b in buckets)


def test_soft_delete_and_restore(client):
    session = db_module.SessionLocal()
    try:
        upload = StatementUpload(filename="seed.pdf")
        session.add(upload)
        session.flush()
        fp = line_fingerprint_digest_from_stored(date(2024, 6, 10), -4.0, "cafe")
        row = StoredTransaction(
            upload_id=upload.id,
            line_fingerprint=fp,
            posted_date=date(2024, 6, 10),
            description="cafe",
            merchant_key=normalize_description("cafe"),
            amount=-4.0,
            category="UNCATEGORIZED",
        )
        session.add(row)
        session.commit()
    finally:
        session.close()

    r = client.delete(f"/api/transactions/{fp}")
    assert r.status_code == 200

    listed = client.get("/api/transactions", params={"year": 2024, "month": 6})
    assert listed.status_code == 200
    data = listed.json()
    assert data["month_total"] == 0.0
    del_bucket = next((b for b in data["buckets"] if b["name"] == "__DELETED__"), None)
    assert del_bucket is not None
    assert len(del_bucket["transactions"]) == 1

    r2 = client.post(f"/api/transactions/{fp}/restore")
    assert r2.status_code == 200

    listed2 = client.get("/api/transactions", params={"year": 2024, "month": 6})
    data2 = listed2.json()
    assert not any(b["name"] == "__DELETED__" for b in data2["buckets"])
    assert data2["month_total"] == -4.0


def test_patch_category_rejects_deleted(client):
    session = db_module.SessionLocal()
    try:
        upload = StatementUpload(filename="del.pdf")
        session.add(upload)
        session.flush()
        fp = line_fingerprint_digest_from_stored(date(2024, 7, 1), -10.0, "x")
        row = StoredTransaction(
            upload_id=upload.id,
            line_fingerprint=fp,
            posted_date=date(2024, 7, 1),
            description="x",
            merchant_key=normalize_description("x"),
            amount=-10.0,
            category="UNCATEGORIZED",
            deleted_at=datetime(2024, 7, 2, 12, 0, 0),
        )
        session.add(row)
        session.commit()
    finally:
        session.close()

    r = client.patch(
        f"/api/transactions/{fp}/category",
        json={"category": "FOOD_AND_DINING"},
    )
    assert r.status_code == 400
