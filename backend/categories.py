"""Budget bucket keys and display labels for categorization and monthly budgets.

Edit the two waterfalls below to change API order and defaults; derived values
recompute so PATCH validation, budgets, and charts stay consistent.
"""

from __future__ import annotations

# Reserved API bucket for soft-deleted rows (not assignable as a category).
DELETED_BUCKET_KEY = "__DELETED__"

# Single assignable surplus parent (stored on `StoredTransaction.category`).
SURPLUS_PRIMARY_KEY = "SURPLUS"

# ---------------------------------------------------------------------------
# Waterfall 1 — expense categories (includes Surplus parent, InFlow, Uncategorized)
# ---------------------------------------------------------------------------
EXPENSE_CATEGORY_KEYS: tuple[str, ...] = (
    "HOUSING_AND_RENT",
    "UTILITY_BILLS",
    "FOOD_AND_DINING",
    "FOOD_ORDERED",
    "COFFEE",
    "GROCERIES",
    "TRANSPORTATION",
    "TRAVEL",
    "INSURANCE",
    "MEDICAL_BILLS",
    "SHOPPING",
    "SUBSCRIPTIONS",
    "ACTIVITIES",
    SURPLUS_PRIMARY_KEY,
    "INFLOW",
    "UNCATEGORIZED",
)

# ---------------------------------------------------------------------------
# Waterfall 2 — surplus sub-buckets (stored on `surplus_subcategory`)
# ---------------------------------------------------------------------------
SURPLUS_CATEGORY_KEYS: tuple[str, ...] = (
    "FDS",
    "MUTUAL_FUNDS",
    "INVESTMENTS",
    "LEFTOVER",
)

# ---------------------------------------------------------------------------
# Derived — do not duplicate keys from the waterfalls above
# ---------------------------------------------------------------------------

_CONSUMPTION_SPEND_KEYS: tuple[str, ...] = tuple(
    k
    for k in EXPENSE_CATEGORY_KEYS
    if k not in (SURPLUS_PRIMARY_KEY, "INFLOW", "UNCATEGORIZED")
)

# Default monthly budget rows: consumption + inflow + uncategorized + surplus subs (no duplicate Surplus parent).
EXPENSE_CATEGORIES: tuple[str, ...] = (
    _CONSUMPTION_SPEND_KEYS + ("INFLOW", "UNCATEGORIZED") + SURPLUS_CATEGORY_KEYS
)

# Internal name used in normalize_* (alias of SURPLUS_CATEGORY_KEYS).
SURPLUS_SUBCATEGORY_KEYS: tuple[str, ...] = SURPLUS_CATEGORY_KEYS

# PATCH body may send a primary from EXPENSE_CATEGORY_KEYS or a surplus sub shortcut (FDS → SURPLUS+FDS).
PATCH_CATEGORY_VALUES: frozenset[str] = frozenset(EXPENSE_CATEGORY_KEYS) | frozenset(
    SURPLUS_CATEGORY_KEYS
)

# Full list for GET /categories `categories` (dedupe, expense order first).
API_ALL_ASSIGNABLE_KEYS: tuple[str, ...] = tuple(
    dict.fromkeys(list(EXPENSE_CATEGORY_KEYS) + list(SURPLUS_CATEGORY_KEYS))
)

SURPLUS_ALLOCATION_EXPENSE_KEYS: tuple[str, ...] = (SURPLUS_PRIMARY_KEY,)
SURPLUS_DEBIT_COUNTS_TOWARD_INFLOWS_KEYS: tuple[str, ...] = (SURPLUS_PRIMARY_KEY,)


def normalize_patch_category(
    category: str, surplus_subcategory: str | None = None
) -> tuple[str, str | None]:
    """Return (stored_category, surplus_subcategory or None)."""
    if category in SURPLUS_CATEGORY_KEYS:
        return (SURPLUS_PRIMARY_KEY, category)
    if category == SURPLUS_PRIMARY_KEY:
        raw = (surplus_subcategory or "").strip()
        if raw and raw not in SURPLUS_CATEGORY_KEYS:
            raise ValueError(f"Invalid surplus_subcategory: {raw}")
        return (SURPLUS_PRIMARY_KEY, raw or "LEFTOVER")
    return (category, None)


def normalize_insert_category(raw: str) -> tuple[str, str | None]:
    """Normalize classifier / rule output when inserting a new row."""
    if raw in SURPLUS_CATEGORY_KEYS:
        return (SURPLUS_PRIMARY_KEY, raw)
    return (raw, None)


# API key -> human-readable name
BUCKET_LABELS: dict[str, str] = {
    DELETED_BUCKET_KEY: "Deleted",
    "HOUSING_AND_RENT": "Housing and rent",
    "UTILITY_BILLS": "Utility Bills",
    "FOOD_AND_DINING": "Food and Dining",
    "FOOD_ORDERED": "Food Ordered",
    "COFFEE": "Coffee",
    "GROCERIES": "Groceries",
    "TRANSPORTATION": "Transportation",
    "TRAVEL": "Travel",
    "INVESTMENTS": "Investments",
    "FDS": "FDs",
    "MUTUAL_FUNDS": "Mutual funds",
    "INSURANCE": "Insurance",
    "MEDICAL_BILLS": "Medical Bills",
    "SHOPPING": "Shopping",
    "SUBSCRIPTIONS": "Subscriptions",
    "ACTIVITIES": "Activities",
    SURPLUS_PRIMARY_KEY: "Surplus",
    "LEFTOVER": "Left over",
    "INFLOW": "InFlow",
    "UNCATEGORIZED": "Uncategorized",
}

# Debits: category SURPLUS and sub LEFTOVER add magnitude to total_inflow.
SURPLUS_LEFTOVER_SUB = "LEFTOVER"

# Spending buckets for summaries / charts (excludes InFlow only).
SPENDING_BUCKET_KEYS: tuple[str, ...] = tuple(
    k for k in EXPENSE_CATEGORIES if k != "INFLOW"
)

# ---------------------------------------------------------------------------
# Long-term surplus envelope (savings targets) — separate from transaction subs
# ---------------------------------------------------------------------------
SURPLUS_CATEGORIES: tuple[str, ...] = (
    "TERM_INSURANCE",
    "HEALTH_INSURANCE",
    "CONTINGENCY_FUND",
    "INVESTMENTS",
)

SURPLUS_LABELS: dict[str, str] = {
    "TERM_INSURANCE": "Term insurance",
    "HEALTH_INSURANCE": "Health insurance",
    "CONTINGENCY_FUND": "Contingency fund",
    "INVESTMENTS": "Investments",
}
