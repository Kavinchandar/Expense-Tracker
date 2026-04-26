from __future__ import annotations

from datetime import date

from services.excel_statement import _extract_rows_from_grid, _to_float


def test_extract_rows_from_grid_amount_column():
    grid = [
        ["Date", "Description", "Amount", "Balance"],
        ["01/03/2026", "Coffee Shop", "-120.50", "1000.00"],
        ["02/03/2026", "Salary", "5000.00", "6000.00"],
    ]
    rows = _extract_rows_from_grid(grid, source_tag="test")
    assert len(rows) == 2
    assert rows[0]["date"] == date(2026, 3, 1)
    assert rows[0]["amount"] == -120.5
    assert rows[0]["balance_after"] == 1000.0
    assert rows[1]["amount"] == 5000.0


def test_extract_rows_from_grid_debit_credit_columns():
    grid = [
        ["Posting Date", "Narration", "Debit", "Credit", "Running Balance"],
        ["03-03-2026", "Groceries", "340.00", "", "5660.00"],
        ["04-03-2026", "Refund", "", "40.00", "5700.00"],
    ]
    rows = _extract_rows_from_grid(grid, source_tag="test")
    assert len(rows) == 2
    assert rows[0]["amount"] == -340.0
    assert rows[1]["amount"] == 40.0


def test_extract_rows_transaction_remarks_and_attached_cr_dr():
    grid = [
        ["Transaction Date", "Transaction Remarks", "Debit Amount", "Credit Amount"],
        ["05/03/2026", "ATM Withdrawal", "250.00DR", ""],
        ["06/03/2026", "NEFT Credit", "", "1000.00CR"],
    ]
    rows = _extract_rows_from_grid(grid, source_tag="test")
    assert len(rows) == 2
    assert rows[0]["description"] == "ATM Withdrawal"
    assert rows[0]["amount"] == -250.0
    assert rows[1]["amount"] == 1000.0


def test_extract_rows_without_description_header_uses_text_column():
    grid = [
        ["Txn Date", "Ref No", "Debit", "Credit", "Balance"],
        ["07/03/2026", "UPI/Alice", "350.00", "", "9650.00"],
        ["08/03/2026", "Salary", "", "5000.00", "14650.00"],
    ]
    rows = _extract_rows_from_grid(grid, source_tag="test")
    assert len(rows) == 2
    assert rows[0]["description"] == "UPI · Alice"
    assert rows[0]["amount"] == -350.0
    assert rows[1]["description"] == "Salary"
    assert rows[1]["amount"] == 5000.0


def test_to_float_handles_attached_dr_cr():
    assert _to_float("1,234.50DR") == -1234.5
    assert _to_float("2,500.00CR") == 2500.0
