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
      amount: number;
      merchant_name: string | null;
      primary_category: string;
      detailed_category: string | null;
      pending: boolean;
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
  categories: string[];
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

export async function uploadStatement(file: File): Promise<{
  parsed_count: number;
  upload_id: number;
  skipped_duplicates: number;
  replaced_count: number;
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
} {
  const n = (v: unknown): number => {
    if (v === undefined || v === null || v === "") return 0;
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  if (!raw || typeof raw !== "object") {
    return { parsed_count: 0, upload_id: 0, skipped_duplicates: 0, replaced_count: 0 };
  }
  const o = raw as Record<string, unknown>;
  return {
    parsed_count: n(o.parsed_count ?? o.parsedCount),
    upload_id: n(o.upload_id ?? o.uploadId),
    skipped_duplicates: n(o.skipped_duplicates ?? o.skippedDuplicates),
    replaced_count: n(o.replaced_count ?? o.replacedCount),
  };
}

export async function setTransactionCategory(
  transactionId: string,
  category: string
): Promise<void> {
  const r = await fetch(`${API}/transactions/${transactionId}/category`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category }),
  });
  if (!r.ok) throw new Error(await readHttpError(r));
}
