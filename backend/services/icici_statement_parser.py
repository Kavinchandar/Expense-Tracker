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

from services.statement_parse_utils import finalize_parsed_rows

# Serial  Date(DD.MM.YYYY)  amount  running_balance
_ICICI_ANCHOR = re.compile(
    r"^(\d+)\s+(\d{2})\.(\d{2})\.(\d{4})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$"
)

# PDF sometimes concatenates two serial rows into one line; split before each new serial+date.
_SERIAL_DATE_START = re.compile(r"\d{1,4}\s+\d{2}\.\d{2}\.\d{4}")

_NOISE_SUBSTRINGS = (
    "www.icici",
    "dial your bank",
    "never share your otp",
    "please call from your registered",
    "statement of transactions in saving account",
    "statement of transactions in saving account no.",
    "icici bank limited",
    "your base branch:",
    "transaction withdrawal deposit balance",
    "s no. cheque number transaction remarks",
    "date amount (inr)",
    "amount (inr) amount (inr) (inr)",
)


def _split_glued_serial_rows(line: str) -> list[str]:
    """When extract_text merges two statement rows into one line, split into separate rows."""
    s = line.strip()
    if not s:
        return []
    matches = list(_SERIAL_DATE_START.finditer(s))
    if len(matches) <= 1:
        return [s]
    out: list[str] = []
    for i, m in enumerate(matches):
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(s)
        chunk = s[start:end].strip()
        if chunk:
            out.append(chunk)
    return out


def _try_loose_icici_anchor(line: str) -> dict[str, Any] | None:
    """
    Rows like ``118 13.04.2026 TRF TO FD no. … 300000.00 443056.50`` — narrative between
    date and amounts — do not match the strict anchor regex; parse by taking the last
    two decimals as txn amount and balance.
    """
    s = line.strip()
    if not s or not _SERIAL_DATE_START.match(s):
        return None
    nums = list(re.finditer(r"[\d,]+\.\d{2}", s))
    if len(nums) < 2:
        return None
    mid_tok = nums[-2].group()
    bal_tok = nums[-1].group()
    head = s[: nums[-2].start()].strip()
    m = re.match(
        r"^(\d{1,4})\s+(\d{2})\.(\d{2})\.(\d{4})\s*(.*)$",
        head,
        flags=re.DOTALL,
    )
    if not m:
        return None
    remark = (m.group(5) or "").strip()
    return {
        "serial": int(m.group(1)),
        "date": _parse_icici_date(m.group(2), m.group(3), m.group(4)),
        "mid": _money(mid_tok),
        "bal": _money(bal_tok),
        "remark": remark,
    }


def _line_has_icici_anchor(line: str) -> bool:
    s = line.strip()
    if _ICICI_ANCHOR.match(s):
        return True
    return _try_loose_icici_anchor(s) is not None


def looks_like_icici_savings_statement(text: str) -> bool:
    if "icici" not in text.lower():
        return False
    low = text.lower()
    if "statement of transactions" not in low and "saving account" not in low:
        return False
    hits = 0
    for line in text.splitlines():
        for seg in _split_glued_serial_rows(line.strip()):
            if _line_has_icici_anchor(seg):
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


# Lines merged onto the *previous* transaction (ICICI tails / refs). Anything else is
# treated as the start of the *next* row's narrative — e.g. FD / NEFT text must not
# be glued to a prior UPI line.
_CONTINUATION_LINE = re.compile(
    r"(?is)^("
    r"bank/|"  # Bank/109.../ICI...
    r"www\.|"
    r"https?://|"
    r"ref/?\s*\d|"
    r"uti\b|rrn\b|"
    r"[a-f0-9]{8,}(?:/|$)"  # hex-ish crumbs like 36665931fe/
    r")"
)


