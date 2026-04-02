"""Pure aggregation helpers for transaction rows (no I/O)."""

from __future__ import annotations

import calendar
from collections import defaultdict
from datetime import date
from typing import Any, Tuple

from services.exceptions import ValidationError


def month_date_range(year: int, month: int) -> Tuple[date, date]:
    if month < 1 or month > 12:
        raise ValidationError("month must be 1-12")
    _, last_day = calendar.monthrange(year, month)
    return date(year, month, 1), date(year, month, last_day)


def group_by_bucket(rows: list) -> Tuple[list, float]:
    """Group rows by primary_category; sort buckets by total descending (by absolute spend)."""
    buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    month_total = 0.0
    for row in rows:
        key = row["primary_category"]
        buckets[key].append(row)
        month_total += row["amount"]

    def bucket_total(items: list[dict[str, Any]]) -> float:
        return sum(x["amount"] for x in items)

    result: list[dict[str, Any]] = []
    for name, items in sorted(buckets.items(), key=lambda kv: -abs(bucket_total(kv[1]))):
        items.sort(key=lambda x: x["date"], reverse=True)
        result.append(
            {
                "name": name,
                "total": bucket_total(items),
                "transactions": items,
            }
        )
    return result, month_total
