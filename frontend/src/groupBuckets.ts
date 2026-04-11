import type { TransactionsPayload } from "./api";
import { DELETED_BUCKET_KEY } from "./bucketOrder";

type TxRow = TransactionsPayload["buckets"][number]["transactions"][number];

/**
 * Mirrors backend `group_by_bucket`: sort buckets by |total| desc, transactions by date desc.
 */
export function groupIntoBuckets(
  rows: TxRow[]
): Pick<TransactionsPayload, "buckets" | "month_total"> {
  const map = new Map<string, TxRow[]>();
  for (const r of rows) {
    const k = r.primary_category;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  }

  let month_total = 0;
  for (const r of rows) month_total += r.amount;

  function bucketTotal(items: TxRow[]): number {
    return items.reduce((s, x) => s + x.amount, 0);
  }

  const names = [...map.keys()].sort(
    (a, b) =>
      Math.abs(bucketTotal(map.get(b)!)) - Math.abs(bucketTotal(map.get(a)!))
  );

  const buckets = names.map((name) => {
    const items = [...map.get(name)!];
    items.sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) return byDate;
      return String(b.transaction_id).localeCompare(String(a.transaction_id));
    });
    return {
      name,
      total: bucketTotal(items),
      transactions: items,
    };
  });

  return { buckets, month_total };
}

export function mergeCategoryChange(
  tx: TransactionsPayload,
  transactionId: string,
  newCategory: string
): TransactionsPayload {
  const flat = tx.buckets.flatMap((b) => b.transactions);
  const rows = flat.map((t) =>
    t.transaction_id === transactionId
      ? { ...t, primary_category: newCategory }
      : t
  );
  const { buckets } = groupIntoBuckets(rows);
  let month_total = 0;
  for (const b of buckets) {
    if (b.name === DELETED_BUCKET_KEY) continue;
    month_total += b.total;
  }
  return {
    ...tx,
    buckets,
    month_total,
  };
}
