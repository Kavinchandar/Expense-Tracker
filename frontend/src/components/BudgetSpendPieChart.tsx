import { useMemo, useState, type ReactNode } from "react";
import { INFLOW_KEY, SPENDING_CHART_ORDER } from "../bucketOrder";
import { formatInr } from "../formatInr";

type Props = {
  year: number;
  month: number;
  /** Defaults to full `SPENDING_CHART_ORDER`; Overview omits FD/Investments. */
  spendingChartKeys?: readonly string[];
  spentByName: Map<string, number>;
  budgets: Record<string, number>;
  labels: Record<string, string>;
  totalInflow: number;
  totalOutflow: number;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function polar(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

/** Annulus sector from angle a0 to a1 (radians, increasing). */
function annulusPath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  a0: number,
  a1: number
): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p0o = polar(cx, cy, rOuter, a0);
  const p1o = polar(cx, cy, rOuter, a1);
  const p1i = polar(cx, cy, rInner, a1);
  const p0i = polar(cx, cy, rInner, a0);
  return [
    `M ${p0o.x} ${p0o.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${p1o.x} ${p1o.y}`,
    `L ${p1i.x} ${p1i.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${p0i.x} ${p0i.y}`,
    "Z",
  ].join(" ");
}

function hueForIndex(i: number): string {
  const h = (i * 47 + 18) % 360;
  return `hsl(${h} 52% 52%)`;
}

function hueMuted(i: number): string {
  const h = (i * 47 + 18) % 360;
  return `hsl(${h} 38% 88%)`;
}

const CHART_KEYS = SPENDING_CHART_ORDER as unknown as readonly string[];

/** Stable color index for category keys (matches progress cards). */
function categoryHueIndex(key: string): number {
  const i = CHART_KEYS.indexOf(key);
  return i >= 0 ? i : 0;
}

const UNBUDGETED_SOLID = "hsl(32 68% 42%)";
const UNBUDGETED_MUTED = "hsl(32 42% 90%)";
const SURPLUS_SOLID = "hsl(152 42% 40%)";
const SURPLUS_MUTED = "hsl(152 32% 90%)";

type SegmentKind = "normal" | "unbudgeted" | "surplus" | "spent_only";

type Segment = {
  key: string;
  label: string;
  budget: number;
  spent: number;
  angle: number;
  fillFrac: number;
  overBudget: boolean;
  kind: SegmentKind;
};

