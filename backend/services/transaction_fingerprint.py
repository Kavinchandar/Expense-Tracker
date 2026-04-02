"""Stable fingerprints for deduplicating bank lines across uploads."""

from __future__ import annotations

from datetime import date
from typing import Any


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
