from __future__ import annotations

from datetime import date

from services.statement_parse_utils import (
    dedupe_parsed_rows,
    finalize_parsed_rows,
    simplify_transaction_description,
)


def test_simplify_upi_short_label():
    raw = "UPI/GLEN S BAK/paytm.s14gpgb@/Payment fr/YES BANK P/790235984011/IBLf8054129018647af88d10d92"
    s = simplify_transaction_description(raw)
    assert s.startswith("UPI · GLEN S BAK")
    assert "790235984011" not in s
    assert len(s) < len(raw)


def test_simplify_two_upi_blocks():
    raw = "UPI/A Merchant/x@y UPI/B Other/z@y"
    s = simplify_transaction_description(raw)
    assert "UPI ·" in s
    assert "A Merchant" in s or "Merchant" in s
    assert "B Other" in s or "Other" in s


def test_dedupe_same_key():
    rows = [
        {"date": date(2026, 4, 13), "description": "a", "amount": -100.0},
        {"date": date(2026, 4, 13), "description": "a", "amount": -100.0},
    ]
    assert len(dedupe_parsed_rows(rows)) == 1


def test_finalize_sorts_and_simplifies():
    rows = [
        {"date": date(2026, 4, 13), "description": "UPI/Z/z@x/a/b", "amount": -50.0},
        {"date": date(2026, 4, 12), "description": "CASH", "amount": -10.0},
    ]
    out = finalize_parsed_rows(rows)
    assert out[0]["date"] == date(2026, 4, 12)
    assert out[0]["description"] == "CASH"
    assert out[1]["description"].startswith("UPI · Z")
