import { useEffect, useMemo, useState } from "react";
import {
  getSurplusMonthly,
  saveSurplusBudgets,
  SURPLUS_KEYS,
  SURPLUS_LABELS,
  type SurplusKey,
  type SurplusMonthlyRow,
} from "../api";
import { formatInr } from "../formatInr";
import { SurplusPieChart } from "./SurplusPieChart";

const UNALLOCATED_KEY = "__UNALLOCATED__";

const SEGMENT_CLASS: Record<string, string> = {
  TERM_INSURANCE: "surplus-seg--term",
  HEALTH_INSURANCE: "surplus-seg--health",
  CONTINGENCY_FUND: "surplus-seg--contingency",
  INVESTMENTS: "surplus-seg--invest",
  [UNALLOCATED_KEY]: "surplus-seg--unallocated",
};

function envelopeSegments(
  surplus: number,
  targets: Record<string, number>
): { key: string; amount: number; label: string }[] {
  let remaining = surplus;
  const out: { key: string; amount: number; label: string }[] = [];
  for (const k of SURPLUS_KEYS) {
    const cap = targets[k] ?? 0;
    const take = Math.min(remaining, Math.max(0, cap));
    out.push({
      key: k,
      amount: take,
      label: SURPLUS_LABELS[k as SurplusKey],
    });
    remaining -= take;
  }
  if (remaining > 0) {
    out.push({
      key: UNALLOCATED_KEY,
      amount: remaining,
      label: "Unallocated",
    });
  }
  return out;
}

function formatYm(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function formatShortYm(year: number, month: number): string {
  return `${SHORT_MONTHS[month - 1]} '${String(year).slice(2)}`;
}

function formatAxisMoney(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return formatInr(Math.round(n));
}

type Props = {
  year: number;
  month: number;
  surplusBudgets: Record<string, number>;
  onSurplusBudgetsSaved: (budgets: Record<string, number>) => void;
};

export function SurplusPanel({
  year,
  month,
  surplusBudgets,
  onSurplusBudgetsSaved,
}: Props) {
  const [lookback, setLookback] = useState(12);
  const [seriesLoading, setSeriesLoading] = useState(true);
  const [seriesErr, setSeriesErr] = useState<string | null>(null);
  const [series, setSeries] = useState<SurplusMonthlyRow[] | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    setSeriesLoading(true);
    setSeriesErr(null);
    void getSurplusMonthly(year, month, lookback)
      .then((data) => {
        if (!cancelled) setSeries(data.series);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setSeriesErr(e instanceof Error ? e.message : String(e));
          setSeries(null);
        }
      })
      .finally(() => {
        if (!cancelled) setSeriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, month, lookback]);

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

  const legendItems = useMemo(
    () => [
      ...SURPLUS_KEYS.map((k) => ({
        key: k,
        label: SURPLUS_LABELS[k],
        className: SEGMENT_CLASS[k],
      })),
      {
        key: UNALLOCATED_KEY,
        label: "Unallocated",
        className: SEGMENT_CLASS[UNALLOCATED_KEY],
      },
    ],
    []
  );

  const maxSurplus = useMemo(() => {
    if (!series?.length) return 1;
    const m = Math.max(...series.map((r) => r.surplus));
    return m > 0 ? m : 1;
  }, [series]);

  /** Row for the month selected in the app toolbar (end of the API window). */
  const selectedMonthRow = useMemo(() => {
    if (!series?.length) return null;
    return (
      series.find((r) => r.year === year && r.month === month) ??
      series[series.length - 1] ??
      null
    );
  }, [series, year, month]);

  return (
    <div className="surplus-panel">
      <h3 className="surplus-panel-title">Surplus histogram</h3>
      <p className="muted surplus-panel-lede">
        The pie uses the month from the toolbar. The histogram shows a range
        ending on that month: cash surplus per month (inflow minus outflow, floored
        at zero), with column height scaled to the largest surplus in the window.
        Both use your global targets in fixed order; remainder is unallocated.
      </p>

      <div className="surplus-controls">
        <label className="surplus-lookback">
          <span className="surplus-lookback-label">Months in chart</span>
          <select
            className="surplus-lookback-select"
            value={lookback}
            onChange={(e) => setLookback(Number(e.target.value))}
          >
            <option value={6}>6</option>
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={36}>36</option>
          </select>
        </label>
      </div>

      {!seriesLoading && series ? (
        <SurplusPieChart
          year={year}
          month={month}
          row={selectedMonthRow}
          surplusBudgets={surplusBudgets}
        />
      ) : null}

      {seriesErr ? <p className="error">{seriesErr}</p> : null}

      {seriesLoading ? (
        <p className="muted">Loading monthly surplus…</p>
      ) : series && series.length > 0 ? (
        <>
          <ul className="surplus-legend">
            {legendItems.map((item) => (
              <li key={item.key} className="surplus-legend-item">
                <span
                  className={`surplus-legend-swatch ${item.className}`}
                />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>

          <div
            className="surplus-histogram"
            role="img"
            aria-label="Surplus histogram by month"
          >
            <div className="surplus-histogram-frame">
              <div className="surplus-h-y-axis" aria-hidden="true">
                <span className="surplus-h-y-tick">
                  {formatAxisMoney(maxSurplus)}
                </span>
                <span className="surplus-h-y-tick">
                  {formatAxisMoney(maxSurplus / 2)}
                </span>
                <span className="surplus-h-y-tick">0</span>
              </div>
              <div className="surplus-h-plot-wrap">
                <div className="surplus-h-grid" aria-hidden="true">
                  <span className="surplus-h-grid-line" />
                  <span className="surplus-h-grid-line" />
                  <span className="surplus-h-grid-line surplus-h-grid-line--base" />
                </div>
                <div className="surplus-h-cols">
                  {series.map((row) => {
                    const S = row.surplus;
                    const segments = envelopeSegments(S, surplusBudgets);
                    const ym = formatYm(row.year, row.month);
                    const tip = `In ${formatInr(row.total_inflow)} · Out ${formatInr(row.total_outflow)} · Surplus ${formatInr(S)}`;
                    return (
                      <div key={ym} className="surplus-h-col" title={tip}>
                        <div className="surplus-h-col-chart">
                          {S <= 0 ? (
                            <div className="surplus-h-bar-stub" aria-hidden />
                          ) : (
                            <div
                              className="surplus-h-stack"
                              style={{
                                height: `${(S / maxSurplus) * 100}%`,
                              }}
                            >
                              {segments.map((seg) => (
                                <div
                                  key={`${ym}-${seg.key}`}
                                  className={`surplus-h-seg ${SEGMENT_CLASS[seg.key] ?? ""}`}
                                  style={{
                                    flex: `${seg.amount} 1 0`,
                                    minHeight: seg.amount > 0 ? "2px" : "0",
                                  }}
                                  title={`${seg.label}: ${formatInr(seg.amount)} (${ym})`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="surplus-h-x-label">
                          {formatShortYm(row.year, row.month)}
                        </span>
                        <span className="surplus-h-x-value muted">{formatInr(S)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {saveErr ? <p className="error">{saveErr}</p> : null}

      <details className="budget-edit surplus-budget-edit">
        <summary>
          Edit global surplus targets — one amount per category for all months (the
          month picker only changes which month ends the chart and validates the save
          request)
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
    </div>
  );
}
