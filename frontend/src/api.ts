import {
  OVERVIEW_SURPLUS_KEY,
  SURPLUS_PRIMARY_KEY,
  SURPLUS_TX_KEYS,
} from "./bucketOrder";

const API = "/api";

async function readHttpError(r: Response): Promise<string> {
  const text = await r.text();
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) {
      return j.detail
        .map((x) => (typeof x === "object" && x && "msg" in x ? String((x as { msg: string }).msg) : JSON.stringify(x)))
        .join("; ");
    }
  } catch {
    /* use raw text */
  }
  return text || r.statusText;
}

export type TransactionsPayload = {
  year: number;
  month: number;
  month_total: number;
  total_inflow: number;
  total_outflow: number;
  opening_balance: number | null;
  closing_balance: number | null;
  buckets: {
    name: string;
    total: number;
    transactions: {
      transaction_id: string;
      date: string;
      name: string;
      /** Bank / import narrative; read-only in the app; not used for dedupe. */
      detail?: string;
      amount: number;
      merchant_name: string | null;
      /** Effective bucket (surplus sub when stored as Surplus). */
      primary_category: string;
      stored_category?: string;
      surplus_subcategory?: string | null;
      detailed_category: string | null;
      pending: boolean;
      is_deleted?: boolean;
    }[];
  }[];
  display_timezone: string;
};

export async function getInsights(
  year: number,
  month: number
): Promise<{ insights: string }> {
  const q = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  const r = await fetch(`${API}/insights?${q}`);
  if (!r.ok) throw new Error(await readHttpError(r));
  return r.json();
}

export type YearlyInsightsPayload = {
  year: number;
  total_inflow: number;
  total_outflow: number;
  gross_movement: number;
  net_flow: number;
  inflow_pct_of_gross: number;
  outflow_pct_of_gross: number;
  total_worth: number | null;
  all_time_surplus: number;
  available_to_spend: number;
  fd_debits_all_time: number;
  mf_debits_all_time: number;
  /** Gross debits in FDS, Mutual funds, and Investments this calendar year (INR). */
  fd_investment_debits_year: number;
  /** Cumulative employee PF (12% of basic) through the current month. */
  pf_cumulative_all_time: number;
};

export async function getYearlyInsights(
  year: number
): Promise<YearlyInsightsPayload> {
  const q = new URLSearchParams({ year: String(year) });
  const r = await fetch(`${API}/insights/yearly?${q}`);
  if (!r.ok) throw new Error(await readHttpError(r));
  return r.json() as Promise<YearlyInsightsPayload>;
}

export type UsdInrPayload = {
  usd_to_inr: number;
  as_of_date: string;
};

/** Latest USD→INR (Frankfurter via backend; for display only). */
export async function getUsdInr(): Promise<UsdInrPayload> {
  const r = await fetch(`${API}/fx/usd-inr`);
  if (!r.ok) throw new Error(await readHttpError(r));
  return r.json() as Promise<UsdInrPayload>;
}

export async function getTransactions(
  year: number,
  month: number
): Promise<TransactionsPayload> {
  const q = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  const r = await fetch(`${API}/transactions?${q}`);
  if (!r.ok) throw new Error(await readHttpError(r));
  return r.json();
}

export type CategoriesPayload = {
  /** Full assignable set: expense categories then surplus subs (same order as backend). */
  categories: string[];
  expense_categories: string[];
  surplus_categories: string[];
  labels: Record<string, string>;
};

export async function getCategories(): Promise<CategoriesPayload> {
  const r = await fetch(`${API}/categories`);
  if (!r.ok) throw new Error(await readHttpError(r));
  return r.json() as Promise<CategoriesPayload>;
}

export async function getBudgets(
  year: number,
  month: number
): Promise<{ year: number; month: number; budgets: Record<string, number> }> {
  const q = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  const r = await fetch(`${API}/budgets?${q}`);
  if (!r.ok) throw new Error(await readHttpError(r));
  return r.json();
}

export async function saveBudgets(
  year: number,
  month: number,
  budgets: Record<string, number>
): Promise<{ year: number; month: number; budgets: Record<string, number> }> {
  const q = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  const r = await fetch(`${API}/budgets?${q}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ budgets }),
  });
  if (!r.ok) throw new Error(await readHttpError(r));
  return r.json();
}

/**
 * Expense buckets whose debits are surplus allocation (savings/investments), not
 * consumption outflow. Left over (SURPLUS) debits also add their magnitude to inflow.
 * Matches backend `SURPLUS_ALLOCATION_EXPENSE_KEYS` / `SURPLUS_DEBIT_COUNTS_TOWARD_INFLOWS_KEYS`.
 */
export const SURPLUS_ALLOCATION_TX_CATEGORIES = SURPLUS_TX_KEYS;

/** Surplus allocation buckets: hidden on Inflow & Outflow; manage on the Surplus tab. */
export const OVERVIEW_HIDDEN_TX_CATEGORIES = [
  ...SURPLUS_TX_KEYS,
  SURPLUS_PRIMARY_KEY,
] as const;

export { OVERVIEW_SURPLUS_KEY, SURPLUS_PRIMARY_KEY, SURPLUS_TX_KEYS };

/** Envelope order for surplus allocation (matches backend `SURPLUS_CATEGORIES`). */
export const SURPLUS_KEYS = [
  "TERM_INSURANCE",
  "HEALTH_INSURANCE",
  "CONTINGENCY_FUND",
  "INVESTMENTS",
] as const;

export type SurplusKey = (typeof SURPLUS_KEYS)[number];

export const SURPLUS_LABELS: Record<SurplusKey, string> = {
  TERM_INSURANCE: "Term insurance",
  HEALTH_INSURANCE: "Health insurance",
  CONTINGENCY_FUND: "Contingency fund",
  INVESTMENTS: "Investments",
};

export type SurplusMonthlyRow = {
  year: number;
  month: number;
  total_inflow: number;
  total_outflow: number;
  surplus: number;
  /** Employee PF for the month (INR), if tracking applies. */
  pf?: number | null;
};

export type SurplusMonthlySeriesPayload = {
  end_year: number;
  end_month: number;
  months: number;
  series: SurplusMonthlyRow[];
};

export async function getSurplusBudgets(
  year: number,
  month: number
): Promise<{ year: number; month: number; budgets: Record<string, number> }> {
  const q = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  const r = await fetch(`${API}/surplus/budgets?${q}`);
  if (!r.ok) throw new Error(await readHttpError(r));
  return r.json();
}

export async function saveSurplusBudgets(
  year: number,
  month: number,
  budgets: Record<string, number>
): Promise<{ year: number; month: number; budgets: Record<string, number> }> {
  const q = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  const r = await fetch(`${API}/surplus/budgets?${q}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ budgets }),
  });
  if (!r.ok) throw new Error(await readHttpError(r));
  return r.json();
}

