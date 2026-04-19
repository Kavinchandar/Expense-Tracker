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
    "SURPLUS",
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
    "SURPLUS": "Surplus",
    "INFLOW": "InFlow",
    "UNCATEGORIZED": "Uncategorized",
}

# Expense-bucket debits treated as surplus allocation (savings/investments), not
# consumption outflow. They do not reduce reported total_outflow or monthly surplus.
SURPLUS_ALLOCATION_EXPENSE_KEYS: tuple[str, ...] = ("FDS", "INVESTMENTS", "SURPLUS")

# Debits in these categories also add their magnitude to total_inflow (user-tagged
# surplus moves). FDS/INVESTMENTS debits do not—only the Surplus bucket.
SURPLUS_DEBIT_COUNTS_TOWARD_INFLOWS_KEYS: tuple[str, ...] = ("SURPLUS",)

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
    "SURPLUS",
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
