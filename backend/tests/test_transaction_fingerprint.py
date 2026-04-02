from __future__ import annotations

from datetime import date

from services.transaction_fingerprint import fingerprint_from_parsed


def test_fingerprint_same_after_whitespace_normalization():
    a = {"date": date(2024, 6, 1), "description": "UPI  SWIGGY", "amount": -10.0}
    b = {"date": date(2024, 6, 1), "description": "upi swiggy", "amount": -10.0}
    assert fingerprint_from_parsed(a) == fingerprint_from_parsed(b)
