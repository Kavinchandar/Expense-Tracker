from __future__ import annotations

from datetime import date

import db as db_module
from data.models.statement import StatementUpload, StoredTransaction
from services.transaction_fingerprint import line_fingerprint_digest_from_stored, normalize_description


def test_surplus_budgets_global(client):
    r = client.put(
        "/api/surplus/budgets",
        params={"year": 2026, "month": 1},
        json={
            "budgets": {
                "TERM_INSURANCE": 5000.0,
                "HEALTH_INSURANCE": 0.0,
                "CONTINGENCY_FUND": 0.0,
                "INVESTMENTS": 0.0,
            }
        },
    )
    assert r.status_code == 200
    assert r.json()["budgets"]["TERM_INSURANCE"] == 5000.0
    r2 = client.get("/api/surplus/budgets", params={"year": 2026, "month": 6})
    assert r2.status_code == 200
    assert r2.json()["budgets"]["TERM_INSURANCE"] == 5000.0


def test_surplus_budgets_rejects_unknown_category(client):
    r = client.put(
        "/api/surplus/budgets",
        params={"year": 2026, "month": 1},
        json={"budgets": {"NOT_A_SURPLUS_CAT": 1.0}},
    )
    assert r.status_code == 400


def test_surplus_budgets_rejects_negative_amount(client):
    r = client.put(
        "/api/surplus/budgets",
        params={"year": 2026, "month": 1},
        json={
            "budgets": {
                "TERM_INSURANCE": -1.0,
                "HEALTH_INSURANCE": 0.0,
                "CONTINGENCY_FUND": 0.0,
                "INVESTMENTS": 0.0,
            }
        },
    )
    assert r.status_code == 400


def test_surplus_monthly_series_two_months(client):
    session = db_module.SessionLocal()
    try:
        upload = StatementUpload(filename="seed.pdf")
        session.add(upload)
        session.flush()

        def add_line(d: date, amount: float, desc: str) -> None:
            fp = line_fingerprint_digest_from_stored(d, amount, desc)
            session.add(
                StoredTransaction(
                    upload_id=upload.id,
                    line_fingerprint=fp,
                    posted_date=d,
                    description=desc,
                    merchant_key=normalize_description(desc),
                    amount=amount,
                    category="UNCATEGORIZED",
                )
            )

        add_line(date(2026, 3, 5), 10000.0, "salary")
        add_line(date(2026, 3, 20), -3000.0, "rent")
        add_line(date(2026, 4, 10), 500.0, "tiny in")
        add_line(date(2026, 4, 12), -8000.0, "big out")
        session.commit()
    finally:
        session.close()

    r = client.get(
        "/api/surplus/monthly",
        params={"end_year": 2026, "end_month": 4, "months": 2},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["months"] == 2
    assert body["end_year"] == 2026
    assert body["end_month"] == 4
    series = { (x["year"], x["month"]): x for x in body["series"] }
    assert series[(2026, 3)]["total_inflow"] == 10000.0
    assert series[(2026, 3)]["total_outflow"] == 3000.0
    assert series[(2026, 3)]["surplus"] == 7000.0
    assert series[(2026, 4)]["total_inflow"] == 500.0
    assert series[(2026, 4)]["total_outflow"] == 8000.0
    assert series[(2026, 4)]["surplus"] == 0.0


def test_surplus_monthly_fills_missing_month_with_zeros(client):
    r = client.get(
        "/api/surplus/monthly",
        params={"end_year": 2026, "end_month": 2, "months": 3},
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["series"]) == 3
    for row in body["series"]:
        assert row["total_inflow"] == 0.0
        assert row["total_outflow"] == 0.0
        assert row["surplus"] == 0.0
