import { useEffect, useMemo, useState } from "react";
import {
  getSurplusMonthly,
  getYearlyInsights,
  type SurplusMonthlyRow,
  type YearlyInsightsPayload,
} from "../api";
import { BOFA_USD_BALANCE, BOFA_USD_TO_INR } from "../bofaUsd";
import { formatInr } from "../formatInr";
import { YearlyCashHistogram } from "./YearlyCashHistogram";

type Props = { anchorYear: number };

/** Months to divide by for “avg / month”: full 12 for past years; Jan–current month for the current calendar year. */
function monthsForAverageDenominator(viewYear: number): number {
  const d = new Date();
  const cy = d.getFullYear();
  const cm = d.getMonth() + 1;
  if (viewYear < cy) return 12;
  if (viewYear > cy) return 12;
  return Math.max(1, cm);
}

const MONTH_SHORT = [
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

export function YearlyInsightsPanel({ anchorYear }: Props) {
  const [year, setYear] = useState(anchorYear);
  const [data, setData] = useState<YearlyInsightsPayload | null>(null);
  const [monthlySeries, setMonthlySeries] = useState<SurplusMonthlyRow[] | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setYear(anchorYear);
  }, [anchorYear]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    void Promise.all([getYearlyInsights(year), getSurplusMonthly(year, 12, 12)])
      .then(([d, m]) => {
        if (!cancelled) {
          setData(d);
          setMonthlySeries(m.series);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : String(e));
          setData(null);
          setMonthlySeries(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  const yearOptions = useMemo(() => {
    const cy = new Date().getFullYear();
    const start = cy - 12;
    const end = cy + 1;
    const out: number[] = [];
    for (let y = start; y <= end; y++) out.push(y);
    return out;
  }, []);

  const monthsInYear = useMemo(() => {
    if (!monthlySeries?.length) return [];
    return monthlySeries.filter((r) => r.year === year);
  }, [monthlySeries, year]);

  const totalSurplusYear = useMemo(
    () => monthsInYear.reduce((s, r) => s + r.surplus, 0),
    [monthsInYear]
  );

  const avgDenom = monthsForAverageDenominator(year);
  const avgMonthlySaving = totalSurplusYear / avgDenom;

  const bofaInr = BOFA_USD_BALANCE * BOFA_USD_TO_INR;

  const usdFormatted = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(BOFA_USD_BALANCE),
    []
  );

  const avgSavingFootnote = useMemo(() => {
    const d = new Date();
    const cy = d.getFullYear();
    const cm = d.getMonth() + 1;
    if (year < cy) {
      return `Total surplus for ${year} ÷ 12 (full year).`;
    }
    if (year > cy) {
      return `Total surplus ÷ 12 (projected over 12 months).`;
    }
    return `Year-to-date surplus ÷ ${avgDenom} (Jan–${MONTH_SHORT[cm - 1]} in ${year}; not ÷12 while the year is still in progress).`;
  }, [year, avgDenom]);

  return (
    <div className="yearly-insights">
      <h3 className="yearly-insights-title">Year at a glance</h3>
      <p className="muted yearly-insights-lede">
        Calendar-year totals, estimated balance from statements, surplus saved
        across the year, and a month-by-month view of money in, out, and surplus.
      </p>

      <label className="yearly-year-pick">
        <span className="yearly-year-pick-label">Year</span>
        <select
          className="yearly-year-select"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>

      {err ? <p className="error">{err}</p> : null}

      {loading ? (
        <p className="muted">Loading yearly summary…</p>
      ) : data && monthlySeries ? (
        <>
          <section className="yearly-bofa" aria-label="BOFA USD balance">
            <h4 className="yearly-bofa-title">Bank of America (USD)</h4>
            <p className="muted yearly-bofa-lede">
              Tracked outside Indian imports. Update balance in{" "}
              <code className="insights-code">bofaUsd.ts</code>; conversion uses{" "}
              <code className="insights-code">BOFA_USD_TO_INR</code> ({BOFA_USD_TO_INR}{" "}
              INR per USD).
            </p>
            <div className="yearly-bofa-row">
              <div>
                <p className="yearly-bofa-k">USD balance</p>
                <p className="yearly-bofa-usd">{usdFormatted}</p>
              </div>
              <div>
                <p className="yearly-bofa-k">Value in INR</p>
                <p className="yearly-bofa-inr">₹{formatInr(bofaInr)}</p>
                <p className="muted yearly-bofa-meta">
                  {BOFA_USD_BALANCE.toLocaleString("en-US")} USD × {BOFA_USD_TO_INR}{" "}
                  INR/USD
                </p>
              </div>
            </div>
          </section>

          <div className="yearly-stats-row">
            <div className="yearly-stat-card yearly-stat-card--worth">
              <p className="yearly-stat-label">Total net worth (est.)</p>
              <p className="yearly-stat-value">
                ₹
                {formatInr(
                  (data.total_worth ?? 0) + bofaInr
                )}
              </p>
              <p className="muted yearly-stat-foot yearly-nw-foot">
                {data.total_worth != null ? (
                  <>
                    <span className="yearly-nw-part">
                      ₹{formatInr(data.total_worth)} imports
                    </span>
                    <span className="yearly-nw-plus"> + </span>
                    <span className="yearly-nw-part">
                      ₹{formatInr(bofaInr)} BOFA
                    </span>
                    <span className="yearly-nw-eq"> = </span>
                    <span className="yearly-nw-sum">
                      ₹{formatInr((data.total_worth ?? 0) + bofaInr)}
                    </span>
                  </>
                ) : (
                  <>
                    No Indian running balance on file; total is BOFA only: ₹
                    {formatInr(bofaInr)}.
                  </>
                )}
              </p>
            </div>
            <div className="yearly-stat-card">
              <p className="yearly-stat-label">Total surplus ({year})</p>
              <p className="yearly-stat-value">{formatInr(totalSurplusYear)}</p>
              <p className="muted yearly-stat-foot">
                Sum of monthly surpluses (inflow − outflow, floored at zero).
              </p>
            </div>
            <div className="yearly-stat-card">
              <p className="yearly-stat-label">Avg saving / month</p>
              <p className="yearly-stat-value">{formatInr(avgMonthlySaving)}</p>
              <p className="muted yearly-stat-foot">{avgSavingFootnote}</p>
            </div>
          </div>

          <YearlyCashHistogram year={year} series={monthlySeries} />

          <div className="yearly-flow-block">
            <h4 className="yearly-flow-heading">Year cash movement</h4>
            <div className="yearly-flow-grid">
              <div className="yearly-flow-cell">
                <p className="yearly-flow-k">Money in</p>
                <p className="yearly-flow-n">{formatInr(data.total_inflow)}</p>
                <p className="muted yearly-flow-pct">
                  {data.inflow_pct_of_gross}% of movement
                </p>
              </div>
              <div className="yearly-flow-cell">
                <p className="yearly-flow-k">Money out</p>
                <p className="yearly-flow-n">{formatInr(data.total_outflow)}</p>
                <p className="muted yearly-flow-pct">
                  {data.outflow_pct_of_gross}% of movement
                </p>
              </div>
            </div>
            <div
              className="yearly-split-bar"
              role="img"
              style={
                data.gross_movement > 0
                  ? {
                      gridTemplateColumns: `${data.inflow_pct_of_gross}fr ${data.outflow_pct_of_gross}fr`,
                    }
                  : undefined
              }
              aria-label={`In ${data.inflow_pct_of_gross} percent, out ${data.outflow_pct_of_gross} percent`}
            >
              {data.gross_movement > 0 ? (
                <>
                  <span className="yearly-split-in" />
                  <span className="yearly-split-out" />
                </>
              ) : (
                <span className="yearly-split-empty muted">No activity this year</span>
              )}
            </div>
            <p className="muted yearly-flow-meta">
              Gross movement {formatInr(data.gross_movement)} · Net{" "}
              <strong className="yearly-net">{formatInr(data.net_flow)}</strong>{" "}
              (in − out)
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
