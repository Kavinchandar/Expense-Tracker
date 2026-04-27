import { useEffect, useMemo, useState } from "react";
import type { TransactionsPayload } from "../api";
import {
  OVERVIEW_HIDDEN_TX_CATEGORIES,
  saveBudgets,
  SURPLUS_ALLOCATION_TX_CATEGORIES,
} from "../api";
import { OVERVIEW_SPENDING_CHART_ORDER } from "../bucketOrder";
import { INFLOW_KEY } from "../bucketOrder";
import { formatInr } from "../formatInr";
import { BudgetSpendPieChart } from "./BudgetSpendPieChart";

function spentForBucket(name: string, total: number): number {
  if (name === INFLOW_KEY) return Math.max(0, total);
  return Math.max(0, -total);
}

function parseBudgetAmount(raw: string): number | null {
  const n = parseFloat(raw.replace(/,/g, ""));
  if (Number.isNaN(n) || n < 0) return null;
  return n;
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

  const surplusAlloc = useMemo(
    () => new Set<string>(SURPLUS_ALLOCATION_TX_CATEGORIES),
    []
  );

  const spentByName = useMemo(() => {
    const m = new Map<string, number>();
    if (!data?.buckets) return m;
    for (const b of data.buckets) {
      // Surplus allocation buckets are not consumption outflow; omit from spent mix.
      if (surplusAlloc.has(b.name)) continue;
      m.set(b.name, spentForBucket(b.name, b.total));
    }
    return m;
  }, [data, surplusAlloc]);

  const draftTotalAllocated = useMemo(
    () =>
      categoryKeys.reduce((s, key) => {
        if (key === INFLOW_KEY) return s;
        const parsed = parseBudgetAmount(edit[key]?.trim() ?? "0");
        return s + (parsed ?? 0);
      }, 0),
    [categoryKeys, edit]
  );

  const onSave = async () => {
    setSaveErr(null);
    const payload: Record<string, number> = {};
    for (const k of categoryKeys) {
      const raw = edit[k]?.trim() ?? "0";
      const n = parseBudgetAmount(raw);
      if (n == null) {
        setSaveErr(`Invalid amount for ${labels[k] ?? k}`);
        return;
      }
      payload[k] = n;
    }
    /* API replaces all bucket keys; keep FD/Investments targets edited only on Surplus flows. */
    for (const k of OVERVIEW_HIDDEN_TX_CATEGORIES) {
      payload[k] = budgets[k] ?? 0;
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
        Compare what you planned (budget) to actual spending per bucket. The donut
        and the cards use the same colors—hover either to highlight.
      </p>

      {saveErr ? <p className="error">{saveErr}</p> : null}

      <BudgetSpendPieChart
        year={year}
        month={month}
        spendingChartKeys={OVERVIEW_SPENDING_CHART_ORDER}
        spentByName={spentByName}
        budgets={budgets}
        labels={labels}
        totalInflow={data.total_inflow}
        totalOutflow={data.total_outflow}
      />

      <p className="budget-draft-total">
          Draft total allocated: <strong>{formatInr(draftTotalAllocated)}</strong>
      </p>

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
