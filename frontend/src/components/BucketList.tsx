import { useEffect, useMemo, useState } from "react";
import type { TransactionsPayload } from "../api";
import { DELETED_BUCKET_KEY } from "../bucketOrder";
import { formatInr } from "../formatInr";

type Props = {
  data: TransactionsPayload | null;
  loading: boolean;
  error: string | null;
  categories: string[];
  categoryLabels: Record<string, string>;
  assignCategory: (transactionId: string, category: string) => Promise<void>;
  onDeleteTransaction: (transactionId: string) => Promise<void>;
  onRestoreTransaction: (transactionId: string) => Promise<void>;
};

export function BucketList({
  data,
  loading,
  error,
  categories,
  categoryLabels,
  assignCategory,
  onDeleteTransaction,
  onRestoreTransaction,
}: Props) {
  const [patchingId, setPatchingId] = useState<string | null>(null);
  const [patchErr, setPatchErr] = useState<string | null>(null);
  /** Empty string = show all categories. */
  const [filterCategory, setFilterCategory] = useState<string>("");

  useEffect(() => {
    setFilterCategory("");
  }, [data?.year, data?.month]);

  const activeBuckets = useMemo(
    () => (data?.buckets ?? []).filter((b) => b.name !== DELETED_BUCKET_KEY),
    [data?.buckets]
  );

  const deletedBucket = useMemo(
    () => (data?.buckets ?? []).find((b) => b.name === DELETED_BUCKET_KEY),
    [data?.buckets]
  );

  const deletedRows = deletedBucket?.transactions ?? [];

  const allRowsSorted = useMemo(() => {
    if (!activeBuckets.length) return [];
    const rows = activeBuckets.flatMap((b) => b.transactions);
    rows.sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) return byDate;
      return String(b.transaction_id).localeCompare(String(a.transaction_id));
    });
    return rows;
  }, [activeBuckets]);

  const categoryChoices = useMemo(() => {
    const set = new Set<string>();
    for (const c of categories) set.add(c);
    if (data?.buckets) {
      for (const b of data.buckets) {
        if (b.name === DELETED_BUCKET_KEY) continue;
        set.add(b.name);
      }
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

  const hasDeleted = deletedRows.length > 0;
  const summaryBuckets = activeBuckets;

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

  const onDelete = async (transactionId: string) => {
    setPatchErr(null);
    setPatchingId(transactionId);
    try {
      await onDeleteTransaction(transactionId);
    } catch (e: unknown) {
      setPatchErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPatchingId(null);
    }
  };

  const onRestore = async (transactionId: string) => {
    setPatchErr(null);
    setPatchingId(transactionId);
    try {
      await onRestoreTransaction(transactionId);
    } catch (e: unknown) {
      setPatchErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPatchingId(null);
    }
  };

  const showMainEmpty =
    allRowsSorted.length === 0 && !hasDeleted && summaryBuckets.length === 0;
  const showFilterEmpty =
    allRowsSorted.length > 0 && flatRows.length === 0 && !!filterCategory;

  return (
    <div className="tx-list">
      <header className="bucket-header">
        <h2>
          {data.year}-{String(data.month).padStart(2, "0")}
        </h2>
        <p className="muted">Calendar month · {data.display_timezone}</p>
        <p className="month-total">
          Net total: <strong>{formatInr(data.month_total)}</strong>
          {allRowsSorted.length > 0 || hasDeleted ? (
            <span className="tx-count muted">
              {" "}
              ·{" "}
              {filterCategory
                ? `${flatRows.length} of ${allRowsSorted.length} active transaction${
                    allRowsSorted.length === 1 ? "" : "s"
                  }`
                : `${allRowsSorted.length} active${
                    hasDeleted
                      ? ` · ${deletedRows.length} deleted`
                      : ""
                  }`}
            </span>
          ) : null}
        </p>
        <dl className="tx-period-summary">
          <div>
            <dt>Total inflow</dt>
            <dd>{formatInr(data.total_inflow)}</dd>
          </div>
          <div>
            <dt>Total outflow</dt>
            <dd>{formatInr(data.total_outflow)}</dd>
          </div>
          <div>
            <dt>Balance at period start</dt>
            <dd>
              {data.opening_balance == null
                ? "—"
                : formatInr(data.opening_balance)}
            </dd>
          </div>
          <div>
            <dt>Balance at period end</dt>
            <dd>
              {data.closing_balance == null
                ? "—"
                : formatInr(data.closing_balance)}
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
          Active rows: assign a bucket or use <strong>Delete</strong> in the last
          column (sticky on the right if the table scrolls sideways). Deleted rows
          are listed below and stay out of totals and insights.
        </p>
      </header>

      {patchErr ? <p className="error">{patchErr}</p> : null}

      {showMainEmpty ? (
        <p className="muted">
          No transactions for this month. Upload a PDF that includes dates in this
          month, or pick another month.
        </p>
      ) : null}

      {allRowsSorted.length === 0 && hasDeleted && !showMainEmpty ? (
        <p className="muted tx-deleted-intro">
          No active transactions this month. Deleted items (below) are hidden from
          totals.
        </p>
      ) : null}

      {showFilterEmpty ? (
        <p className="muted">
          No transactions in this category for this month. Choose another
          category or &quot;All categories&quot;.
        </p>
      ) : null}

      {flatRows.length > 0 ? (
        <div className="tx-table-wrap">
          <table className="tx-table">
            <thead>
              <tr>
                <th className="col-date">Date</th>
                <th className="col-desc">Description</th>
                <th className="col-amt">Amount</th>
                <th className="col-cat">Bucket (category)</th>
                <th className="col-action" scope="col">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {flatRows.map((t) => {
                const opts = categoryOptions(categories, t.primary_category);
                const rowId = t.transaction_id;
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
                      {formatInr(t.amount)}
                    </td>
                    <td className="category-cell col-cat">
                      <select
                        className="category-select"
                        value={t.primary_category}
                        disabled={rowBusy || rowId == null || rowId === ""}
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
                    <td className="col-action">
                      <button
                        type="button"
                        className="btn-tx-delete"
                        disabled={rowBusy || rowId == null || rowId === ""}
                        title="Soft delete (moved to Deleted)"
                        onClick={() => void onDelete(String(rowId))}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {hasDeleted ? (
        <section className="tx-deleted-section card-inner" aria-labelledby="deleted-heading">
          <h3 id="deleted-heading" className="tx-deleted-heading">
            Deleted
          </h3>
          <p className="muted tx-deleted-note">
            Excluded from month totals, budgets, and AI insights. Restore to
            bring a row back into your categories.
          </p>
          <div className="tx-table-wrap">
            <table className="tx-table tx-table-deleted">
              <thead>
                <tr>
                  <th className="col-date">Date</th>
                  <th className="col-desc">Description</th>
                  <th className="col-amt">Amount</th>
                  <th className="col-restore" aria-label="Restore" />
                </tr>
              </thead>
              <tbody>
                {deletedRows.map((t) => {
                  const rowId = t.transaction_id;
                  const rowBusy =
                    patchingId != null &&
                    rowId != null &&
                    rowId !== "" &&
                    String(patchingId) === String(rowId);
                  return (
                    <tr key={`del-${rowId ?? `${t.date}-${t.name}`}`}>
                      <td className="col-date">{t.date}</td>
                      <td className="col-desc">
                        <span className="tx-desc-text">
                          {t.merchant_name || t.name}
                        </span>
                      </td>
                      <td className="col-amt tx-amt">
                        {formatInr(t.amount)}
                      </td>
                      <td className="col-restore">
                        <button
                          type="button"
                          className="btn-tx-restore"
                          disabled={rowBusy || rowId == null || rowId === ""}
                          onClick={() => void onRestore(String(rowId))}
                        >
                          Restore
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {data.buckets.length > 0 ? (
        <details className="bucket-summary">
          <summary>
            Summary by bucket ({summaryBuckets.length}{" "}
            {summaryBuckets.length === 1 ? "category" : "categories"}
            {hasDeleted ? " · deleted listed separately" : ""})
          </summary>
          <ul className="bucket-summary-list">
            {summaryBuckets.map((b) => (
              <li key={b.name}>
                <span className="bucket-summary-name">
                  {categoryLabels[b.name] ?? humanizeCategory(b.name)}
                </span>
                <span className="bucket-summary-meta">
                  {b.transactions.length} · {formatInr(b.total)}
                </span>
              </li>
            ))}
            {hasDeleted ? (
              <li className="bucket-summary-deleted">
                <span className="bucket-summary-name">
                  {categoryLabels[DELETED_BUCKET_KEY] ?? "Deleted"}
                </span>
                <span className="bucket-summary-meta">
                  {deletedRows.length} · {formatInr(deletedBucket?.total ?? 0)}
                </span>
              </li>
            ) : null}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function humanizeCategory(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function categoryOptions(list: string[], current: string): string[] {
  if (list.includes(current)) return list;
  return [...list, current];
}
