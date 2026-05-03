/**
 * UI ordering for charts and overview. Canonical key lists live in
 * `categoryLists.ts` (keep aligned with `backend/categories.py`).
 */

import {
  SPENDING_BUCKET_KEYS_ORDER,
  SURPLUS_CATEGORY_KEYS,
  SURPLUS_PRIMARY_KEY,
} from "./categoryLists";

export {
  EXPENSE_CATEGORY_KEYS,
  SURPLUS_CATEGORY_KEYS,
  SURPLUS_PRIMARY_KEY,
} from "./categoryLists";

/** Soft-deleted transactions bucket (not a user-assignable category). */
export const DELETED_BUCKET_KEY = "__DELETED__";

/** Alias: transaction surplus subs (same order as `SURPLUS_CATEGORY_KEYS`). */
export const SURPLUS_TX_KEYS = SURPLUS_CATEGORY_KEYS;

export type SurplusTxKey = (typeof SURPLUS_CATEGORY_KEYS)[number];

const SURPLUS_SUB_SET = new Set<string>(SURPLUS_CATEGORY_KEYS);

/**
 * Overview-only rollup key for combined Surplus budget/spend (not a stored category).
 */
export const OVERVIEW_SURPLUS_KEY = "__OVERVIEW_SURPLUS__";

/** Default labels for surplus sub-buckets (Surplus tab; API may override). */
export const SURPLUS_TX_BUCKET_LABELS: Record<SurplusTxKey, string> = {
  FDS: "FDs",
  MUTUAL_FUNDS: "Mutual funds",
  INVESTMENTS: "Investments",
  LEFTOVER: "Left over",
};

/** Order of surplus buckets on the Surplus tab. */
export const SURPLUS_SECTION_ORDER = SURPLUS_CATEGORY_KEYS;

/** Spending keys for charts (matches backend `SPENDING_BUCKET_KEYS`). */
export const SPENDING_CHART_ORDER = SPENDING_BUCKET_KEYS_ORDER;

/**
 * Overview donut: consumption categories only, plus one Surplus slice (rollup).
 */
export const OVERVIEW_SPENDING_CHART_ORDER = [
  ...SPENDING_CHART_ORDER.filter((k) => !SURPLUS_SUB_SET.has(k)),
  OVERVIEW_SURPLUS_KEY,
] as const;

/**
 * Overview budget editor: drop surplus subs and parent `SURPLUS`, then one rollup row before InFlow.
 */
export function buildOverviewCategoryList(categories: string[]): string[] {
  const filtered = categories.filter(
    (c) => !SURPLUS_SUB_SET.has(c) && c !== SURPLUS_PRIMARY_KEY
  );
  const inflowAt = filtered.indexOf("INFLOW");
  if (inflowAt >= 0) {
    const next = [...filtered];
    next.splice(inflowAt, 0, OVERVIEW_SURPLUS_KEY);
    return next;
  }
  return [...filtered, OVERVIEW_SURPLUS_KEY];
}

export const INFLOW_KEY = "INFLOW";
