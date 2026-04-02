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

export type PlaidStatus = {
  connected: boolean;
  institution_name: string | null;
};

export type TransactionsPayload = {
  year: number;
  month: number;
  month_total: number;
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

export async function getPlaidStatus(): Promise<PlaidStatus> {
  const r = await fetch(`${API}/plaid/status`);
  if (!r.ok) throw new Error(await readHttpError(r));
  return r.json();
}

export async function fetchLinkToken(): Promise<string> {
  const r = await fetch(`${API}/plaid/link_token`, { method: "POST" });
  if (!r.ok) throw new Error(await readHttpError(r));
  const data = (await r.json()) as { link_token: string };
  return data.link_token;
}

export async function exchangePublicToken(publicToken: string): Promise<void> {
  const r = await fetch(`${API}/plaid/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_token: publicToken }),
  });
  if (!r.ok) throw new Error(await readHttpError(r));
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

export async function getCategories(): Promise<string[]> {
  const r = await fetch(`${API}/categories`);
  if (!r.ok) throw new Error(await readHttpError(r));
  const data = (await r.json()) as { categories: string[] };
  return data.categories;
}

export async function uploadStatement(file: File): Promise<{
  parsed_count: number;
  upload_id: number;
}> {
  const body = new FormData();
  body.append("file", file);
  const r = await fetch(`${API}/statements/upload`, {
    method: "POST",
    body,
  });
  if (!r.ok) throw new Error(await readHttpError(r));
  return r.json();
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

export function plaidLinkEnv(): "sandbox" | "development" | "production" {
  const v = import.meta.env.VITE_PLAID_ENV?.toLowerCase();
  if (v === "production" || v === "development" || v === "sandbox") return v;
  return "sandbox";
}
