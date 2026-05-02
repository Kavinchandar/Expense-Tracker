from __future__ import annotations

from datetime import date

import pytest

from services.pf_service import (
    basic_inr_for_month,
    cumulative_pf_through_month,
    cumulative_pf_through_today,
    pf_contribution_for_month,
)


def test_basic_none_before_aug_2025():
    assert basic_inr_for_month(2025, 7) is None
    assert pf_contribution_for_month(2025, 7) is None


def test_basic_band1_aug_2025_through_mar_2026():
    assert basic_inr_for_month(2025, 8) == pytest.approx(110_417.001)
    assert basic_inr_for_month(2026, 3) == pytest.approx(110_417.001)
    asof = date(2026, 6, 1)
    assert pf_contribution_for_month(2025, 8, asof) == pytest.approx(0.12 * 110_417.001)


def test_basic_band2_from_apr_2026():
    assert basic_inr_for_month(2026, 4) == pytest.approx(118_887.00)
    asof = date(2026, 6, 1)
    assert pf_contribution_for_month(2026, 4, asof) == pytest.approx(0.12 * 118_887.00)
    assert basic_inr_for_month(2027, 1) == pytest.approx(118_887.00)


def test_cumulative_sum():
    # Aug 2025 + Sep 2025 (two months band 1)
    asof = date(2025, 10, 1)
    c = cumulative_pf_through_month(2025, 9, asof)
    one = 0.12 * 110_417.001
    assert c == pytest.approx(2 * one)


def test_cumulative_through_today_matches_month():
    t = date(2026, 5, 2)
    assert cumulative_pf_through_today(t) == cumulative_pf_through_month(2026, 5, t)


def test_pf_none_for_months_after_today():
    assert pf_contribution_for_month(2027, 1, date(2026, 5, 2)) is None


def test_cumulative_caps_at_today_month():
    t = date(2026, 5, 2)
    assert cumulative_pf_through_month(2030, 1, t) == cumulative_pf_through_month(2026, 5, t)
