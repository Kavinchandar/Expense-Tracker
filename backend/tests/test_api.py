from __future__ import annotations

from datetime import date, datetime

import pytest

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


def test_clear_month_transactions(client):
    session = db_module.SessionLocal()
    try:
        upload = StatementUpload(filename="clear-month.pdf")
        session.add(upload)
        session.flush()
        june_fp = line_fingerprint_digest_from_stored(date(2024, 6, 10), -4.0, "june cafe")
        july_fp = line_fingerprint_digest_from_stored(date(2024, 7, 10), -9.0, "july cafe")
        session.add(
            StoredTransaction(
                upload_id=upload.id,
                line_fingerprint=june_fp,
                posted_date=date(2024, 6, 10),
                description="june cafe",
                merchant_key=normalize_description("june cafe"),
                amount=-4.0,
                category="FOOD_AND_DINING",
            )
        )
        session.add(
            StoredTransaction(
                upload_id=upload.id,
                line_fingerprint=july_fp,
                posted_date=date(2024, 7, 10),
                description="july cafe",
                merchant_key=normalize_description("july cafe"),
                amount=-9.0,
                category="FOOD_AND_DINING",
            )
        )
        session.commit()
    finally:
        session.close()

    r = client.delete("/api/transactions/clear/month", params={"year": 2024, "month": 6})
    assert r.status_code == 200
    assert r.json()["deleted_count"] == 1

    june = client.get("/api/transactions", params={"year": 2024, "month": 6})
    july = client.get("/api/transactions", params={"year": 2024, "month": 7})
    assert june.status_code == 200
    assert july.status_code == 200
    assert june.json()["buckets"] == []
    assert july.json()["month_total"] == -9.0


def test_clear_all_transactions(client):
    session = db_module.SessionLocal()
    try:
        upload = StatementUpload(filename="clear-all.pdf")
        session.add(upload)
        session.flush()
        one_fp = line_fingerprint_digest_from_stored(date(2024, 6, 10), -4.0, "one")
        two_fp = line_fingerprint_digest_from_stored(date(2024, 7, 10), -9.0, "two")
        session.add(
            StoredTransaction(
                upload_id=upload.id,
                line_fingerprint=one_fp,
                posted_date=date(2024, 6, 10),
                description="one",
                merchant_key=normalize_description("one"),
                amount=-4.0,
                category="FOOD_AND_DINING",
            )
        )
        session.add(
            StoredTransaction(
                upload_id=upload.id,
                line_fingerprint=two_fp,
                posted_date=date(2024, 7, 10),
                description="two",
                merchant_key=normalize_description("two"),
                amount=-9.0,
                category="FOOD_AND_DINING",
            )
        )
        session.commit()
    finally:
        session.close()

    r = client.delete("/api/transactions/clear/all")
    assert r.status_code == 200
    assert r.json()["deleted_count"] == 2

    june = client.get("/api/transactions", params={"year": 2024, "month": 6})
    july = client.get("/api/transactions", params={"year": 2024, "month": 7})
    assert june.status_code == 200
    assert july.status_code == 200
    assert june.json()["buckets"] == []
    assert july.json()["buckets"] == []


def test_yearly_insights_in_out_pct_and_worth(client):
    session = db_module.SessionLocal()
    try:
        upload = StatementUpload(filename="year.pdf")
        session.add(upload)
        session.flush()
        fp1 = line_fingerprint_digest_from_stored(date(2024, 3, 5), 10_000.0, "salary")
        fp2 = line_fingerprint_digest_from_stored(date(2024, 3, 6), -3_000.0, "rent")
        session.add(
            StoredTransaction(
                upload_id=upload.id,
                line_fingerprint=fp1,
                posted_date=date(2024, 3, 5),
                description="salary",
                merchant_key=normalize_description("salary"),
                amount=10_000.0,
                balance_after=10_000.0,
                category="INFLOW",
            )
        )
        fp3 = line_fingerprint_digest_from_stored(date(2024, 3, 7), -5_000.0, "fd")
        session.add(
            StoredTransaction(
                upload_id=upload.id,
                line_fingerprint=fp2,
                posted_date=date(2024, 3, 6),
                description="rent",
                merchant_key=normalize_description("rent"),
                amount=-3_000.0,
                balance_after=7_000.0,
                category="HOUSING_AND_RENT",
            )
        )
        session.add(
            StoredTransaction(
                upload_id=upload.id,
                line_fingerprint=fp3,
                posted_date=date(2024, 3, 7),
                description="fd",
                merchant_key=normalize_description("fd"),
                amount=-5_000.0,
                balance_after=2_000.0,
                category="FDS",
            )
        )
        session.commit()
    finally:
        session.close()

    r = client.get("/api/insights/yearly", params={"year": 2024})
    assert r.status_code == 200
    d = r.json()
    assert d["year"] == 2024
    assert d["total_inflow"] == pytest.approx(10_000.0)
    assert d["total_outflow"] == pytest.approx(3_000.0)
    assert d["gross_movement"] == pytest.approx(13_000.0)
    assert d["net_flow"] == pytest.approx(7_000.0)
    assert d["inflow_pct_of_gross"] == pytest.approx(76.9, abs=0.05)
    assert d["outflow_pct_of_gross"] == pytest.approx(23.1, abs=0.05)
    assert d["total_worth"] == pytest.approx(2_000.0)
    assert d["fd_investment_debits_year"] == pytest.approx(5_000.0)

    r2 = client.get("/api/insights/yearly", params={"year": 1969})
    assert r2.status_code == 400
