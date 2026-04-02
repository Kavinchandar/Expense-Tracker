"""
ICICI Bank 'Statement of Transactions' (savings) PDFs.

Extracted text interleaves multi-line UPI remarks with summary lines::

    UPI/SWIGGY/upiswiggy@icic/Payment fo/ICICI
    1 01.03.2026 284.00 732671.54
    Bank/109285776653/ICI32dc330833934f5d997e1b
    36665931fe/
    UPI/Licious/Licious@icici/UPI Collec/ICICI
    2 01.03.2026 234.00 732437.54
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
    if re.fullmatch(r"\d{1,3}", s):
        return True
    return False


def _parse_icici_date(d: str, m: str, y: str) -> date:
    return date(int(y), int(m), int(d))


def _money(s: str) -> float:
    return float(s.replace(",", ""))


def _norm(parts: list[str]) -> str:
    return " ".join(p.strip() for p in parts if p.strip())


def parse_icici_savings_statement_text(text: str) -> list[dict[str, Any]]:
    """
    Parse concatenated PDF text from an ICICI savings transaction statement.

    Withdrawals (balance drops) are negative amounts; deposits are positive.
    """
    pending_pre: list[str] = []
    pending_post: list[str] = []
    anchors: list[tuple[int, date, float, float]] = []
    descriptions: list[str] = []
    seen_anchor = False

    def flush_post_to_last() -> None:
        if descriptions and pending_post:
            extra = _norm(pending_post)
            if extra:
                descriptions[-1] = (descriptions[-1] + " " + extra).strip()
            pending_post.clear()

    for raw in text.splitlines():
        line = raw.strip()
        if _is_noise_line(line):
            continue

        m = _ICICI_ANCHOR.match(line)
        if m:
            seen_anchor = True
            flush_post_to_last()
            desc = _norm(pending_pre)
            pending_pre = []
            if len(desc) < 2:
                desc = f"Transaction {m.group(1)}"
            descriptions.append(desc)
            anchors.append(
                (
                    int(m.group(1)),
                    _parse_icici_date(m.group(2), m.group(3), m.group(4)),
                    _money(m.group(5)),
                    _money(m.group(6)),
                )
            )
            continue

        if not seen_anchor:
            if line.upper().startswith("UPI/"):
                pending_pre.append(line)
            continue

        if line.upper().startswith("UPI/"):
            flush_post_to_last()
            pending_pre.append(line)
        else:
            pending_post.append(line)

    flush_post_to_last()

    if not anchors or len(descriptions) != len(anchors):
        return []

    rows: list[dict[str, Any]] = []
    prev_bal: float | None = None

    for i, ((_sno, d, mid, bal), desc) in enumerate(zip(anchors, descriptions)):
        if i == 0:
            if len(anchors) >= 2:
                b0, b1, m1 = anchors[0][3], anchors[1][3], anchors[1][2]
                if abs((b0 - m1) - b1) < 0.02:
                    signed = -mid
                elif abs((b0 + mid) - b1) < 0.02:
                    signed = mid
                elif abs((b0 + mid - m1) - b1) < 0.02:
                    signed = mid
                else:
                    signed = -mid
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
