import { useEffect, useMemo, useState } from "react";
import {
  getSurplusMonthly,
  getYearlyInsights,
  type SurplusMonthlyRow,
  type YearlyInsightsPayload,
} from "../api";
import { USD_BALANCE, USD_TO_INR } from "../usdBalance";
import { formatInr } from "../formatInr";
import { YearlyCashHistogram } from "./YearlyCashHistogram";
import { YearlyPfHistogram } from "./YearlyPfHistogram";

type Props = { anchorYear: number };

function parseYearMonth(ym: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(ym.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (month < 1 || month > 12) return null;
  return { year, month };
}

function monthKey(year: number, month: number): number {
  return year * 12 + (month - 1);
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
  const [startYm, setStartYm] = useState(`${anchorYear}-01`);
  const [endYm, setEndYm] = useState(`${anchorYear}-12`);
  const [data, setData] = useState<YearlyInsightsPayload | null>(null);
  const [monthlySeries, setMonthlySeries] = useState<SurplusMonthlyRow[] | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setStartYm(`${anchorYear}-01`);
    setEndYm(`${anchorYear}-12`);
  }, [anchorYear]);

  const range = useMemo(() => {
    const start = parseYearMonth(startYm);
    const end = parseYearMonth(endYm);
    if (!start || !end) return null;
    const sKey = monthKey(start.year, start.month);
    const eKey = monthKey(end.year, end.month);
    if (sKey > eKey) return null;
    const months = eKey - sKey + 1;
    return {
      start,
      end,
      months,
      label: `${MONTH_SHORT[start.month - 1]} ${start.year} - ${MONTH_SHORT[end.month - 1]} ${end.year}`,
    };
  }, [startYm, endYm]);

  useEffect(() => {
    if (!range) {
      setErr("Choose a valid range where From month is before or same as To month.");
      setData(null);
      setMonthlySeries(null);
      setLoading(false);
      return;
    }
    if (range.months > 120) {
      setErr("Range is too large. Please keep it within 120 months.");
      setData(null);
      setMonthlySeries(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    void Promise.all([
      getYearlyInsights(range.end.year),
      getSurplusMonthly(range.end.year, range.end.month, range.months),
    ])
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
  }, [range]);

  const monthsInRange = useMemo(() => monthlySeries ?? [], [monthlySeries]);

  const rangeInflow = useMemo(
    () => monthsInRange.reduce((s, r) => s + r.total_inflow, 0),
    [monthsInRange]
  );
  const rangeOutflow = useMemo(
    () => monthsInRange.reduce((s, r) => s + r.total_outflow, 0),
    [monthsInRange]
  );
  const rangeGross = rangeInflow + rangeOutflow;
  const rangeNet = rangeInflow - rangeOutflow;
  /** Same rule as all-time surplus: max(0, in − out), not sum of per-month floors. */
  const rangeNetSurplus = Math.max(0, rangeNet);

  const avgDenom = Math.max(1, range?.months ?? 1);
  const avgMonthlySaving = rangeNetSurplus / avgDenom;
  const rangeInPct = rangeGross > 0 ? Number(((100 * rangeInflow) / rangeGross).toFixed(1)) : 0;
  const rangeOutPct = rangeGross > 0 ? Number(((100 * rangeOutflow) / rangeGross).toFixed(1)) : 0;

  const usdInrValue = USD_BALANCE * USD_TO_INR;

  /** All-time surplus + USD converted to INR + cumulative employee PF. */
  const totalNetWorthCombo = useMemo(
    () =>
      (data?.all_time_surplus ?? 0) +
      usdInrValue +
      (data?.pf_cumulative_all_time ?? 0),
    [data?.all_time_surplus, data?.pf_cumulative_all_time, usdInrValue]
  );

  const rangePfTotal = useMemo(
    () =>
      monthsInRange.reduce((s, r) => s + (r.pf != null ? r.pf : 0), 0),
    [monthsInRange]
  );

  const usdFormatted = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(USD_BALANCE),
    []
  );

  const avgSavingFootnote = useMemo(
    () =>
      range
        ? `Range net surplus ÷ ${avgDenom} months (${range.label}).`
        : "",
    [range, avgDenom]
  );

  return (
    <div className="yearly-insights">
      <h3 className="yearly-insights-title">Year at a glance</h3>
      <p className="muted yearly-insights-lede">
        USD, available-to-spend balance, all-time net worth (including PF), and
        yearly surplus at a glance—plus cash movement and charts below.
      </p>

      <div className="yearly-range-pick">
        <label className="yearly-year-pick">
          <span className="yearly-year-pick-label">From</span>
          <input
            className="yearly-year-select"
            type="month"
            value={startYm}
            onChange={(e) => setStartYm(e.target.value)}
          />
        </label>
        <label className="yearly-year-pick">
          <span className="yearly-year-pick-label">To</span>
          <input
            className="yearly-year-select"
            type="month"
            value={endYm}
            onChange={(e) => setEndYm(e.target.value)}
          />
        </label>
      </div>

      {err ? <p className="error">{err}</p> : null}

      {loading ? (
        <p className="muted">Loading yearly summary…</p>
      ) : data && monthlySeries ? (
        <>
          <div className="yearly-stats-row yearly-stats-row--five">
            <div className="yearly-stat-card">
              <p className="yearly-stat-label">Amount available to spend</p>
              <p className="yearly-stat-value">
                ₹{formatInr(data.available_to_spend)}
              </p>
              <p className="muted yearly-stat-foot">
                Latest imported running balance; fallback excludes FDs/MFs from
                surplus when no running balance is available.
              </p>
            </div>
            <div className="yearly-stat-card yearly-stat-card--worth">
              <p className="yearly-stat-label">Total net worth</p>
              <p className="yearly-stat-value">₹{formatInr(totalNetWorthCombo)}</p>
              <p className="muted yearly-stat-foot">
                All-time surplus ₹{formatInr(data.all_time_surplus)} + USD ₹
                {formatInr(usdInrValue)} + PF ₹
                {formatInr(data.pf_cumulative_all_time ?? 0)}
              </p>
            </div>
            <div className="yearly-stat-card">
              <p className="yearly-stat-label">Surplus ({range?.label ?? "range"})</p>
              <p className="yearly-stat-value">₹{formatInr(rangeNetSurplus)}</p>
              <p className="muted yearly-stat-foot">
                Money in minus money out in this range, floored at zero—same rule as
                all-time surplus, limited to the months you selected.
              </p>
            </div>
            <div className="yearly-stat-card">
              <p className="yearly-stat-label">Avg savings / month</p>
              <p className="yearly-stat-value">{formatInr(avgMonthlySaving)}</p>
              <p className="muted yearly-stat-foot">{avgSavingFootnote}</p>
            </div>
          </div>

          <div className="yearly-card-groups">
            <section
              className="yearly-card-section"
              aria-labelledby="yearly-group-fd-mf-usd"
            >
              <h4 className="yearly-card-section-title" id="yearly-group-fd-mf-usd">
                Investments, contingency funds and long-term wealth
              </h4>
              <div className="yearly-stats-row yearly-stats-row--three">
                <div className="yearly-stat-card">
                  <p className="yearly-stat-label">FDs (all time)</p>
                  <p className="yearly-stat-value">
                    ₹{formatInr(data.fd_debits_all_time)}
                  </p>
                  <p className="muted yearly-stat-foot">
                    Gross debit amount tagged as FDS across all imported data.
                  </p>
                </div>
                <div className="yearly-stat-card">
                  <p className="yearly-stat-label">MF (all time)</p>
                  <p className="yearly-stat-value">
                    ₹{formatInr(data.mf_debits_all_time)}
                  </p>
                  <p className="muted yearly-stat-foot">
                    Gross debit amount tagged as Mutual funds across all imported
                    data.
                  </p>
                </div>
                <div className="yearly-stat-card yearly-stat-card--usd">
                  <p className="yearly-stat-label">USD</p>
                  <p className="yearly-stat-value">₹{formatInr(usdInrValue)}</p>
                  <p className="yearly-stat-sub muted">{usdFormatted}</p>
                  <p className="muted yearly-stat-foot">
                    Update USD balance in{" "}
                    <code className="insights-code">usdBalance.ts</code> ·{" "}
                    {USD_TO_INR} INR/USD
                  </p>
                </div>
              </div>
            </section>

            <section className="yearly-card-section" aria-labelledby="yearly-group-pf">
              <h4 className="yearly-card-section-title" id="yearly-group-pf">
                Non-liquid pension savings
              </h4>
              <div className="yearly-stats-row yearly-stats-row--single">
                <div className="yearly-stat-card yearly-stat-card--pf">
                  <p className="yearly-stat-label">PF</p>
                  <p className="yearly-stat-value">
                    ₹{formatInr(data.pf_cumulative_all_time ?? 0)}
                  </p>
                  <p className="muted yearly-stat-foot">
                    Employee PF at 12% of basic (Aug 2025–Mar 2026 vs Apr 2026+ bands),
                    cumulative only through today&apos;s month (no future months)—not
                    from bank imports.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <YearlyCashHistogram
            series={monthlySeries}
            title={`Cash by month (${range?.label ?? "range"})`}
          />

          <YearlyPfHistogram
            series={monthlySeries}
            title={`PF by month (${range?.label ?? "range"}) · range total ₹${formatInr(rangePfTotal)}`}
          />

          <div className="yearly-flow-block">
            <h4 className="yearly-flow-heading">Year cash movement</h4>
            <div className="yearly-flow-grid">
              <div className="yearly-flow-cell">
                <p className="yearly-flow-k">Money in</p>
                <p className="yearly-flow-n">{formatInr(rangeInflow)}</p>
                <p className="muted yearly-flow-pct">
                  {rangeInPct}% of movement
                </p>
              </div>
              <div className="yearly-flow-cell">
                <p className="yearly-flow-k">Money out</p>
                <p className="yearly-flow-n">{formatInr(rangeOutflow)}</p>
                <p className="muted yearly-flow-pct">
                  {rangeOutPct}% of movement
                </p>
              </div>
            </div>
            <div
              className="yearly-split-bar"
              role="img"
              style={
                rangeGross > 0
                  ? {
                      gridTemplateColumns: `${rangeInPct}fr ${rangeOutPct}fr`,
                    }
                  : undefined
              }
              aria-label={`In ${rangeInPct} percent, out ${rangeOutPct} percent`}
            >
              {rangeGross > 0 ? (
                <>
                  <span className="yearly-split-in" />
                  <span className="yearly-split-out" />
                </>
              ) : (
                <span className="yearly-split-empty muted">No activity this year</span>
              )}
            </div>
            <p className="muted yearly-flow-meta">
              Gross movement {formatInr(rangeGross)} · Net{" "}
              <strong className="yearly-net">{formatInr(rangeNet)}</strong>{" "}
              (in − out)
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
