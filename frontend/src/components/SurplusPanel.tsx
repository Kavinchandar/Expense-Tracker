import { useEffect, useState } from "react";
import {
  getSurplusMonthly,
  saveSurplusBudgets,
  SURPLUS_ALLOCATION_TX_CATEGORIES,
  SURPLUS_KEYS,
  SURPLUS_LABELS,
  type SurplusMonthlyRow,
  type TransactionsPayload,
} from "../api";
import { BucketList } from "./BucketList";
import { SurplusPieChart } from "./SurplusPieChart";

type Props = {
  year: number;
  month: number;
  surplusBudgets: Record<string, number>;
  onSurplusBudgetsSaved: (budgets: Record<string, number>) => void;
  tx: TransactionsPayload | null;
  txLoading: boolean;
  txError: string | null;
  categories: string[];
  categoryLabels: Record<string, string>;
  assignCategory: (transactionId: string, category: string) => Promise<void>;
  assignDetail: (transactionId: string, detail: string) => Promise<void>;
  onDeleteTransaction: (transactionId: string) => Promise<void>;
  onRestoreTransaction: (transactionId: string) => Promise<void>;
};

export function SurplusPanel({
  year,
  month,
  surplusBudgets,
  onSurplusBudgetsSaved,
  tx,
  txLoading,
  txError,
  categories,
  categoryLabels,
  assignCategory,
  assignDetail,
  onDeleteTransaction,
  onRestoreTransaction,
}: Props) {
  const [seriesLoading, setSeriesLoading] = useState(true);
  const [seriesErr, setSeriesErr] = useState<string | null>(null);
  const [pieRow, setPieRow] = useState<SurplusMonthlyRow | null>(null);

  const [edit, setEdit] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const k of SURPLUS_KEYS) {
      next[k] = String(surplusBudgets[k] ?? 0);
    }
    setEdit(next);
  }, [surplusBudgets]);

  /** Single month for the toolbar — drives the allocation pie. */
  useEffect(() => {
    let cancelled = false;
    setSeriesLoading(true);
    setSeriesErr(null);
    void getSurplusMonthly(year, month, 1)
      .then((data) => {
        if (!cancelled) {
          const row = data.series[0] ?? null;
          setPieRow(
            row && row.year === year && row.month === month ? row : null
          );
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setSeriesErr(e instanceof Error ? e.message : String(e));
          setPieRow(null);
        }
      })
      .finally(() => {
        if (!cancelled) setSeriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  const onSave = async () => {
    setSaveErr(null);
    const payload: Record<string, number> = {};
    for (const k of SURPLUS_KEYS) {
      const raw = edit[k]?.trim() ?? "0";
      const n = parseFloat(raw.replace(/,/g, ""));
      if (Number.isNaN(n) || n < 0) {
        setSaveErr(`Invalid amount for ${SURPLUS_LABELS[k]}`);
        return;
      }
      payload[k] = n;
    }
    setSaving(true);
    try {
      const res = await saveSurplusBudgets(year, month, payload);
      onSurplusBudgetsSaved(res.budgets);
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="surplus-panel">
      <h3 className="surplus-panel-title">Surplus allocation</h3>
      <p className="muted surplus-panel-lede">
        Split the selected month&apos;s cash surplus across your global targets
        (pie). FD and investment transactions are listed below; their debits are
        excluded from consumption outflow. Month-by-month cash in, out, and surplus
        is on the <strong>Year</strong> tab.
      </p>

      {seriesErr ? <p className="error">{seriesErr}</p> : null}

      {seriesLoading ? (
        <p className="muted">Loading…</p>
      ) : (
        <SurplusPieChart
          year={year}
          month={month}
          row={pieRow}
          surplusBudgets={surplusBudgets}
        />
      )}

      {saveErr ? <p className="error">{saveErr}</p> : null}

      <details className="budget-edit surplus-budget-edit">
        <summary>
          Edit global surplus targets — one amount per category for all months (the
          month picker validates the save request)
        </summary>
        <div className="budget-edit-grid">
          {SURPLUS_KEYS.map((key) => (
            <label key={key} className="budget-edit-row">
              <span className="budget-edit-label">{SURPLUS_LABELS[key]}</span>
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
          {saving ? "Saving…" : "Save surplus targets"}
        </button>
      </details>

      <BucketList
        data={tx}
        loading={txLoading}
        error={txError}
        categories={categories}
        categoryLabels={categoryLabels}
        assignCategory={assignCategory}
        assignDetail={assignDetail}
        onDeleteTransaction={onDeleteTransaction}
        onRestoreTransaction={onRestoreTransaction}
        onlyCategories={SURPLUS_ALLOCATION_TX_CATEGORIES}
      />
    </div>
  );
}
