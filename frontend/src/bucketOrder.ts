/** Must match backend `categories.SPENDING_BUCKET_KEYS` + INFLOW order for UI. */

/** Soft-deleted transactions bucket (not a user-assignable category). */
export const DELETED_BUCKET_KEY = "__DELETED__";

/** Transaction categories that are surplus allocation (split on Surplus tab). */
export const SURPLUS_TX_KEYS = [
  "FDS",
  "MUTUAL_FUNDS",
  "INVESTMENTS",
  "SURPLUS",
] as const;

export type SurplusTxKey = (typeof SURPLUS_TX_KEYS)[number];

const SURPLUS_TX_SET = new Set<string>(SURPLUS_TX_KEYS);

/**
 * Single Overview bucket: sum of budgets/spend for all surplus allocation categories.
 * Not a backend category key.
 */
export const SURPLUS_OVERVIEW_AGG_KEY = "SURPLUS_OVERVIEW_AGG";

/** Order of surplus sections on the Surplus tab (matches user buckets). */
export const SURPLUS_SECTION_ORDER = [
  "FDS",
  "MUTUAL_FUNDS",
  "INVESTMENTS",
  "SURPLUS",
] as const;

export const SPENDING_CHART_ORDER = [
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
  "MUTUAL_FUNDS",
  "INSURANCE",
  "MEDICAL_BILLS",
  "SHOPPING",
  "SUBSCRIPTIONS",
  "ACTIVITIES",
  "SURPLUS",
  "UNCATEGORIZED",
] as const;

/**
 * Overview budget chart: one combined Surplus slice; surplus sub-categories only on Surplus tab.
 */
export const OVERVIEW_SPENDING_CHART_ORDER = [
  ...SPENDING_CHART_ORDER.filter((k) => !SURPLUS_TX_SET.has(k)),
  SURPLUS_OVERVIEW_AGG_KEY,
] as const;

/**
 * Overview budget list: all categories except surplus allocation keys, plus one
 * combined Surplus row (inserted before InFlow when present).
 */
export function buildOverviewCategoryList(categories: string[]): string[] {
  const filtered = categories.filter((c) => !SURPLUS_TX_SET.has(c));
  const inflowAt = filtered.indexOf("INFLOW");
  if (inflowAt >= 0) {
    const next = [...filtered];
    next.splice(inflowAt, 0, SURPLUS_OVERVIEW_AGG_KEY);
    return next;
  }
  return [...filtered, SURPLUS_OVERVIEW_AGG_KEY];
}

export const INFLOW_KEY = "INFLOW";
