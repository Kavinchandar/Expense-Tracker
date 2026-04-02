/** Must match backend `categories.SPENDING_BUCKET_KEYS` + INFLOW order for UI. */

export const SPENDING_CHART_ORDER = [
  "HOUSING_AND_RENT",
  "UTILITY_BILLS",
  "FOOD_AND_DINING",
  "FOOD_ORDERED",
  "TRANSPORTATION",
  "MEDICAL_BILLS",
  "SHOPPING",
  "GROCERIES",
  "UNCATEGORIZED",
] as const;

export const INFLOW_KEY = "INFLOW";
