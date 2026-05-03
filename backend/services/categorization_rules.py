"""Ordered rule list for auto-categorizing statement lines. Extend by appending tuples."""

from __future__ import annotations

import re
from typing import Literal

from categories import PATCH_CATEGORY_VALUES

RuleKind = Literal["substr", "regex", "inflow_if_credit"]

# (kind, pattern, category) — first match wins.
# - substr: case-insensitive substring on normalized description
# - regex: regex on normalized description (pattern as string)
# - inflow_if_credit: regex on normalized description, only if amount > 0 → INFLOW
ORDERED_RULES: list[tuple[RuleKind, str, str]] = [
    ("inflow_if_credit", r"(salary|payroll|credit\s*salary|reimbursement|refund\s*from)", "INFLOW"),
    ("substr", "interest credit", "INFLOW"),
    ("substr", "dividend", "INFLOW"),
    ("substr", "swiggy", "FOOD_ORDERED"),
    ("substr", "zomato", "FOOD_ORDERED"),
    ("substr", "uber eats", "FOOD_ORDERED"),
    ("substr", "dominos", "FOOD_ORDERED"),
    ("substr", "mcdonald", "FOOD_ORDERED"),
    ("substr", "starbucks", "COFFEE"),
    ("substr", "cafe ", "COFFEE"),
    ("substr", "coffee", "COFFEE"),
    ("substr", "bigbasket", "GROCERIES"),
    ("substr", "blinkit", "GROCERIES"),
    ("substr", "dunzo", "GROCERIES"),
    ("substr", "grofers", "GROCERIES"),
    ("substr", "uber", "TRANSPORTATION"),
    ("substr", "ola", "TRANSPORTATION"),
    ("substr", "rapido", "TRANSPORTATION"),
    ("substr", "metro", "TRANSPORTATION"),
    ("substr", "fuel", "TRANSPORTATION"),
    ("substr", "petrol", "TRANSPORTATION"),
    ("substr", "irctc", "TRAVEL"),
    ("substr", "makemytrip", "TRAVEL"),
    ("substr", "booking.com", "TRAVEL"),
    ("substr", "goibibo", "TRAVEL"),
    ("substr", "cleartrip", "TRAVEL"),
    ("substr", "air india", "TRAVEL"),
    ("substr", "indigo", "TRAVEL"),
    ("substr", "netflix", "SUBSCRIPTIONS"),
    ("substr", "spotify", "SUBSCRIPTIONS"),
    ("substr", "youtube", "SUBSCRIPTIONS"),
    ("substr", "amazon prime", "SUBSCRIPTIONS"),
    ("substr", "hotstar", "SUBSCRIPTIONS"),
    ("substr", "electricity", "UTILITY_BILLS"),
    ("substr", "water bill", "UTILITY_BILLS"),
    ("substr", "gas bill", "UTILITY_BILLS"),
    ("substr", "broadband", "UTILITY_BILLS"),
    ("substr", "jio", "UTILITY_BILLS"),
    ("substr", "airtel", "UTILITY_BILLS"),
    ("substr", "rent", "HOUSING_AND_RENT"),
    ("substr", "maintenance", "HOUSING_AND_RENT"),
    ("substr", "hospital", "MEDICAL_BILLS"),
    ("substr", "pharmacy", "MEDICAL_BILLS"),
    ("substr", "apollo", "MEDICAL_BILLS"),
    ("substr", "amazon", "SHOPPING"),
    ("substr", "flipkart", "SHOPPING"),
    ("substr", "myntra", "SHOPPING"),
    ("substr", "movie", "ACTIVITIES"),
    ("substr", "bookmyshow", "ACTIVITIES"),
]


def _validate_category(cat: str) -> bool:
    return cat in PATCH_CATEGORY_VALUES


def match_rules(normalized_description: str, amount: float) -> str | None:
    """Return category if a rule matches, else None."""
    d = normalized_description
    for kind, pattern, cat in ORDERED_RULES:
        if not _validate_category(cat):
            continue
        if kind == "substr":
            if pattern in d:
                return cat
        elif kind == "regex":
            if re.search(pattern, d, re.IGNORECASE):
                return cat
        elif kind == "inflow_if_credit":
            if amount > 0 and re.search(pattern, d, re.IGNORECASE):
                return cat
    return None
