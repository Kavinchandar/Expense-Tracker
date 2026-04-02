from __future__ import annotations

import pytest

from services.buckets import group_by_bucket, month_date_range
from services.exceptions import ValidationError


def test_month_date_range_january():
    start, end = month_date_range(2024, 1)
    assert start.isoformat() == "2024-01-01"
    assert end.isoformat() == "2024-01-31"


def test_month_date_range_invalid():
    with pytest.raises(ValidationError, match="month must be 1-12"):
        month_date_range(2024, 0)


def test_group_by_bucket_orders_and_totals():
    rows = [
        {
            "transaction_id": "a",
            "date": "2024-06-01",
            "name": "x",
            "amount": 10.0,
            "merchant_name": None,
            "primary_category": "FOOD_AND_DINING",
            "detailed_category": None,
            "pending": False,
        },
        {
            "transaction_id": "b",
            "date": "2024-06-02",
            "name": "y",
            "amount": -30.0,
            "merchant_name": None,
            "primary_category": "TRANSPORTATION",
            "detailed_category": None,
            "pending": False,
        },
    ]
    buckets, month_total = group_by_bucket(rows)
    assert month_total == pytest.approx(-20.0)
    names = [b["name"] for b in buckets]
    assert names[0] == "TRANSPORTATION"
    assert names[1] == "FOOD_AND_DINING"
