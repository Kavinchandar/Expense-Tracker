"""Stable fingerprints for deduplicating bank lines across uploads."""

from __future__ import annotations

import hashlib
from datetime import date
from typing import Any

# Parsed rows should set ``transaction_id`` to a bank-stable line key (ICICI anchor
# tuple, or a hash of the raw extracted line). The line fingerprint is **only** that
# id’s SHA-256 hex so description display/simplification never changes dedupe.

def normalize_description(text: str) -> str:
    return " ".join(text.split()).lower()[:512]


def fingerprint_from_parsed(row: dict[str, Any]) -> tuple[str, float, str]:
    d: date = row["date"]
    amt = round(float(row["amount"]), 2)
    desc = normalize_description(str(row.get("description", "")))
    return (d.isoformat(), amt, desc)


def fingerprint_from_stored(posted_date: date, amount: float, description: str) -> tuple[str, float, str]:
    return (
        posted_date.isoformat(),
        round(float(amount), 2),
        normalize_description(description),
    )


def _digest_from_fingerprint(fp: tuple[str, float, str]) -> str:
    d, amt, desc = fp
    raw = f"{d}|{amt:.2f}|{desc}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _digest_from_transaction_id(transaction_id: str) -> str:
    return hashlib.sha256(transaction_id.strip().encode("utf-8")).hexdigest()


def line_fingerprint_digest_from_parsed(row: dict[str, Any]) -> str:
    tid = row.get("transaction_id")
    if isinstance(tid, str) and tid.strip():
        return _digest_from_transaction_id(tid)
    return _digest_from_fingerprint(fingerprint_from_parsed(row))


def line_fingerprint_digest_from_stored(
    posted_date: date, amount: float, description: str
) -> str:
    return _digest_from_fingerprint(
        fingerprint_from_stored(posted_date, amount, description)
    )
