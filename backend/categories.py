"""Budget bucket keys and display labels for categorization and monthly budgets."""

from __future__ import annotations

# Ordered for UI: spending buckets first, then inflow, then catch-all.
EXPENSE_CATEGORIES: tuple[str, ...] = (
    "HOUSING_AND_RENT",
    "UTILITY_BILLS",
    "FOOD_AND_DINING",
    "FOOD_ORDERED",
    "TRANSPORTATION",
    "MEDICAL_BILLS",
    "SHOPPING",
    "GROCERIES",
    "INFLOW",
    "UNCATEGORIZED",
)

# API key -> human-readable name
BUCKET_LABELS: dict[str, str] = {
    "HOUSING_AND_RENT": "Housing and rent",
    "UTILITY_BILLS": "Utility Bills",
    "FOOD_AND_DINING": "Food and Dining",
    "FOOD_ORDERED": "Food Ordered",
    "TRANSPORTATION": "Transportation",
    "MEDICAL_BILLS": "Medical Bills",
    "SHOPPING": "Shopping",
    "GROCERIES": "Groceries",
    "INFLOW": "InFlow",
    "UNCATEGORIZED": "Uncategorized",
}

# Keys that represent spending (outflows); used for summaries / charts
SPENDING_BUCKET_KEYS: tuple[str, ...] = (
    "HOUSING_AND_RENT",
    "UTILITY_BILLS",
    "FOOD_AND_DINING",
    "FOOD_ORDERED",
    "TRANSPORTATION",
    "MEDICAL_BILLS",
    "SHOPPING",
    "GROCERIES",
    "UNCATEGORIZED",
)
