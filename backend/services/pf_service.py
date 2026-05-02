from __future__ import annotations

"""Employee PF (12% of basic) tracked outside bank imports — deterministic schedule."""

from datetime import date

from dateutil.relativedelta import relativedelta

_PF_RATE = 0.12
_BASIC_1 = 110_417.001  # Aug 2025 – Mar 2026
_BASIC_2 = 118_887.00  # Apr 2026 onwards
_START_YEAR = 2025
_START_MONTH = 8


def _month_index(year: int, month: int) -> int:
    return year * 12 + month


def basic_inr_for_month(year: int, month: int) -> float | None:
    """Monthly basic for PF. ``None`` before tracking starts (Aug 2025)."""
    if _month_index(year, month) < _month_index(_START_YEAR, _START_MONTH):
        return None
    if year > 2026 or (year == 2026 and month >= 4):
        return _BASIC_2
    return _BASIC_1


def pf_contribution_for_month(
    year: int, month: int, today: date | None = None
) -> float | None:
    """Employee PF for that month (exact 12% of basic), or ``None`` if N/A.

    Months strictly after ``today``'s calendar month return ``None`` (no future PF).
    """
    t = today or date.today()
    if _month_index(year, month) > _month_index(t.year, t.month):
        return None
    b = basic_inr_for_month(year, month)
    if b is None:
        return None
    return _PF_RATE * b


def cumulative_pf_through_month(
    end_year: int, end_month: int, today: date | None = None
) -> float:
    """Sum of employee PF from Aug 2025 through the earlier of ``end_*`` and ``today``'s month."""
    t = today or date.today()
    if _month_index(end_year, end_month) > _month_index(t.year, t.month):
        end_year, end_month = t.year, t.month
    end = date(end_year, end_month, 1)
    start = date(_START_YEAR, _START_MONTH, 1)
    if end < start:
        return 0.0
    total = 0.0
    d = start
    while d <= end:
        p = pf_contribution_for_month(d.year, d.month, t)
        if p is not None:
            total += p
        d = d + relativedelta(months=1)
    return total


def cumulative_pf_through_today(today: date | None = None) -> float:
    """Cumulative employee PF through ``today``'s calendar month (default: server date)."""
    t = today or date.today()
    return cumulative_pf_through_month(t.year, t.month, t)
