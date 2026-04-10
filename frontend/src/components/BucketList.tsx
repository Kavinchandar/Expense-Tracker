import { useEffect, useMemo, useState } from "react";
import type { TransactionsPayload } from "../api";

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
  categoryLabels: Record<string, string>;
  assignCategory: (transactionId: string, category: string) => Promise<void>;
};

export function BucketList({
  data,
  loading,
  error,
  categories,
  categoryLabels,
  assignCategory,
}: Props) {
  const [patchingId, setPatchingId] = useState<string | null>(null);
  const [patchErr, setPatchErr] = useState<string | null>(null);
  /** Empty string = show all categories. */
  const [filterCategory, setFilterCategory] = useState<string>("");

  useEffect(() => {
    setFilterCategory("");
  }, [data?.year, data?.month]);

  const allRowsSorted = useMemo(() => {
    if (!data?.buckets.length) return [];
    const rows = data.buckets.flatMap((b) => b.transactions);
    rows.sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) return byDate;
      return String(b.transaction_id).localeCompare(String(a.transaction_id));
    });
    return rows;
  }, [data]);

  const categoryChoices = useMemo(() => {
    const set = new Set<string>();
    for (const c of categories) set.add(c);
    if (data?.buckets) {
      for (const b of data.buckets) set.add(b.name);
    }
    const arr = [...set];
    arr.sort((a, b) =>
      (categoryLabels[a] ?? humanizeCategory(a)).localeCompare(
        categoryLabels[b] ?? humanizeCategory(b)
      )
    );
    return arr;
  }, [data, categories, categoryLabels]);

  const flatRows = useMemo(() => {
    if (!filterCategory) return allRowsSorted;
    return allRowsSorted.filter((t) => t.primary_category === filterCategory);
  }, [allRowsSorted, filterCategory]);

  if (loading) return <p className="muted">Loading transactions…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data) return null;

  const onCategoryChange = async (transactionId: string, category: string) => {
    setPatchErr(null);
    setPatchingId(transactionId);
    try {
      await assignCategory(transactionId, category);
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
          {allRowsSorted.length > 0 ? (
            <span className="tx-count muted">
              {" "}
              ·{" "}
              {filterCategory
                ? `${flatRows.length} of ${allRowsSorted.length} transaction${
                    allRowsSorted.length === 1 ? "" : "s"
                  }`
                : `${flatRows.length} transaction${flatRows.length === 1 ? "" : "s"}`}
            </span>
          ) : null}
        </p>
        <dl className="tx-period-summary">
          <div>
            <dt>Total inflow</dt>
            <dd>{formatAmount(data.total_inflow)}</dd>
          </div>
          <div>
            <dt>Total outflow</dt>
            <dd>{formatAmount(data.total_outflow)}</dd>
          </div>
          <div>
            <dt>Balance at period start</dt>
            <dd>
              {data.opening_balance == null
                ? "—"
                : formatAmount(data.opening_balance)}
            </dd>
          </div>
          <div>
            <dt>Balance at period end</dt>
            <dd>
              {data.closing_balance == null
                ? "—"
                : formatAmount(data.closing_balance)}
            </dd>
          </div>
        </dl>
        <p className="tx-sort-row">
          <label className="tx-sort-label">
            Show transactions{" "}
            <select
              className="tx-sort-select"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categoryChoices.map((key) => (
                <option key={key} value={key}>
                  {categoryLabels[key] ?? humanizeCategory(key)}
                </option>
              ))}
            </select>
          </label>
        </p>
        <p className="tx-list-hint muted">
          Each row is one transaction. Assign a bucket in the last column; the
          summary below lists totals by bucket.
        </p>
      </header>

      {patchErr ? <p className="error">{patchErr}</p> : null}

      {allRowsSorted.length === 0 ? (
        <p className="muted">
          No transactions for this month. Upload a PDF that includes dates in this
          month, or pick another month.
        </p>
      ) : flatRows.length === 0 ? (
        <p className="muted">
          No transactions in this category for this month. Choose another
          category or &quot;All categories&quot;.
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
                  const rowId = t.transaction_id;
                  /** Avoid `null === null`: when id is missing, idle state must not disable every row. */
                  const rowBusy =
                    patchingId != null &&
                    rowId != null &&
                    rowId !== "" &&
                    String(patchingId) === String(rowId);
                  return (
                    <tr key={rowId ?? `${t.date}-${t.name}-${t.amount}`}>
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
                          disabled={
                            rowBusy || rowId == null || rowId === ""
                          }
                          onChange={(e) =>
                            void onCategoryChange(
                              String(rowId),
                              e.target.value
                            )
                          }
                        >
                          {opts.map((c) => (
                            <option key={c} value={c}>
                              {categoryLabels[c] ?? humanizeCategory(c)}
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