export async function getSurplusMonthly(
  endYear: number,
  endMonth: number,
  months: number
): Promise<SurplusMonthlySeriesPayload> {
  const q = new URLSearchParams({
    end_year: String(endYear),
    end_month: String(endMonth),
    months: String(months),
  });
  const r = await fetch(`${API}/surplus/monthly?${q}`);
  if (!r.ok) throw new Error(await readHttpError(r));
  return r.json();
}

export async function uploadStatement(file: File): Promise<{
  parsed_count: number;
  upload_id: number;
  skipped_duplicates: number;
  replaced_count: number;
  detected_format: "pdf" | "xls" | "xlsx" | "unknown";
}> {
  const body = new FormData();
  body.append("file", file);
  const r = await fetch(`${API}/statements/upload`, {
    method: "POST",
    body,
  });
  if (!r.ok) throw new Error(await readHttpError(r));
  const raw: unknown = await r.json();
  return coerceUploadStatementResponse(raw);
}

/** Normalize API JSON so missing or camelCase fields never produce `undefined` in the UI. */
function coerceUploadStatementResponse(raw: unknown): {
  parsed_count: number;
  upload_id: number;
  skipped_duplicates: number;
  replaced_count: number;
  detected_format: "pdf" | "xls" | "xlsx" | "unknown";
} {
  const normalizeFormat = (v: unknown): "pdf" | "xls" | "xlsx" | "unknown" => {
    if (typeof v !== "string") return "unknown";
    const s = v.trim().toLowerCase();
    if (s === "pdf" || s === "xls" || s === "xlsx") return s;
    return "unknown";
  };
  const n = (v: unknown): number => {
    if (v === undefined || v === null || v === "") return 0;
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  if (!raw || typeof raw !== "object") {
    return {
      parsed_count: 0,
      upload_id: 0,
      skipped_duplicates: 0,
      replaced_count: 0,
      detected_format: "unknown",
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    parsed_count: n(o.parsed_count ?? o.parsedCount),
    upload_id: n(o.upload_id ?? o.uploadId),
    skipped_duplicates: n(o.skipped_duplicates ?? o.skippedDuplicates),
    replaced_count: n(o.replaced_count ?? o.replacedCount),
    detected_format: normalizeFormat(o.detected_format ?? o.detectedFormat),
  };
}

export async function setTransactionCategory(
  transactionId: string,
  category: string,
  surplusSubcategory?: string | null
): Promise<void> {
  const body: Record<string, string> = { category };
  if (surplusSubcategory != null && surplusSubcategory !== "") {
    body.surplus_subcategory = surplusSubcategory;
  }
  const r = await fetch(
    `${API}/transactions/${encodeURIComponent(transactionId)}/category`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!r.ok) throw new Error(await readHttpError(r));
}

export async function deleteTransaction(transactionId: string): Promise<void> {
  const r = await fetch(
    `${API}/transactions/${encodeURIComponent(transactionId)}`,
    { method: "DELETE" }
  );
  if (!r.ok) throw new Error(await readHttpError(r));
}

export async function restoreTransaction(transactionId: string): Promise<void> {
  const r = await fetch(
    `${API}/transactions/${encodeURIComponent(transactionId)}/restore`,
    { method: "POST" }
  );
  if (!r.ok) throw new Error(await readHttpError(r));
}

export async function clearMonthTransactions(
  year: number,
  month: number
): Promise<{ deleted_count: number }> {
  const q = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  const r = await fetch(`${API}/transactions/clear/month?${q}`, {
    method: "DELETE",
  });
  if (!r.ok) throw new Error(await readHttpError(r));
  const body = (await r.json()) as { deleted_count?: unknown };
  return { deleted_count: Number(body.deleted_count ?? 0) };
}

export async function clearAllTransactions(): Promise<{ deleted_count: number }> {
  const r = await fetch(`${API}/transactions/clear/all`, {
    method: "DELETE",
  });
  if (!r.ok) throw new Error(await readHttpError(r));
  const body = (await r.json()) as { deleted_count?: unknown };
  return { deleted_count: Number(body.deleted_count ?? 0) };
}
