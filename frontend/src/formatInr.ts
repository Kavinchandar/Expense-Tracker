/**
 * Indian numbering (lakhs/crores) with comma grouping for INR display.
 */
export function formatInr(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
