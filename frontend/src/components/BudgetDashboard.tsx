import { useEffect, useMemo, useState } from "react";
import type { TransactionsPayload } from "../api";
import { saveBudgets } from "../api";
import { INFLOW_KEY, SPENDING_CHART_ORDER } from "../bucketOrder";

function formatInr(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function spentForBucket(name: string, total: number): number {
  if (name === INFLOW_KEY) return Math.max(0, total);
  return Math.max(0, -total);
}

type Props = {
  year: number;
  month: number;
  data: TransactionsPayload | null;
  loading: boolean;
  budgets: Record<string, number>;
  labels: Record<string, string>;
  categoryKeys: string[];
  onBudgetsSaved: (budgets: Record<string, number>) => void;
};

export function BudgetDashboard({
  year,
  month,
  data,
  loading,
  budgets,
  labels,
  categoryKeys,
  onBudgetsSaved,
}: Props) {
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const k of categoryKeys) {
      next[k] = String(budgets[k] ?? 0);
    }
    setEdit(next);
  }, [budgets, categoryKeys]);

  const spentByName = useMemo(() => {
    const m = new Map<string, number>();
    if (!data?.buckets) return m;
    for (const b of data.buckets) {
      m.set(b.name, spentForBucket(b.name, b.total));
    }
    return m;
  }, [data]);

  const spendingChartRows = useMemo(() => {
    return SPENDING_CHART_ORDER.map((key) => {
      const spent = spentByName.get(key) ?? 0;
      const budget = budgets[key] ?? 0;
      return {
        key,
        fullName: labels[key] ?? key,
        budget,
        spent,
      };
    });
  }, [spentByName, budgets, labels]);

  const spendingMax = useMemo(() => {
    let m = 1;
    for (const r of spendingChartRows) {
      m = Math.max(m, r.budget, r.spent);
    }
    return m;
  }, [spendingChartRows]);

  const inflowRow = useMemo(() => {
    const received = spentByName.get(INFLOW_KEY) ?? 0;
    const budget = budgets[INFLOW_KEY] ?? 0;
    return {
      fullName: labels[INFLOW_KEY] ?? "InFlow",
      budget,
      received,
    };
  }, [spentByName, budgets, labels]);

  const inflowMax = useMemo(() => {
    return Math.max(1, inflowRow.budget, inflowRow.received);
  }, [inflowRow]);

  const onSave = async () => {
    setSaveErr(null);
    const payload: Record<string, number> = {};
    for (const k of categoryKeys) {
      const raw = edit[k]?.trim() ?? "0";
      const n = parseFloat(raw.replace(/,/g, ""));
      if (Number.isNaN(n) || n < 0) {
        setSaveErr(`Invalid amount for ${labels[k] ?? k}`);
        return;
      }
      payload[k] = n;
    }
    setSaving(true);
    try {
      const res = await saveBudgets(year, month, payload);
      onBudgetsSaved(res.budgets);
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="muted">Loading budget overview…</p>;
  }
  if (!data) return null;

  return (
    <div className="budget-dashboard">
      <h3 className="budget-dashboard-title">Buckets & budget</h3>
      <p className="muted budget-dashboard-lede">
        Compare what you planned (budget) to actual spending per bucket. InFlow
        shows income received vs your income target.
      </p>

      {saveErr ? <p className="error">{saveErr}</p> : null}

      <div className="bucket-cards">
        {SPENDING_CHART_ORDER.map((key) => {
          const spent = spentByName.get(key) ?? 0;
          const budget = budgets[key] ?? 0;
          const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
          const over = budget > 0 && spent > budget;
          return (
            <div key={key} className={`bucket-card ${over ? "bucket-card--over" : ""}`}>
              <div className="bucket-card-title">{labels[key] ?? key}</div>
              <div className="bucket-card-figures">
                <span className="bucket-card-spent">{formatInr(spent)}</span>
                <span className="bucket-card-sep"> / </span>
                <span className="bucket-card-budget">{formatInr(budget)}</span>
              </div>
              {budget > 0 ? (
                <div className="bucket-card-bar">
                  <div
                    className="bucket-card-bar-fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              ) : (
                <p className="bucket-card-note muted">No budget set</p>
              )}
            </div>
          );
        })}
        <div className="bucket-card bucket-card--inflow">
          <div className="bucket-card-title">{inflowRow.fullName}</div>
          <div className="bucket-card-figures">
            <span className="bucket-card-spent">{formatInr(inflowRow.received)}</span>
            <span className="bucket-card-sep"> / </span>
            <span className="bucket-card-budget">{formatInr(inflowRow.budget)}</span>
          </div>
          <p className="bucket-card-note muted">Received / target</p>
        </div>
      </div>

      <div className="chart-block">
        <h4 className="chart-block-title">Spending: budget vs actual</h4>
        <div className="css-bar-chart" aria-label="Spending budget versus actual by category">
          {spendingChartRows.map((row) => (
            <div key={row.key} className="css-bar-chart-row">
              <div className="css-bar-chart-label" title={row.fullName}>
                {row.fullName.length > 22 ? `${row.fullName.slice(0, 20)}…` : row.fullName}
              </div>
              <div className="css-bar-chart-bars">
                <div className="css-bar-pair">
                  <span className="css-bar-legend">Budget</span>
                  <div className="css-bar-track">
                    <div
                      className="css-bar-fill css-bar-fill--budget"
                      style={{ width: `${(row.budget / spendingMax) * 100}%` }}
                    />
                  </div>
                  <span className="css-bar-num">{formatInr(row.budget)}</span>
                </div>
                <div className="css-bar-pair">
                  <span className="css-bar-legend">Spent</span>
                  <div className="css-bar-track">
                    <div
                      className="css-bar-fill css-bar-fill--spent"
                      style={{ width: `${(row.spent / spendingMax) * 100}%` }}
                    />
                  </div>
                  <span className="css-bar-num">{formatInr(row.spent)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="chart-block chart-block--inflow">
        <h4 className="chart-block-title">InFlow: target vs received</h4>
        <div className="css-bar-chart css-bar-chart--inflow">
          <div className="css-bar-chart-row">
            <div className="css-bar-chart-label">{inflowRow.fullName}</div>
            <div className="css-bar-chart-bars">
              <div className="css-bar-pair">
                <span className="css-bar-legend">Target</span>
                <div className="css-bar-track">
                  <div
                    className="css-bar-fill css-bar-fill--inflow-target"
                    style={{ width: `${(inflowRow.budget / inflowMax) * 100}%` }}
                  />
                </div>
                <span className="css-bar-num">{formatInr(inflowRow.budget)}</span>
              </div>
              <div className="css-bar-pair">
                <span className="css-bar-legend">Received</span>
                <div className="css-bar-track">
                  <div
                    className="css-bar-fill css-bar-fill--inflow-received"
                    style={{ width: `${(inflowRow.received / inflowMax) * 100}%` }}
                  />
                </div>
                <span className="css-bar-num">{formatInr(inflowRow.received)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <details className="budget-edit">
        <summary>
          Edit monthly budgets ({year}-{String(month).padStart(2, "0")})
        </summary>
        <div className="budget-edit-grid">
          {categoryKeys.map((key) => (
            <label key={key} className="budget-edit-row">
              <span className="budget-edit-label">{labels[key] ?? key}</span>
              <input
                type="text"
                inputMode="decimal"
                className="budget-edit-input"
                value={edit[key] ?? ""}
                onChange={(e) =>
                  setEdit((prev) => ({ ...prev, [key]: e.target.value }))
                }
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          className="btn-primary budget-save"
          onClick={() => void onSave()}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save budgets"}
        </button>
      </details>
    </div>
  );
}
