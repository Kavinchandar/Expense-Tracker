"""Normalize parsed statement rows: short, readable descriptions and stable uniqueness."""

from __future__ import annotations

import re
from typing import Any


def _simplify_one_narrative(s: str, *, max_length: int) -> str:
    s = " ".join(s.split()).strip()
    if not s:
        return "Transaction"
    # Strip trailing noise (very long gateway blobs only — keep 10–15 digit FD/bank refs)
    s = re.sub(r"\s+[A-Za-z]{1,4}\d{18,}[a-f0-9]*\s*$", "", s, flags=re.I)
    s = re.sub(r"\s+\b[a-f0-9]{20,}\b\s*$", "", s, flags=re.I)
    s = " ".join(s.split())

    if s.upper().startswith("UPI/"):
        rest = s[4:].strip()
        parts = [p.strip() for p in rest.split("/") if p.strip()]
        if not parts:
            return "UPI"
        label = parts[0]
        if len(parts) >= 2 and "@" in parts[1] and len(parts[1]) <= 48:
            out = f"UPI · {label} · {parts[1]}"
        else:
            out = f"UPI · {label}"
    else:
        out = s

    if len(out) > max_length:
        out = out[: max_length - 1].rsplit(" ", 1)[0] + "…"
    return out


def simplify_transaction_description(raw: str, *, max_length: int = 200) -> str:
    """
    One readable line per transaction: compact UPI (payee / handle), trimmed prose
    for transfers and FD text. Avoids multi-line PDF blobs in a single cell.
    """
    s = " ".join(str(raw).split()).strip()
    if not s:
        return "Transaction"

    # Two or more UPI blocks in one string (e.g. orphan merge) → separate labels.
    if s.upper().count("UPI/") >= 2:
        segments = [p.strip() for p in re.split(r"(?=UPI/)", s) if p.strip()]
        bits = [
            _simplify_one_narrative(seg, max_length=min(120, max_length)) for seg in segments
        ]
        joined = " · ".join(bits)
    else:
        joined = _simplify_one_narrative(s, max_length=max_length)

    if len(joined) > max_length:
        joined = joined[: max_length - 1].rsplit(" ", 1)[0] + "…"
    return joined[:1024]


def dedupe_parsed_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep first occurrence per transaction_id (preferred) or legacy description key."""
    seen: set[tuple[Any, ...]] = set()
    out: list[dict[str, Any]] = []
    for r in rows:
        tid = r.get("transaction_id")
        if isinstance(tid, str) and tid.strip():
            key = ("id", tid.strip())
        else:
            key = (
                "legacy",
                r["date"],
                round(float(r["amount"]), 2),
                r["description"],
            )
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


def finalize_parsed_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Apply simplified descriptions and dedupe; sort for stable output."""
    finalized: list[dict[str, Any]] = []
    for r in rows:
        row = dict(r)
        raw = str(row.get("description", "")).strip()
        # Preserve full bank narrative for the detail column; main description stays short.
        row["detail"] = (row.get("detail") or raw)[:2048]
        row["description"] = simplify_transaction_description(raw)
        finalized.append(row)
    finalized = dedupe_parsed_rows(finalized)
    finalized.sort(key=lambda x: (x["date"], x["description"]))
    return finalized
