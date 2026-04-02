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
    assert by_amt[-284.0]["description"].count("SWIGGY") >= 1
    assert "109285776653" in by_amt[-284.0]["description"]
    assert "36665931fe" in by_amt[-284.0]["description"]
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
