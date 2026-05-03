/**
 * Canonical category waterfalls (order = UI / API order).
 * Keep in sync with `backend/categories.py`:
 *   EXPENSE_CATEGORY_KEYS, SURPLUS_CATEGORY_KEYS
 */

export const SURPLUS_PRIMARY_KEY = "SURPLUS" as const;

/** Expense-side list: consumption → Surplus parent → InFlow → Uncategorized (assignable / GET expense_categories). */
export const EXPENSE_CATEGORY_KEYS = [
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
] as const;

/** Stored on `surplus_subcategory` when `category === SURPLUS` (GET surplus_categories). */
export const SURPLUS_CATEGORY_KEYS = [
  "FDS",
  "MUTUAL_FUNDS",
  "INVESTMENTS",
  "LEFTOVER",
] as const;

export type ExpenseCategoryKey = (typeof EXPENSE_CATEGORY_KEYS)[number];
export type SurplusCategoryKey = (typeof SURPLUS_CATEGORY_KEYS)[number];

/** Default monthly budget row order (matches backend `EXPENSE_CATEGORIES`). */
export const BUDGET_ROW_KEYS_ORDER: readonly string[] = [
  ...EXPENSE_CATEGORY_KEYS.filter(
    (k) => k !== SURPLUS_PRIMARY_KEY && k !== "INFLOW" && k !== "UNCATEGORIZED"
  ),
  "INFLOW",
  "UNCATEGORIZED",
  ...SURPLUS_CATEGORY_KEYS,
];

/** Spending slice order for charts (matches backend `SPENDING_BUCKET_KEYS`: no InFlow). */
export const SPENDING_BUCKET_KEYS_ORDER: readonly string[] =
  BUDGET_ROW_KEYS_ORDER.filter((k) => k !== "INFLOW");
