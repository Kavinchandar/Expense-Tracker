import { useMemo, useState, type ReactNode } from "react";
import { SPENDING_CHART_ORDER } from "../bucketOrder";

type Props = {
  year: number;
  month: number;
  spentByName: Map<string, number>;
  budgets: Record<string, number>;
  labels: Record<string, string>;
  totalInflow: number;
  totalOutflow: number;
};

function formatInr(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

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
  hueIndex: number;
  kind: SegmentKind;
};

export function BudgetSpendPieChart({
  year,
  month,
  spentByName,
  budgets,
  labels,
  totalInflow,
  totalOutflow,
}: Props) {
  const cashSurplus = Math.max(0, totalInflow - totalOutflow);

  const { segments, mode, totalBudget, totalSpentBudgeted, unbudgetedSpent } =
    useMemo(() => {
      const rows = SPENDING_CHART_ORDER.map((key) => ({
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
        let hueIndex = 0;
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
            hueIndex: hueIndex++,
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
            hueIndex: hueIndex,
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
            hueIndex: hueIndex + 1,
            kind: "surplus",
          });
        }
        const totalSpentBudgeted = rows.reduce((s, r) => s + r.spent, 0);
        return {
          segments,
          mode: "budget" as const,
          totalBudget,
          totalSpentBudgeted,
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
                hueIndex: 0,
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

      let hueIndex = 0;
      const segments: Segment[] = spentRows.map((r) => ({
        key: r.key,
        label: r.label,
        budget: r.spent,
        spent: r.spent,
        angle: (r.spent / spentDenom) * Math.PI * 2,
        fillFrac: 1,
        overBudget: false,
        hueIndex: hueIndex++,
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
          hueIndex: hueIndex,
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
    }, [spentByName, budgets, labels, cashSurplus]);

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
      muted = hueMuted(seg.hueIndex);
      solid = hueForIndex(seg.hueIndex);
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
          fill is share used in each budget slice.
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
            Hover a slice for details
          </p>
        )}
      </div>

      <ul className="budget-pie-legend budget-pie-legend--below">
        {segments.map((seg) => (
          <li
            key={seg.key}
            className={
              hoveredKey === seg.key ? "budget-pie-legend-item--active" : undefined
            }
            onMouseEnter={() => setHoveredKey(seg.key)}
            onMouseLeave={() => setHoveredKey(null)}
          >
            <span
              className="budget-pie-swatch"
              style={{ background: swatchColor(seg) }}
            />
            <span className="budget-pie-legend-text">
              <span className="budget-pie-legend-name">{seg.label}</span>
              {legendLine(seg, chartMode)}
            </span>
          </li>
        ))}
      </ul>

      {mode === "budget" && totalBudget > 0 ? (
        <p className="budget-pie-footer muted">
          Total budgeted {formatInr(totalBudget)} · Spent in categories above{" "}
          {formatInr(totalSpentBudgeted)}
          {cashSurplus > 0
            ? ` · Surplus ${formatInr(cashSurplus)} (inflow ${formatInr(totalInflow)} − outflow ${formatInr(totalOutflow)})`
            : ""}
        </p>
      ) : mode === "spent_only" && cashSurplus > 0 ? (
        <p className="budget-pie-footer muted">
          Inflow {formatInr(totalInflow)} · Outflow {formatInr(totalOutflow)} · Surplus{" "}
          {formatInr(cashSurplus)}
        </p>
      ) : null}
    </div>
  );
}

function swatchColor(seg: Segment): string {
  if (seg.kind === "unbudgeted") return UNBUDGETED_SOLID;
  if (seg.kind === "surplus") return SURPLUS_SOLID;
  return hueForIndex(seg.hueIndex);
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

function legendLine(seg: Segment, mode: "budget" | "spent_only"): ReactNode {
  if (mode === "spent_only") {
    if (seg.kind === "surplus") {
      return (
        <span className="budget-pie-legend-num muted">
          {formatInr(seg.spent)} left after expenses
        </span>
      );
    }
    return <span className="budget-pie-legend-num muted">{formatInr(seg.spent)}</span>;
  }
  if (seg.kind === "surplus") {
    return (
      <span className="budget-pie-legend-num muted">
        {formatInr(seg.spent)} (inflow − outflow)
      </span>
    );
  }
  if (seg.key === "__unbudgeted__") {
    return <span className="budget-pie-legend-num muted">{formatInr(seg.spent)}</span>;
  }
  return (
    <span className="budget-pie-legend-num muted">
      {formatInr(seg.spent)} / {formatInr(seg.budget)}
      {seg.overBudget ? " (over)" : ""}
    </span>
  );
}
