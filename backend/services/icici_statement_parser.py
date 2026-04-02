"""
ICICI Bank 'Statement of Transactions' (savings) PDFs.

Text extraction yields multi-line UPI remarks followed by a summary line::

    UPI/SWIGGY/upiswiggy@icic/Payment fo/ICICI
    1 01.03.2026 284.00 732671.54
    Bank/109285776653/ICI32dc330833934f5d997e1b
"""

from __future__ import annotations

import re
from datetime import date
from typing import Any

# Serial  Date(DD.MM.YYYY)  amount  running_balance
_ICICI_ANCHOR = re.compile(
    r"^(\d+)\s+(\d{2})\.(\d{2})\.(\d{4})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$"
)

_NOISE_SUBSTRINGS = (
    "www.icici",
    "dial your bank",
    "never share your otp",
    "please call from your registered",
    "statement of transactions in saving account",
    "your base branch:",
    "transaction withdrawal deposit balance",
    "s no. cheque number transaction remarks",
    "date amount (inr)",
    "amount (inr) amount (inr) (inr)",
)


def looks_like_icici_savings_statement(text: str) -> bool:
    if "icici" not in text.lower():
        return False
    low = text.lower()
    if "statement of transactions" not in low and "saving account" not in low:
        return False
    hits = 0
    for line in text.splitlines():
        if _ICICI_ANCHOR.match(line.strip()):
            hits += 1
            if hits >= 2:
                return True
    return hits >= 1


def _is_noise_line(line: str) -> bool:
    s = line.strip()
    if not s:
        return True
    low = s.lower()
    for sub in _NOISE_SUBSTRINGS:
        if sub in low:
            return True
    # Page index lines (1–3 digits only)
    if re.fullmatch(r"\d{1,3}", s):
        return True
    return False


def _parse_icici_date(d: str, m: str, y: str) -> date:
    return date(int(y), int(m), int(d))


def _money(s: str) -> float:
    return float(s.replace(",", ""))


def _normalize_desc(parts: list[str]) -> str:
    return " ".join(p.strip() for p in parts if p.strip())


def parse_icici_savings_statement_text(text: str) -> list[dict[str, Any]]:
    """
    Parse concatenated PDF text from an ICICI savings transaction statement.

    Amount sign: withdrawals (balance drops) are negative; deposits positive.
    The first row assumes a withdrawal if it matches the usual pattern; otherwise
    balance deltas are used.
    """
    remark_lines: list[str] = []
    anchors: list[tuple[int, date, float, float, str]] = []

    for raw in text.splitlines():
        line = raw.strip()
        if _is_noise_line(line):
            continue

        m = _ICICI_ANCHOR.match(line)
        if m:
            sno = int(m.group(1))
            d = _parse_icici_date(m.group(2), m.group(3), m.group(4))
            mid = _money(m.group(5))
            bal = _money(m.group(6))
            desc = _normalize_desc(remark_lines)
            remark_lines = []
            if len(desc) < 3:
                desc = f"Transaction {sno}"
            anchors.append((sno, d, mid, bal, desc))
        else:
            remark_lines.append(line)

    if not anchors:
        return []

    rows: list[dict[str, Any]] = []
    prev_bal: float | None = None

    for i, (_sno, d, mid, bal, desc) in enumerate(anchors):
        if i == 0:
            if len(anchors) >= 2:
                b0, b1, m1 = anchors[0][3], anchors[1][3], anchors[1][2]
                if abs((b0 - m1) - b1) < 0.02:
                    signed = -mid
                elif abs((b0 + mid) - b1) < 0.02:
                    signed = mid
                else:
                    signed = bal - (bal + mid)
            else:
                signed = -mid
        else:
            assert prev_bal is not None
            signed = bal - prev_bal

        prev_bal = bal
        rows.append({"date": d, "description": desc[:1024], "amount": round(signed, 2)})

    rows.sort(key=lambda r: (r["date"], r["description"]))
    return rows


def extract_icici_rows_from_pdf_text(full_text: str) -> list[dict[str, Any]]:
    if not looks_like_icici_savings_statement(full_text):
        return []
    return parse_icici_savings_statement_text(full_text)
