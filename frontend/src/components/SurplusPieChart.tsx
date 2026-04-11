import { useMemo, useState, type ReactNode } from "react";
import {
  SURPLUS_KEYS,
  SURPLUS_LABELS,
  type SurplusKey,
  type SurplusMonthlyRow,
} from "../api";
import { formatInr } from "../formatInr";

const UNALLOCATED_KEY = "__UNALLOCATED__";

/** Matches histogram / legend CSS */
const SLICE_FILL: Record<string, string> = {
  TERM_INSURANCE: "#2d6a8f",
  HEALTH_INSURANCE: "#3d8f6a",
  CONTINGENCY_FUND: "#b8860b",
  INVESTMENTS: "#6b4c9a",
  [UNALLOCATED_KEY]: "#9ca3af",
};

function polar(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

/** Pie sector from center (cx,cy) radius r, angles a0→a1 radians. */
function sectorPath(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number
): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  return [
    `M ${cx} ${cy}`,
    `L ${p0.x} ${p0.y}`,
    `A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`,
    "Z",
  ].join(" ");
}

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

type Props = {
  year: number;
  month: number;
  row: SurplusMonthlyRow | null;
  surplusBudgets: Record<string, number>;
};

export function SurplusPieChart({ year, month, row, surplusBudgets }: Props) {
  const monthLabel = `${MONTH_NAMES[month - 1] ?? month} ${year}`;

  const slices = useMemo(() => {
    if (!row) return [];
    const S = row.surplus;
    if (S <= 0) return [];
    const raw = envelopeSegments(S, surplusBudgets);
    return raw.filter((s) => s.amount > 0);
  }, [row, surplusBudgets]);

  const totalS = row?.surplus ?? 0;

  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const cx = 120;
  const cy = 120;
  const r = 108;

  const base = -Math.PI / 2;
  let cursor = 0;
  const arcs: ReactNode[] = [];
  for (const seg of slices) {
    const angle = (seg.amount / totalS) * Math.PI * 2;
    const a0 = base + cursor;
    const a1 = base + cursor + angle;
    const fill = SLICE_FILL[seg.key] ?? "#888";
    const isHover = hoveredKey === seg.key;
    const opacity = hoveredKey && !isHover ? 0.5 : 1;
    arcs.push(
      <g
        key={seg.key}
        style={{ cursor: "pointer", opacity, transition: "opacity 0.15s ease" }}
        onMouseEnter={() => setHoveredKey(seg.key)}
        onMouseLeave={() => setHoveredKey(null)}
      >
        <title>
          {seg.label}: {formatInr(seg.amount)} (
          {totalS > 0 ? Math.round((100 * seg.amount) / totalS) : 0}% of surplus)
        </title>
        <path
          d={sectorPath(cx, cy, r, a0, a1)}
          fill={fill}
          stroke="#fdfcfa"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </g>
    );
    cursor += angle;
  }

  const hovered = slices.find((s) => s.key === hoveredKey) ?? null;

  if (!row) {
    return (
      <div className="surplus-pie-block">
        <h4 className="surplus-pie-title">Surplus split (selected month)</h4>
        <p className="muted surplus-pie-sub">{monthLabel}</p>
        <p className="muted surplus-pie-empty">Load monthly data to see this month.</p>
      </div>
    );
  }

  if (totalS <= 0 || slices.length === 0) {
    return (
      <div className="surplus-pie-block">
        <h4 className="surplus-pie-title">Surplus split (selected month)</h4>
        <p className="muted surplus-pie-sub">{monthLabel}</p>
        <p className="muted surplus-pie-empty">
          No cash surplus this month (inflow minus outflow is zero or negative). Pie
          slices appear when surplus is positive.
        </p>
        <p className="muted surplus-pie-meta">
          In {formatInr(row.total_inflow)} · Out {formatInr(row.total_outflow)}
        </p>
      </div>
    );
  }

  return (
    <div className="surplus-pie-block">
      <h4 className="surplus-pie-title">Surplus split (selected month)</h4>
      <p className="muted surplus-pie-sub">{monthLabel}</p>
      <p className="muted surplus-pie-hint">
        Slice sizes show how this month&apos;s surplus is allocated across your
        targets (fixed order), then unallocated. Uses the same rules as the
        histogram stacks.
      </p>

      <div className="budget-pie-chart-stack">
        <div className="budget-pie-svg-wrap">
          <svg
            viewBox="0 0 240 240"
            className="budget-pie-svg"
            role="img"
            aria-label={`Surplus allocation pie for ${monthLabel}`}
          >
            <title>Surplus allocation for {monthLabel}</title>
            {arcs}
          </svg>
        </div>

        {hovered ? (
          <div className="budget-pie-floater" aria-live="polite">
            <div className="budget-pie-floater-title">{hovered.label}</div>
            <div className="budget-pie-floater-body">
              {formatInr(hovered.amount)} (
              {Math.round((100 * hovered.amount) / totalS)}% of{" "}
              {formatInr(totalS)} surplus)
            </div>
          </div>
        ) : (
          <p className="budget-pie-floater-placeholder muted">
            Hover a slice for amounts
          </p>
        )}
      </div>

      <ul className="surplus-pie-legend">
        {slices.map((seg) => {
          const dim = hoveredKey !== null && hoveredKey !== seg.key;
          return (
            <li key={seg.key}>
              <button
                type="button"
                className={`surplus-pie-legend-btn ${hoveredKey === seg.key ? "surplus-pie-legend-btn--on" : ""}`}
                style={{
                  borderLeftColor: SLICE_FILL[seg.key] ?? "#888",
                  opacity: dim ? 0.45 : 1,
                }}
                onMouseEnter={() => setHoveredKey(seg.key)}
                onMouseLeave={() => setHoveredKey(null)}
              >
                <span className="surplus-pie-legend-name">{seg.label}</span>
                <span className="surplus-pie-legend-amt">{formatInr(seg.amount)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
