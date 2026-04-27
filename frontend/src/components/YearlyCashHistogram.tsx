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
 * One column per month: total height = money in; stacked bottom = money out, top = surplus.
 */
export function YearlyCashHistogram({ series, title = "Cash by month" }: Props) {
  const filtered = useMemo(() => series, [series]);

  const maxInflow = useMemo(() => {
    if (!filtered.length) return 1;
    const m = Math.max(...filtered.map((r) => r.total_inflow));
    return m > 0 ? m : 1;
  }, [filtered]);

  if (!filtered.length) {
    return (
      <p className="muted yearly-cash-empty">
        No transaction data for this range yet.
      </p>
    );
  }

  return (
    <div className="yearly-cash-histogram" role="img" aria-label="Cash by month">
      <h4 className="yearly-cash-title">{title}</h4>
      <p className="muted yearly-cash-lede">
        Each column&apos;s height is <strong>money in</strong> for that month (scaled to
        the largest inflow in the selected range. <span className="yearly-cash-legend-inline">
          <span className="yearly-swatch yearly-swatch--out" /> Money out
        </span>{" "}
        sits below{" "}
        <span className="yearly-cash-legend-inline">
          <span className="yearly-swatch yearly-swatch--surp" /> Surplus
        </span>{" "}
        (inflow minus outflow, floored at zero).
      </p>

      <ul className="yearly-cash-legend" aria-hidden>
        <li>
          <span className="yearly-swatch yearly-swatch--out" /> Money out
        </li>
        <li>
          <span className="yearly-swatch yearly-swatch--surp" /> Surplus
        </li>
        <li className="yearly-cash-legend-total">Column height = money in</li>
      </ul>

      <div className="surplus-histogram-frame">
        <div className="surplus-h-y-axis" aria-hidden="true">
          <span className="surplus-h-y-tick">{formatAxisMoney(maxInflow)}</span>
          <span className="surplus-h-y-tick">{formatAxisMoney(maxInflow / 2)}</span>
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
              const ti = row.total_inflow;
              const to = row.total_outflow;
              const sur = row.surplus;
              const ym = `${row.year}-${String(row.month).padStart(2, "0")}`;
              const Hpct = maxInflow > 0 ? (ti / maxInflow) * 100 : 0;
              const outFlex = ti > 0 ? Math.min(to, ti) : 0;
              const surFlex = ti > 0 ? sur : 0;
              const tip = `In ${formatInr(ti)} · Out ${formatInr(to)} · Surplus ${formatInr(sur)}`;

              return (
                <div key={ym} className="surplus-h-col" title={tip}>
                  <div className="surplus-h-col-chart">
                    {ti <= 0 ? (
                      <div className="surplus-h-bar-stub" aria-hidden />
                    ) : (
                      <div
                        className="yearly-cash-stack"
                        style={{ height: `${Hpct}%` }}
                      >
                        <div
                          className="yearly-cash-seg yearly-cash-seg--out"
                          style={{
                            flex: `${outFlex} 1 0`,
                            minHeight: outFlex > 0 ? "2px" : "0",
                          }}
                        />
                        <div
                          className="yearly-cash-seg yearly-cash-seg--surp"
                          style={{
                            flex: `${surFlex} 1 0`,
                            minHeight: surFlex > 0 ? "2px" : "0",
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <span className="surplus-h-x-label">
                    {formatShortYm(row.year, row.month)}
                  </span>
                  <span className="surplus-h-x-value muted">{formatInr(ti)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
