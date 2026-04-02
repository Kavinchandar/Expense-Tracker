import { useMemo, useState } from "react";
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

  const flatRows = useMemo(() => {
    if (!data?.buckets.length) return [];
    const rows = data.buckets.flatMap((b) => b.transactions);
    rows.sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) return byDate;
      return String(b.transaction_id).localeCompare(String(a.transaction_id));
    });
    return rows;
  }, [data]);

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
    <div className="tx-list">
      <header className="bucket-header">
        <h2>
          {data.year}-{String(data.month).padStart(2, "0")}
        </h2>
        <p className="muted">Calendar month · {data.display_timezone}</p>
        <p className="month-total">
          Net total: <strong>{formatAmount(data.month_total)}</strong>
          {flatRows.length > 0 ? (
            <span className="tx-count muted">
              {" "}
              · {flatRows.length} transaction{flatRows.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </p>
        <p className="tx-list-hint muted">
          Each row is one transaction. Use the category column to sort it into a
          bucket; totals by bucket are in the summary below.
        </p>
      </header>

      {patchErr ? <p className="error">{patchErr}</p> : null}

      {flatRows.length === 0 ? (
        <p className="muted">
          No transactions for this month. Upload a PDF that includes dates in this
          month, or pick another month.
        </p>
      ) : (
        <>
          <div className="tx-table-wrap">
            <table className="tx-table">
              <thead>
                <tr>
                  <th className="col-date">Date</th>
                  <th className="col-desc">Description</th>
                  <th className="col-amt">Amount</th>
                  <th className="col-cat">Bucket (category)</th>
                </tr>
              </thead>
              <tbody>
                {flatRows.map((t) => {
                  const opts = categoryOptions(categories, t.primary_category);
                  return (
                    <tr key={t.transaction_id}>
                      <td className="col-date">{t.date}</td>
                      <td className="col-desc">
                        <span className="tx-desc-text">
                          {t.merchant_name || t.name}
                          {t.pending ? (
                            <span className="pending"> pending</span>
                          ) : null}
                        </span>
                      </td>
                      <td className="col-amt tx-amt">
                        {formatAmount(t.amount)}
                      </td>
                      <td className="category-cell col-cat">
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
          </div>

          {data.buckets.length > 0 ? (
            <details className="bucket-summary">
              <summary>Summary by bucket ({data.buckets.length} categories)</summary>
              <ul className="bucket-summary-list">
                {data.buckets.map((b) => (
                  <li key={b.name}>
                    <span className="bucket-summary-name">
                      {humanizeCategory(b.name)}
                    </span>
                    <span className="bucket-summary-meta">
                      {b.transactions.length} · {formatAmount(b.total)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
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
