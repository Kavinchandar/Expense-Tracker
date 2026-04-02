import { useState } from "react";
import type { TransactionsPayload } from "../api";
import { setTransactionCategory } from "../api";

function formatAmount(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type Props = {
  data: TransactionsPayload | null;
  loading: boolean;
  error: string | null;
  categories: string[];
  onTransactionsChanged: () => Promise<void>;
};

export function BucketList({
  data,
  loading,
  error,
  categories,
  onTransactionsChanged,
}: Props) {
  const [patchingId, setPatchingId] = useState<string | null>(null);
  const [patchErr, setPatchErr] = useState<string | null>(null);

  if (loading) return <p className="muted">Loading transactions…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data) return null;

  const onCategoryChange = async (transactionId: string, category: string) => {
    setPatchErr(null);
    setPatchingId(transactionId);
    try {
      await setTransactionCategory(transactionId, category);
      await onTransactionsChanged();
    } catch (e: unknown) {
      setPatchErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPatchingId(null);
    }
  };

  return (
    <div className="bucket-list">
      <header className="bucket-header">
        <h2>
          {data.year}-{String(data.month).padStart(2, "0")}
        </h2>
        <p className="muted">Calendar month · {data.display_timezone}</p>
        <p className="month-total">
          Net total: <strong>{formatAmount(data.month_total)}</strong>
        </p>
      </header>

      {patchErr ? <p className="error">{patchErr}</p> : null}

      {data.buckets.length === 0 ? (
        <p className="muted">
          No transactions for this month. Upload a PDF that includes dates in this
          month, or pick another month.
        </p>
      ) : (
        <ul className="buckets">
          {data.buckets.map((b) => (
            <li key={b.name} className="bucket">
              <details open>
                <summary>
                  <span className="bucket-name">{humanizeCategory(b.name)}</span>
                  <span className="bucket-total">{formatAmount(b.total)}</span>
                </summary>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.transactions.map((t) => {
                      const opts = categoryOptions(categories, t.primary_category);
                      return (
                        <tr key={t.transaction_id}>
                          <td>{t.date}</td>
                          <td>
                            {t.merchant_name || t.name}
                            {t.pending ? (
                              <span className="pending"> pending</span>
                            ) : null}
                          </td>
                          <td>{formatAmount(t.amount)}</td>
                          <td className="category-cell">
                            <select
                              className="category-select"
                              value={t.primary_category}
                              disabled={patchingId === t.transaction_id}
                              onChange={(e) =>
                                void onCategoryChange(
                                  t.transaction_id,
                                  e.target.value
                                )
                              }
                            >
                              {opts.map((c) => (
                                <option key={c} value={c}>
                                  {humanizeCategory(c)}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function humanizeCategory(raw: string): string {
  return raw.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function categoryOptions(list: string[], current: string): string[] {
  if (list.includes(current)) return list;
  return [...list, current];
}
