export function formatHours(h: number): string {
  if (!Number.isFinite(h)) return "∞";
  if (h < 1) return `${(h * 60).toFixed(0)}m`;
  return h.toFixed(0);
}

export function formatRatio(r: number): string {
  if (!Number.isFinite(r)) return "∞";
  return r.toFixed(2);
}
