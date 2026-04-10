import { useEffect, useMemo, useState } from "react";
import type { TransactionsPayload } from "../api";
import { saveBudgets } from "../api";
import { INFLOW_KEY, SPENDING_CHART_ORDER } from "../bucketOrder";
import { BudgetSpendPieChart } from "./BudgetSpendPieChart";

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
    }).filter((row) => row.spent > 0);
  }, [spentByName, budgets, labels]);

  const inflowRow = useMemo(() => {
    const received = spentByName.get(INFLOW_KEY) ?? 0;
    const budget = budgets[INFLOW_KEY] ?? 0;
    return {
      fullName: labels[INFLOW_KEY] ?? "InFlow",
      budget,
      received,
    };
  }, [spentByName, budgets, labels]);

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
        Compare what you planned (budget) to actual spending per bucket.
      </p>

      {saveErr ? <p className="error">{saveErr}</p> : null}

      <BudgetSpendPieChart
        year={year}
        month={month}
        spentByName={spentByName}
        budgets={budgets}
        labels={labels}
        totalInflow={data.total_inflow}
        totalOutflow={data.total_outflow}
      />

      <div className="bucket-cards">
        {spendingChartRows.map((row) => {
          const { key, spent, budget, fullName } = row;
          const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
          const over = budget > 0 && spent > budget;
          return (
            <div key={key} className={`bucket-card ${over ? "bucket-card--over" : ""}`}>
              <div className="bucket-card-title">{fullName}</div>
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

      <details className="budget-edit">
        <summary>
          Edit global budgets — one target per category for all months (the month picker only
          changes which month&apos;s spending you compare)
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
