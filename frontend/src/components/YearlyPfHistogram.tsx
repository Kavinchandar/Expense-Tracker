import { useMemo } from "react";
import type { SurplusMonthlyRow } from "../api";
import { formatInr } from "../formatInr";

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

function formatShortYm(y: number, m: number): string {
  return `${SHORT_MONTHS[m - 1]} '${String(y).slice(2)}`;
}

function formatAxisMoney(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return formatInr(Math.round(n));
}

type Props = {
  series: SurplusMonthlyRow[];
  title?: string;
};

/**
 * One column per month: employee PF (12% of basic), when applicable.
 */
export function YearlyPfHistogram({ series, title = "PF by month" }: Props) {
  const filtered = useMemo(() => series, [series]);

  const maxPf = useMemo(() => {
    const amounts = filtered
      .map((r) => r.pf)
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (!amounts.length) return 1;
    const m = Math.max(...amounts);
    return m > 0 ? m : 1;
  }, [filtered]);

  const hasAnyPf = useMemo(
    () => filtered.some((r) => r.pf != null && r.pf > 0),
    [filtered]
  );

  if (!filtered.length) {
    return null;
  }

  return (
    <div className="yearly-pf-histogram" role="img" aria-label="PF by month">
      <h4 className="yearly-cash-title">{title}</h4>
      <p className="muted yearly-cash-lede">
        Employee PF at 12% of basic (outside bank imports). Months before Aug 2025
        or after the current calendar month show no amount.
      </p>

      <ul className="yearly-cash-legend" aria-hidden>
        <li>
          <span className="yearly-swatch yearly-swatch--pf" /> PF contribution
        </li>
      </ul>

      <div className="surplus-histogram-frame">
        <div className="surplus-h-y-axis" aria-hidden="true">
          <span className="surplus-h-y-tick">{formatAxisMoney(maxPf)}</span>
          <span className="surplus-h-y-tick">{formatAxisMoney(maxPf / 2)}</span>
          <span className="surplus-h-y-tick">0</span>
        </div>
        <div className="surplus-h-plot-wrap">
          <div className="surplus-h-grid" aria-hidden="true">
            <span className="surplus-h-grid-line" />
            <span className="surplus-h-grid-line" />
            <span className="surplus-h-grid-line surplus-h-grid-line--base" />
          </div>
          <div className="surplus-h-cols">
            {filtered.map((row) => {
              const pf = row.pf;
              const ym = `${row.year}-${String(row.month).padStart(2, "0")}`;
              const Hpct =
                pf != null && maxPf > 0 ? (pf / maxPf) * 100 : 0;
              const tip =
                pf != null
                  ? `PF ${formatInr(pf)}`
                  : "No PF tracking this month";

              return (
                <div key={ym} className="surplus-h-col" title={tip}>
                  <div className="surplus-h-col-chart">
                    {pf == null || pf <= 0 ? (
                      <div className="surplus-h-bar-stub" aria-hidden />
                    ) : (
                      <div
                        className="yearly-pf-bar"
                        style={{ height: `${Hpct}%` }}
                      />
                    )}
                  </div>
                  <span className="surplus-h-x-label">
                    {formatShortYm(row.year, row.month)}
                  </span>
                  <span className="surplus-h-x-value muted">
                    {pf != null ? formatInr(pf) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {!hasAnyPf ? (
        <p className="muted yearly-cash-empty">
          No PF in this range (all months are before Aug 2025).
        </p>
      ) : null}
    </div>
  );
}
