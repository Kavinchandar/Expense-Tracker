import { useEffect, useMemo, useState } from "react";
import { getYearlyInsights, type YearlyInsightsPayload } from "../api";
import { formatInr } from "../formatInr";

type Props = { anchorYear: number };

export function YearlyInsightsPanel({ anchorYear }: Props) {
  const [year, setYear] = useState(anchorYear);
  const [data, setData] = useState<YearlyInsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setYear(anchorYear);
  }, [anchorYear]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    void getYearlyInsights(year)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : String(e));
          setData(null);
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

  return (
    <div className="yearly-insights">
      <h3 className="yearly-insights-title">Year at a glance</h3>
      <p className="muted yearly-insights-lede">
        High-level totals from every imported line in the calendar year.
        Percentages show how money in and money out compare to total movement
        (in + out).
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
      ) : data ? (
        <>
          <div className="yearly-worth-card">
            <p className="yearly-worth-label">Total worth (est.)</p>
            <p className="yearly-worth-value">
              {data.total_worth != null ? (
                formatInr(data.total_worth)
              ) : (
                <span className="muted">—</span>
              )}
            </p>
            <p className="muted yearly-worth-foot">
              {data.total_worth != null
                ? "Latest running balance from your statement lines on or before the end of this year."
                : "No running balances in this window yet—use PDFs that include an account balance column."}
            </p>
          </div>

          <div className="yearly-flow-block">
            <h4 className="yearly-flow-heading">Cash movement</h4>
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
