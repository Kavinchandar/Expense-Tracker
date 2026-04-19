"""Extract likely transaction rows from bank/credit PDF statements (text-based PDFs)."""

from __future__ import annotations

import hashlib
import io
import re
from datetime import date
from typing import Any

import pdfplumber
from dateutil import parser as du_parser

from services.icici_statement_parser import extract_icici_rows_from_pdf_text
from services.statement_parse_utils import finalize_parsed_rows

# Lines that are usually headers / footers, not transactions
_SKIP_LINE = re.compile(
    r"^(date\s+desc|posting\s+date|transaction\s+date|balance|"
    r"opening\s+balance|closing\s+balance|statement\s+period|"
    r"page\s+\d+\s+of\s+\d+|page\s+\d+)\s*$",
    re.I,
)

AMOUNT_TOKEN = r"\(?[\d,]+\.\d{2}\)?|\-?[\d,]+\.\d{2}"

LINE_PATTERNS = [
    re.compile(
        rf"^\s*(\d{{1,2}}[/-]\d{{1,2}}[/-]\d{{2,4}})\s+(.+?)\s+({AMOUNT_TOKEN})\s*$",
        re.I,
    ),
    re.compile(
        rf"^\s*(\d{{4}}[/-]\d{{2}}[/-]\d{{2}})\s+(.+?)\s+({AMOUNT_TOKEN})\s*$",
    ),
    re.compile(
        rf"^\s*(\d{{1,2}}\s+[A-Za-z]{{3}}\s+\d{{2,4}})\s+(.+?)\s+({AMOUNT_TOKEN})\s*$",
        re.I,
    ),
]


def _parse_amount(raw: str) -> float:
    s = raw.strip()
    neg = s.startswith("(") and s.endswith(")")
    if neg:
        s = s[1:-1]
    s = s.replace(",", "").replace("$", "").replace("₹", "").replace("€", "").strip()
    if not s:
        raise ValueError("empty amount")
    val = float(s)
    return -abs(val) if neg else val


def _parse_date(raw: str) -> date:
    dt = du_parser.parse(raw.strip(), dayfirst=True, yearfirst=False)
    return dt.date()


def _skip_line(line: str) -> bool:
    s = line.strip()
    if len(s) < 14:
        return True
    if _SKIP_LINE.match(s):
        return True
    return False


def extract_transaction_lines_from_pdf(file_bytes: bytes) -> list[dict[str, Any]]:
    """
    Detects known bank layouts first (e.g. ICICI savings ``Statement of Transactions``),
    then falls back to generic ``DATE  DESCRIPTION  AMOUNT`` single-line rows.
    Scanned image PDFs need OCR first.
    """
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        full_text = "\n".join((p.extract_text() or "") for p in pdf.pages)

    icici_rows = extract_icici_rows_from_pdf_text(full_text)
    if icici_rows:
        return icici_rows

    rows: list[dict[str, Any]] = []
    seen: set[str] = set()

    for line in full_text.splitlines():
        if _skip_line(line):
            continue
        for pat in LINE_PATTERNS:
            m = pat.match(line.strip())
            if not m:
                continue
            try:
                d = _parse_date(m.group(1))
                desc = m.group(2).strip()
                amt = _parse_amount(m.group(3))
            except (ValueError, TypeError, du_parser.ParserError):
                continue
            if len(desc) < 2:
                continue
            key = f"{d.isoformat()}|{amt:.2f}|{desc[:240]}"
            if key in seen:
                continue
            seen.add(key)
            line_key = hashlib.sha256(
                f"{d.isoformat()}|{amt:.2f}|{desc}".encode("utf-8")
            ).hexdigest()
            rows.append(
                {
                    "date": d,
                    "description": desc,
                    "amount": amt,
                    "transaction_id": f"line:{line_key}",
                }
            )
            break

    return finalize_parsed_rows(rows)
