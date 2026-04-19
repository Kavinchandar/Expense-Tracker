from __future__ import annotations

from datetime import date

from services.transaction_fingerprint import (
    fingerprint_from_parsed,
    line_fingerprint_digest_from_parsed,
)


def test_fingerprint_same_after_whitespace_normalization():
    a = {"date": date(2024, 6, 1), "description": "UPI  SWIGGY", "amount": -10.0}
    b = {"date": date(2024, 6, 1), "description": "upi swiggy", "amount": -10.0}
    assert fingerprint_from_parsed(a) == fingerprint_from_parsed(b)


def test_line_digest_uses_transaction_id_only():
    a = {
        "date": date(2024, 6, 1),
        "description": "OLD TEXT",
        "amount": -10.0,
        "transaction_id": "icici:2024-06-01|s1|m10.00|b100.00",
    }
    b = dict(a)
    b["description"] = "NEW TEXT"
    assert line_fingerprint_digest_from_parsed(a) == line_fingerprint_digest_from_parsed(b)
