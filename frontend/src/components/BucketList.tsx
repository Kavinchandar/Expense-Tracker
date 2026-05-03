import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { OVERVIEW_HIDDEN_TX_CATEGORIES, type TransactionsPayload } from "../api";
import {
  DELETED_BUCKET_KEY,
  OVERVIEW_SURPLUS_KEY,
  SURPLUS_PRIMARY_KEY,
} from "../bucketOrder";
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
  /** When set, only these bucket categories are listed (e.g. surplus allocation). */
  onlyCategories?: readonly string[];
  /** When set with onlyCategories, buckets and rows sort in this order (e.g. FD → MF → …). */
  sectionBucketOrder?: readonly string[];
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
  onlyCategories,
  sectionBucketOrder,
}: Props) {
  const [patchingId, setPatchingId] = useState<string | null>(null);
  const [patchErr, setPatchErr] = useState<string | null>(null);
  /** Empty string = show all categories. */
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [sortMode, setSortMode] = useState<"date_desc" | "amount_desc" | "amount_asc">("amount_asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFilterCategory("");
    setSortMode("amount_asc");
  }, [data?.year, data?.month]);

  const allowOnly = useMemo(
    () =>
      onlyCategories && onlyCategories.length > 0
        ? new Set(onlyCategories)
        : null,
    [onlyCategories]
  );

  const overviewHidden = useMemo(
    () => new Set<string>(OVERVIEW_HIDDEN_TX_CATEGORIES),
    []
  );

  const activeBuckets = useMemo(() => {
    let list = (data?.buckets ?? []).filter((b) => b.name !== DELETED_BUCKET_KEY);
    if (!allowOnly) {
      list = list.filter((b) => !overviewHidden.has(b.name));
    }
    if (allowOnly) {
      list = list.filter((b) => allowOnly.has(b.name));
    }
    if (allowOnly && sectionBucketOrder?.length) {
      const orderMap = new Map(
        sectionBucketOrder.map((k, i) => [k, i] as const)
      );
      list = [...list].sort((a, b) => {
        const ia = orderMap.get(a.name) ?? 1_000;
        const ib = orderMap.get(b.name) ?? 1_000;
        return ia - ib;
      });
    }
    return list;
  }, [data?.buckets, allowOnly, overviewHidden, sectionBucketOrder]);

  const deletedBucket = useMemo(
    () => (data?.buckets ?? []).find((b) => b.name === DELETED_BUCKET_KEY),
    [data?.buckets]
  );

  const deletedRows = deletedBucket?.transactions ?? [];

  const surplusSectionNet = useMemo(() => {
    if (!allowOnly) return null;
    return activeBuckets.reduce((s, b) => s + b.total, 0);
  }, [allowOnly, activeBuckets]);

  const allRowsSorted = useMemo(() => {
    if (!activeBuckets.length) return [];
    const rows = activeBuckets.flatMap((b) => b.transactions);
    const orderMap =
      allowOnly && sectionBucketOrder?.length
        ? new Map(sectionBucketOrder.map((k, i) => [k, i] as const))
        : null;
    rows.sort((a, b) => {
      if (orderMap) {
        const ia = orderMap.get(a.primary_category) ?? 1_000;
        const ib = orderMap.get(b.primary_category) ?? 1_000;
        if (ia !== ib) return ia - ib;
      }
      if (sortMode === "amount_desc") {
        const byAmount = b.amount - a.amount;
        if (byAmount !== 0) return byAmount;
      } else if (sortMode === "amount_asc") {
        const byAmount = a.amount - b.amount;
        if (byAmount !== 0) return byAmount;
      }
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) return byDate;
      return String(b.transaction_id).localeCompare(String(a.transaction_id));
    });
    return rows;
  }, [activeBuckets, sortMode, allowOnly, sectionBucketOrder]);

  const categoryChoices = useMemo(() => {
    const set = new Set<string>();
    for (const c of categories) set.add(c);
    if (data?.buckets) {
      for (const b of data.buckets) {
        if (b.name === DELETED_BUCKET_KEY) continue;
        set.add(b.name);
      }
    }
    let arr = [...set];
    if (!allowOnly) {
      arr = arr.filter((c) => !overviewHidden.has(c));
    }
    if (allowOnly) {
      arr = arr.filter((c) => allowOnly.has(c));
    }
    if (!allowOnly) {
      arr = arr.filter(
        (c) => c !== OVERVIEW_SURPLUS_KEY && c !== DELETED_BUCKET_KEY
      );
      if (!arr.includes(SURPLUS_PRIMARY_KEY)) {
        arr.push(SURPLUS_PRIMARY_KEY);
      }
    }
    if (allowOnly && sectionBucketOrder?.length) {
      const orderMap = new Map(
        sectionBucketOrder.map((k, i) => [k, i] as const)
      );
      arr.sort((a, b) => {
        const ia = orderMap.has(a) ? orderMap.get(a)! : 1_000;
        const ib = orderMap.has(b) ? orderMap.get(b)! : 1_000;
        if (ia !== ib) return ia - ib;
        return (categoryLabels[a] ?? humanizeCategory(a)).localeCompare(
          categoryLabels[b] ?? humanizeCategory(b)
        );
      });
    } else {
      arr.sort((a, b) =>
        (categoryLabels[a] ?? humanizeCategory(a)).localeCompare(
          categoryLabels[b] ?? humanizeCategory(b)
        )
      );
    }
    return arr;
  }, [data, categories, categoryLabels, allowOnly, overviewHidden, sectionBucketOrder]);

  const flatRows = useMemo(() => {
    if (!filterCategory) return allRowsSorted;
    return allRowsSorted.filter((t) => t.primary_category === filterCategory);
  }, [allRowsSorted, filterCategory]);

  const selectableRowIds = useMemo(
    () =>
      flatRows
        .map((t) => t.transaction_id)
        .filter((id): id is string => typeof id === "string" && id.trim() !== ""),
    [flatRows]
  );

  useEffect(() => {
    const visible = new Set(selectableRowIds);
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      for (const id of prev) {
        if (visible.has(id)) next.add(id);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [selectableRowIds]);

  const allVisibleSelected =
    selectableRowIds.length > 0 &&
    selectableRowIds.every((id) => selectedIds.has(id));
  const someVisibleSelected =
    selectableRowIds.some((id) => selectedIds.has(id)) && !allVisibleSelected;

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  if (loading) return <p className="muted">Loading transactions…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data) return null;

  const hasDeleted = deletedRows.length > 0;
  const summaryBuckets = activeBuckets;

  const onCategoryChange = async (transactionId: string, category: string) => {
    const bulkApply =
      selectedIds.size > 0 && selectedIds.has(transactionId);
    const targets = bulkApply ? Array.from(selectedIds) : [transactionId];

    setPatchErr(null);
    setPatchingId(bulkApply ? "__bulk__" : transactionId);
    let done = 0;
    try {
      for (const id of targets) {
        await assignCategory(id, category);
        done += 1;
      }
      if (bulkApply) setSelectedIds(new Set());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setPatchErr(
        done > 0
          ? `${msg} (${done} transaction${done === 1 ? "" : "s"} updated before the error.)`
          : msg
      );
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
          {allowOnly
            ? "Surplus allocation transactions"
            : `${data.year}-${String(data.month).padStart(2, "0")}`}
        </h2>
        <p className="muted">
          {allowOnly
            ? `FDs · mutual funds · investments · Left over · ${data.year}-${String(data.month).padStart(2, "0")} · ${data.display_timezone}`
            : `Calendar month · ${data.display_timezone}`}
        </p>
        <p className="month-total">
          {allowOnly ? (
            <>
              Surplus allocation (not consumption outflow):{" "}
              <strong>
                {formatInr(Math.abs(surplusSectionNet ?? 0))}
              </strong>
            </>
          ) : (
            <>
              Net total: <strong>{formatInr(data.month_total)}</strong>
            </>
          )}
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
              {selectedIds.size > 0
                ? ` · ${selectedIds.size} selected`
                : ""}
            </span>
          ) : null}
        </p>
        <dl className="tx-period-summary">
          <div>
            <dt>Total inflow</dt>
            <dd>{formatInr(data.total_inflow)}</dd>
          </div>
          <div>
            <dt>
              {allowOnly ? "Consumption outflow" : "Total outflow"}
              {allowOnly ? (
                <span className="muted">
                  {" "}
                  (excl. surplus allocation categories)
                </span>
              ) : null}
            </dt>
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
        <div className="tx-sort-row">
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
          <label className="tx-sort-label">
            Sort by{" "}
            <select
              className="tx-sort-select"
              value={sortMode}
              onChange={(e) =>
                setSortMode(
                  e.target.value as "date_desc" | "amount_desc" | "amount_asc"
                )
              }
            >
              <option value="date_desc">Date (newest first)</option>
              <option value="amount_desc">Amount (high to low)</option>
              <option value="amount_asc">Amount (low to high)</option>
            </select>
          </label>
        </div>
      </header>

      {patchErr ? <p className="error">{patchErr}</p> : null}

      {showMainEmpty ? (
        <p className="muted">
          {allowOnly
            ? "No surplus allocation transactions for this month. Categorize debits here, or pick another month."
            : "No transactions for this month. Upload a PDF that includes dates in this month, or pick another month."}
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
                <th className="col-select">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (checked) {
                          for (const id of selectableRowIds) next.add(id);
                        } else {
                          for (const id of selectableRowIds) next.delete(id);
                        }
                        return next;
                      });
                    }}
                    disabled={
                      patchingId != null || selectableRowIds.length === 0
                    }
                    aria-label="Select all visible rows"
                  />
                </th>
                <th className="col-date">Date</th>
                <th className="col-desc">Description</th>
                <th className="col-detail">Details</th>
                <th className="col-amt">Amount</th>
                <th className="col-cat">Bucket (category)</th>
                <th className="col-action" scope="col">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {flatRows.map((t, idx) => {
                const opts = categoryOptions(categoryChoices, t.primary_category);
                const rowId = t.transaction_id;
                const rowIdString = String(rowId ?? "");
                const rowBusy =
                  patchingId === "__bulk__" ||
                  (patchingId != null &&
                    rowId != null &&
                    rowId !== "" &&
                    String(patchingId) === String(rowId));
                const prev = idx > 0 ? flatRows[idx - 1] : null;
                const showBucketHeader =
                  Boolean(allowOnly && sectionBucketOrder?.length) &&
                  (prev == null ||
                    prev.primary_category !== t.primary_category);
                return (
                  <Fragment
                    key={rowId ?? `${t.date}-${t.name}-${t.amount}-${idx}`}
                  >
                    {showBucketHeader ? (
                      <tr className="tx-bucket-section">
                        <td colSpan={7} className="tx-bucket-section-cell">
                          <strong>
                            {categoryLabels[t.primary_category] ??
                              humanizeCategory(t.primary_category)}
                          </strong>
                        </td>
                      </tr>
                    ) : null}
                    <tr>
                    <td className="col-select">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(rowIdString)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(rowIdString);
                            else next.delete(rowIdString);
                            return next;
                          });
                        }}
                        disabled={rowBusy || rowId == null || rowId === ""}
                      />
                    </td>
                    <td className="col-date">{t.date}</td>
                    <td className="col-desc">
                      <span className="tx-desc-text">
                        {t.merchant_name || t.name}
                        {t.pending ? (
                          <span className="pending"> pending</span>
                        ) : null}
                      </span>
                    </td>
                    <td className="col-detail">
                      <span
                        className="tx-detail-readonly muted"
                        title={
                          (t.detail ?? "").trim()
                            ? "From statement import or bank narrative"
                            : undefined
                        }
                      >
                        {(t.detail ?? "").trim() ? (t.detail ?? "") : ""}
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
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {hasDeleted && !allowOnly ? (
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