export function BudgetSpendPieChart({
  year,
  month,
  spendingChartKeys = SPENDING_CHART_ORDER,
  spentByName,
  budgets,
  labels,
  totalInflow,
  totalOutflow,
}: Props) {
  const cashSurplus = Math.max(0, totalInflow - totalOutflow);

  const spendingChartRows = useMemo(() => {
    return spendingChartKeys.map((key) => {
      const spent = spentByName.get(key) ?? 0;
      const budget = budgets[key] ?? 0;
      return {
        key,
        fullName: labels[key] ?? key,
        budget,
        spent,
      };
    }).filter((row) => row.spent > 0);
  }, [spentByName, budgets, labels, spendingChartKeys]);

  const inflowRow = useMemo(
    () => ({
      fullName: labels[INFLOW_KEY] ?? "InFlow",
      budget: budgets[INFLOW_KEY] ?? 0,
      received: spentByName.get(INFLOW_KEY) ?? 0,
    }),
    [spentByName, budgets, labels]
  );

  const { segments, mode, unbudgetedSpent } = useMemo(() => {
    const rows = spendingChartKeys.map((key) => ({
      key,
      label: labels[key] ?? key,
      budget: Math.max(0, budgets[key] ?? 0),
      spent: Math.max(0, spentByName.get(key) ?? 0),
    }));

    const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
    const unbudgetedSpent = rows
      .filter((r) => r.budget <= 0)
      .reduce((s, r) => s + r.spent, 0);

    const baseDenom = totalBudget + unbudgetedSpent;
    const surplusAdd = cashSurplus > 0 ? cashSurplus : 0;
    const denom = baseDenom + surplusAdd;

    if (denom > 0) {
      const segments: Segment[] = [];
      for (const r of rows) {
        if (r.budget <= 0) continue;
        const angle = (r.budget / denom) * Math.PI * 2;
        const fillFrac = r.budget > 0 ? Math.min(1, r.spent / r.budget) : 0;
        const overBudget = r.budget > 0 && r.spent > r.budget;
        segments.push({
          key: r.key,
          label: r.label,
          budget: r.budget,
          spent: r.spent,
          angle,
          fillFrac,
          overBudget,
          kind: "normal",
        });
      }
      if (unbudgetedSpent > 0) {
        segments.push({
          key: "__unbudgeted__",
          label: "Unbudgeted spend",
          budget: unbudgetedSpent,
          spent: unbudgetedSpent,
          angle: (unbudgetedSpent / denom) * Math.PI * 2,
          fillFrac: 1,
          overBudget: false,
          kind: "unbudgeted",
        });
      }
      if (cashSurplus > 0) {
        segments.push({
          key: "__surplus__",
          label: "Surplus",
          budget: cashSurplus,
          spent: cashSurplus,
          angle: (cashSurplus / denom) * Math.PI * 2,
          fillFrac: 1,
          overBudget: false,
          kind: "surplus",
        });
      }
      return {
        segments,
        mode: "budget" as const,
        totalBudget,
        totalSpentBudgeted: rows.reduce((s, r) => s + r.spent, 0),
        unbudgetedSpent,
      };
    }

    const spentRows = rows.filter((r) => r.spent > 0);
    const sumSpent = spentRows.reduce((s, r) => s + r.spent, 0);
    const spentDenom = sumSpent + (cashSurplus > 0 ? cashSurplus : 0);

    if (spentDenom <= 0) {
      if (cashSurplus > 0) {
        return {
          segments: [
            {
              key: "__surplus__",
              label: "Surplus",
              budget: cashSurplus,
              spent: cashSurplus,
              angle: Math.PI * 2,
              fillFrac: 1,
              overBudget: false,
              kind: "surplus",
            },
          ] as Segment[],
          mode: "spent_only" as const,
          totalBudget: 0,
          totalSpentBudgeted: 0,
          unbudgetedSpent: 0,
        };
      }
      return {
        segments: [] as Segment[],
        mode: "empty" as const,
        totalBudget: 0,
        totalSpentBudgeted: 0,
        unbudgetedSpent: 0,
      };
    }

    const segments: Segment[] = spentRows.map((r) => ({
      key: r.key,
      label: r.label,
      budget: r.spent,
      spent: r.spent,
      angle: (r.spent / spentDenom) * Math.PI * 2,
      fillFrac: 1,
      overBudget: false,
      kind: "spent_only" as const,
    }));

    if (cashSurplus > 0) {
      segments.push({
        key: "__surplus__",
        label: "Surplus",
        budget: cashSurplus,
        spent: cashSurplus,
        angle: (cashSurplus / spentDenom) * Math.PI * 2,
        fillFrac: 1,
        overBudget: false,
        kind: "surplus",
      });
    }

    return {
      segments,
      mode: "spent_only" as const,
      totalBudget: 0,
      totalSpentBudgeted: sumSpent,
      unbudgetedSpent: 0,
    };
  }, [spentByName, budgets, labels, cashSurplus, spendingChartKeys]);

  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const hoveredSeg = useMemo(
    () => segments.find((s) => s.key === hoveredKey) ?? null,
    [segments, hoveredKey]
  );

  const monthLabel = `${MONTH_NAMES[month - 1] ?? month} ${year}`;

  if (segments.length === 0) {
    return (
      <div className="budget-pie-block">
        <h4 className="budget-pie-title">Budget vs spent</h4>
        <p className="budget-pie-sub muted">{monthLabel}</p>
        <p className="muted budget-pie-empty">
          Set budgets or record spending this month to see the chart.
        </p>
      </div>
    );
  }

  const chartMode: "budget" | "spent_only" =
    mode === "spent_only" ? "spent_only" : "budget";

  const cx = 120;
  const cy = 120;
  const rOuter = 108;
  const rInner = 54;

  let cursor = 0;
  const base = -Math.PI / 2;

  const arcs: ReactNode[] = [];
  for (const seg of segments) {
    const a0 = base + cursor;
    const a1 = base + cursor + seg.angle;
    const fillEnd = a0 + seg.angle * seg.fillFrac;

    let muted: string;
    let solid: string;
    if (seg.kind === "unbudgeted") {
      muted = UNBUDGETED_MUTED;
      solid = UNBUDGETED_SOLID;
    } else if (seg.kind === "surplus") {
      muted = SURPLUS_MUTED;
      solid = SURPLUS_SOLID;
    } else {
      const hi = categoryHueIndex(seg.key);
      muted = hueMuted(hi);
      solid = hueForIndex(hi);
    }
    const overStroke = seg.overBudget ? "#a05048" : "none";
    const isHover = hoveredKey === seg.key;
    const opacity = hoveredKey && !isHover ? 0.45 : 1;

    arcs.push(
      <g
        key={seg.key}
        style={{ cursor: "pointer", opacity, transition: "opacity 0.15s ease" }}
        onMouseEnter={() => setHoveredKey(seg.key)}
        onMouseLeave={() => setHoveredKey(null)}
      >
        <title>{tooltipTitle(seg, chartMode)}</title>
        <path
          d={annulusPath(cx, cy, rInner, rOuter, a0, a1)}
          fill={muted}
          stroke={overStroke}
          strokeWidth={seg.overBudget ? 2.5 : 0}
          vectorEffect="non-scaling-stroke"
        />
        {seg.fillFrac > 0 && (
          <path
            d={annulusPath(cx, cy, rInner, rOuter, a0, fillEnd)}
            fill={solid}
            opacity={0.92}
          />
        )}
      </g>
    );
    cursor += seg.angle;
  }

  const aria =
    mode === "spent_only"
      ? `Spending mix for ${monthLabel} by category`
      : `Budget allocation for ${monthLabel} with spent amount filling each slice`;

  const hasSurplusSlice = segments.some((s) => s.key === "__surplus__");

  return (
    <div className="budget-pie-block">
      <h4 className="budget-pie-title">Budget vs spent</h4>
      <p className="budget-pie-sub muted">{monthLabel}</p>
      {mode === "spent_only" ? (
        <p className="budget-pie-hint muted">
          Slice sizes reflect spending (and surplus if inflow exceeds outflow). Set
          budgets to compare plan vs actual.
        </p>
      ) : (
        <p className="budget-pie-hint muted">
          Slice size is share of budget, unbudgeted spend, and cash surplus; darker
          fill is share used in each category. Hover the chart or a card—colors
          match.
          {unbudgetedSpent > 0
            ? " Tan slice is spending in categories with no budget."
            : ""}{" "}
          Green slice is surplus (inflow minus outflow).
        </p>
      )}

      <div className="budget-pie-chart-stack">
        <div className="budget-pie-svg-wrap">
          <svg
            viewBox="0 0 240 240"
            className="budget-pie-svg"
            role="img"
            aria-label={aria}
          >
            <title>{aria}</title>
            {arcs}
          </svg>
        </div>

        {hoveredSeg ? (
          <div className="budget-pie-floater" aria-live="polite">
            <div className="budget-pie-floater-title">{hoveredSeg.label}</div>
            <div className="budget-pie-floater-body">{floaterBody(hoveredSeg, chartMode)}</div>
          </div>
        ) : (
          <p className="budget-pie-floater-placeholder muted">
            Hover the chart or a category card below
          </p>
        )}
      </div>

      <div className="bucket-cards budget-pie-cards">
        {spendingChartRows.map((row) => {
          const { key, spent, budget, fullName } = row;
          const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
          const over = budget > 0 && spent > budget;
          const hi = categoryHueIndex(key);
          const accent = hueForIndex(hi);
          const dimOthers = hoveredKey !== null && hoveredKey !== key;
          return (
            <div
              key={key}
              className={`bucket-card ${over ? "bucket-card--over" : ""} ${
                dimOthers ? "bucket-card--dim" : ""
              } ${hoveredKey === key ? "bucket-card--linked" : ""}`}
              style={{ borderLeftColor: accent }}
              onMouseEnter={() => setHoveredKey(key)}
              onMouseLeave={() => setHoveredKey(null)}
            >
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
                    style={{
                      width: `${pct}%`,
                      background: over ? "#a05048" : accent,
                    }}
                  />
                </div>
              ) : (
                <p className="bucket-card-note muted">No budget set</p>
              )}
            </div>
          );
        })}
        <div
          className={`bucket-card bucket-card--inflow ${
            hoveredKey !== null && hoveredKey !== "__surplus__" ? "bucket-card--dim" : ""
          } ${hoveredKey === "__surplus__" ? "bucket-card--linked" : ""}`}
          onMouseEnter={() => setHoveredKey(hasSurplusSlice ? "__surplus__" : null)}
          onMouseLeave={() => setHoveredKey(null)}
        >
          <div className="bucket-card-title">{inflowRow.fullName}</div>
          <div className="bucket-card-figures">
            <span className="bucket-card-spent">{formatInr(inflowRow.received)}</span>
            <span className="bucket-card-sep"> / </span>
            <span className="bucket-card-budget">{formatInr(inflowRow.budget)}</span>
          </div>
          <p className="bucket-card-note muted">
            Received / target
            {hasSurplusSlice ? " · hover links to green surplus slice" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

function tooltipTitle(seg: Segment, mode: "budget" | "spent_only"): string {
  if (seg.kind === "surplus") {
    return `Surplus: ${formatInr(seg.spent)} (money left after expenses this month)`;
  }
  if (seg.kind === "unbudgeted") {
    return `Unbudgeted spend: ${formatInr(seg.spent)}`;
  }
  if (mode === "spent_only") {
    return `${seg.label}: ${formatInr(seg.spent)} spent`;
  }
  return `${seg.label}: ${formatInr(seg.spent)} spent of ${formatInr(seg.budget)} budget`;
}

function floaterBody(seg: Segment, mode: "budget" | "spent_only"): string {
  if (seg.kind === "surplus") {
    return `Cash left this month after all debits: ${formatInr(seg.spent)}.`;
  }
  if (seg.kind === "unbudgeted") {
    return `Spending in categories with no budget set: ${formatInr(seg.spent)}.`;
  }
  if (mode === "spent_only") {
    return `Spent this month: ${formatInr(seg.spent)}.`;
  }
  const pct = seg.budget > 0 ? Math.round((100 * seg.spent) / seg.budget) : 0;
  const line = `${formatInr(seg.spent)} of ${formatInr(seg.budget)} budget (${pct}% used).`;
  if (seg.overBudget) return `${line} Over budget.`;
  return line;
}