def _is_continuation_tail_line(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    if len(s) <= 36 and re.match(r"^[\w/.-]+$", s):
        return True
    return bool(_CONTINUATION_LINE.match(s))


def _partition_pending_post_lines(
    lines: list[str],
) -> tuple[list[str], list[str]]:
    """Split lines that belong on the previous txn (tails) vs the next txn (heads)."""
    i = 0
    while i < len(lines) and _is_continuation_tail_line(lines[i]):
        i += 1
    return lines[:i], lines[i:]


def _desc_and_remainder_from_pending_pre(
    pending_pre: list[str], serial: str
) -> tuple[str, list[str]]:
    """
    Build the description for the next anchor line and what to keep for later rows.

    - One ``UPI/...`` line per consumption when it leads the queue (typical P2P).
    - Consecutive **non-UPI** lines at the front form one block (e.g. FD / sweep text).
    """
    if not pending_pre:
        return (f"Transaction {serial}", [])
    # Consecutive non-UPI narrative (FD booking, internal transfer text, …)
    if not pending_pre[0].upper().startswith("UPI/"):
        block: list[str] = []
        i = 0
        while i < len(pending_pre) and not pending_pre[i].upper().startswith("UPI/"):
            block.append(pending_pre[i])
            i += 1
        desc = _norm(block).strip()
        if len(desc) < 2:
            desc = f"Transaction {serial}"
        return (desc, pending_pre[i:])
    first = pending_pre[0].strip()
    return (first, pending_pre[1:])


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

    def flush_pending_post() -> None:
        """Attach only continuation tails to the previous txn; heads start the next row."""
        if not pending_post:
            return
        cont, heads = _partition_pending_post_lines(pending_post)
        pending_post.clear()
        if descriptions and cont:
            extra = _norm(cont).strip()
            if extra:
                descriptions[-1] = (descriptions[-1] + " " + extra).strip()
        if heads:
            pending_pre[:] = heads + pending_pre

    for raw in text.splitlines():
        for line in _split_glued_serial_rows(raw.strip()):
            if _is_noise_line(line):
                continue

            m = _ICICI_ANCHOR.match(line)
            if m:
                seen_anchor = True
                flush_pending_post()
                desc, pending_pre = _desc_and_remainder_from_pending_pre(
                    pending_pre, m.group(1)
                )
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

            loose = _try_loose_icici_anchor(line)
            if loose:
                seen_anchor = True
                flush_pending_post()
                # Narrative is on the anchor line (FD / TRF / NEFT); do not prepend UPI crumbs.
                pending_pre.clear()
                desc = (
                    loose["remark"][:1024]
                    if loose["remark"]
                    else f"Transaction {loose['serial']}"
                )
                descriptions.append(desc.strip())
                anchors.append(
                    (
                        loose["serial"],
                        loose["date"],
                        loose["mid"],
                        loose["bal"],
                    )
                )
                continue

            if not seen_anchor:
                if line.upper().startswith("UPI/"):
                    pending_pre.append(line)
                else:
                    pending_post.append(line)
                continue

            if line.upper().startswith("UPI/"):
                flush_pending_post()
                pending_pre.append(line)
            else:
                pending_post.append(line)

    flush_pending_post()

    if pending_pre and descriptions:
        descriptions[-1] = (descriptions[-1] + " " + _norm(pending_pre)).strip()

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
        # Stable dedupe id: statement posting line (serial + date + amount column + balance).
        transaction_id = f"icici:{d.isoformat()}|s{_sno}|m{mid:.2f}|b{bal:.2f}"
        rows.append(
            {
                "date": d,
                "description": desc[:1024],
                "amount": round(signed, 2),
                "balance_after": round(bal, 2),
                "transaction_id": transaction_id,
            }
        )

    return finalize_parsed_rows(rows)


def extract_icici_rows_from_pdf_text(full_text: str) -> list[dict[str, Any]]:
    if not looks_like_icici_savings_statement(full_text):
        return []
    return parse_icici_savings_statement_text(full_text)
