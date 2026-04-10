from __future__ import annotations


def test_budgets_shared_across_months(client):
    r = client.put(
        "/api/budgets",
        params={"year": 2026, "month": 1},
        json={"budgets": {"HOUSING_AND_RENT": 26000}},
    )
    assert r.status_code == 200
    assert r.json()["budgets"]["HOUSING_AND_RENT"] == 26000.0
    r2 = client.get("/api/budgets", params={"year": 2026, "month": 6})
    assert r2.status_code == 200
    assert r2.json()["budgets"]["HOUSING_AND_RENT"] == 26000.0
