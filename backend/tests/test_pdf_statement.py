from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from services import pdf_statement


def test_extract_transaction_lines_mocked_pdf():
    fake_page = MagicMock()
    fake_page.extract_text.return_value = (
        "15/01/2024  COFFEE SHOP DOWNTOWN  12.50\n"
        "16/01/2024  METRO FARE  (3.00)\n"
    )
    fake_pdf = MagicMock()
    fake_pdf.__enter__.return_value = fake_pdf
    fake_pdf.__exit__.return_value = None
    fake_pdf.pages = [fake_page]

    with patch("services.pdf_statement.pdfplumber.open", return_value=fake_pdf):
        rows = pdf_statement.extract_transaction_lines_from_pdf(b"%PDF-1.4 dummy")

    assert len(rows) == 2
    assert rows[0]["date"] == date(2024, 1, 15)
    assert "COFFEE" in rows[0]["description"]
    assert rows[0]["amount"] == pytest.approx(12.50)
    assert rows[1]["amount"] == pytest.approx(-3.0)


def test_parse_amount_parentheses():
    assert pdf_statement._parse_amount("(1,234.56)") == pytest.approx(-1234.56)
    assert pdf_statement._parse_amount("10.00") == pytest.approx(10.0)
