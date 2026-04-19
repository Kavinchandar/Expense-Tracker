from __future__ import annotations

import pytest

from services.icici_statement_parser import (
    extract_icici_rows_from_pdf_text,
    looks_like_icici_savings_statement,
    parse_icici_savings_statement_text,
)


def test_looks_like_icici():
    sample = """
    Statement of Transactions in Saving Account no. 123 in INR
    ICICI BANK LIMITED
    UPI/SWIGGY/upiswiggy@icic/Payment fo/ICICI
    1 01.03.2026 284.00 732671.54
    Bank/109285776653/ICI32dc330833934f5d997e1b
    UPI/Other/merchant@icici/Pay/ICICI
    2 01.03.2026 234.00 732437.54
    """
    assert looks_like_icici_savings_statement(sample)


def test_parse_icici_glued_fd_rows_loose_anchor():
    """PDF may merge two serial rows into one line; FD rows have text between date and amounts."""
    text = """
    Statement of Transactions in Saving Account in INR for ICICI
    118 13.04.2026 TRF TO FD no. 007713075509 300000.00 443056.50 119 13.04.2026 TRF TO FD no. 007713075510 200000.00 243056.50 BANK
    123 13.04.2026 TRF TO FD no. 007713075517 100000.00 141727.50 BANK
    """
    rows = parse_icici_savings_statement_text(text)
    assert len(rows) == 3
    assert rows[0]["amount"] == pytest.approx(-300_000.0)
    assert rows[1]["amount"] == pytest.approx(-200_000.0)
    assert "007713075509" in rows[0]["description"]
    assert "007713075510" in rows[1]["description"]
    assert "007713075517" in rows[2]["description"]
    joined = " ".join(r["description"] for r in rows)
    assert joined.count("TRF TO FD") == 3


def test_parse_icici_fd_booking_not_glued_to_prior_upi():
    """FD / sweep lines belong on the debit row, not merged into the previous UPI-only row."""
    text = """
    Statement of Transactions in Saving Account in INR for ICICI
    UPI/GLEN S BAK/paytm/pay/ICICI
    UPI/Royal Mart/Q833@ybl/Pay/ICICI
    FD SWEEP BOOKING REF 556677
    1 13.04.2026 501101.00 898553.00
    Bank/109285776653/ref
    2 13.04.2026 100447.00 798106.00
    """
    rows = parse_icici_savings_statement_text(text)
    assert len(rows) == 2
    by_amt = {r["amount"]: r for r in rows}
    assert "FD SWEEP BOOKING" in by_amt[-501101.0]["description"]
    assert "GLEN" not in by_amt[-501101.0]["description"]
    d2 = by_amt[-100447.0]["description"]
    assert "GLEN" in d2 or "GLEN S BAK" in d2
    assert "Royal" in d2 or "Royal Mart" in d2


def test_parse_icici_merges_remarks_and_tail():
    text = """
    Statement of Transactions in Saving Account in INR for ICICI
    UPI/SWIGGY/upiswiggy@icic/Payment fo/ICICI
    1 01.03.2026 284.00 732671.54
    Bank/109285776653/ICI32dc330833934f5d997e1b
    36665931fe/
    UPI/Licious/Licious@icici/UPI Collec/ICICI
    2 01.03.2026 234.00 732437.54
    Bank/365020246284/ref/
    """
    rows = parse_icici_savings_statement_text(text)
    assert len(rows) == 2
    by_amt = {r["amount"]: r for r in rows}
    assert "SWIGGY" in by_amt[-284.0]["description"]
    assert "Licious" in by_amt[-234.0]["description"]
    assert by_amt[-284.0]["balance_after"] == 732671.54
    assert by_amt[-234.0]["balance_after"] == 732437.54


def test_parse_icici_deposit_via_balance_delta():
    text = """
    Statement of Transactions in Saving Account in INR ICICI
    UPI/A/p@x/Pay/ICICI
    1 04.03.2026 230.00 730232.54
    UPI/B/p@x/Pay/ICICI
    2 04.03.2026 2500.00 732732.54
    """
    rows = parse_icici_savings_statement_text(text)
    assert len(rows) == 2
    amounts = sorted(r["amount"] for r in rows)
    assert amounts[0] == -230.0
    assert amounts[1] == pytest.approx(2500.0)
    by_amt = {r["amount"]: r for r in rows}
    assert by_amt[-230.0]["balance_after"] == 730232.54
    assert by_amt[2500.0]["balance_after"] == 732732.54


def test_extract_wrapper_returns_empty_for_non_icici():
    assert extract_icici_rows_from_pdf_text("Some other bank\nno anchors here\n") == []
