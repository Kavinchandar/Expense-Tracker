"""Budget bucket keys and display labels for categorization and monthly budgets."""

from __future__ import annotations

# Reserved API bucket for soft-deleted rows (not assignable as a category).
DELETED_BUCKET_KEY = "__DELETED__"

# Ordered for UI: spending buckets first, then inflow, then catch-all.
EXPENSE_CATEGORIES: tuple[str, ...] = (
    "HOUSING_AND_RENT",
    "UTILITY_BILLS",
    "FOOD_AND_DINING",
    "FOOD_ORDERED",
    "COFFEE",
    "GROCERIES",
    "TRANSPORTATION",
    "TRAVEL",
    "INVESTMENTS",
    "FDS",
    "INSURANCE",
    "MEDICAL_BILLS",
    "SHOPPING",
    "SUBSCRIPTIONS",
    "ACTIVITIES",
    "INFLOW",
    "UNCATEGORIZED",
)

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
    "INSURANCE": "Insurance",
    "MEDICAL_BILLS": "Medical Bills",
    "SHOPPING": "Shopping",
    "SUBSCRIPTIONS": "Subscriptions",
    "ACTIVITIES": "Activities",
    "INFLOW": "InFlow",
    "UNCATEGORIZED": "Uncategorized",
}

# Keys that represent spending (outflows); used for summaries / charts
SPENDING_BUCKET_KEYS: tuple[str, ...] = (
    "HOUSING_AND_RENT",
    "UTILITY_BILLS",
    "FOOD_AND_DINING",
    "FOOD_ORDERED",
    "COFFEE",
    "GROCERIES",
    "TRANSPORTATION",
    "TRAVEL",
    "INVESTMENTS",
    "FDS",
    "INSURANCE",
    "MEDICAL_BILLS",
    "SHOPPING",
    "SUBSCRIPTIONS",
    "ACTIVITIES",
    "UNCATEGORIZED",
)

# Global surplus allocation targets (envelope order: term → health → contingency → investments).
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
