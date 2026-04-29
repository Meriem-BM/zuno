/** Human-readable token amount given raw integer string and decimals. */
export function formatAmount(raw: string, decimals: number, precision = 4): string {
  if (raw === "0") return "0";
  const n = BigInt(raw);
  const base = 10n ** BigInt(decimals);
  const whole = n / base;
  const frac = n % base;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, precision).replace(/0+$/, "");
  return fracStr.length > 0 ? `${whole.toString()}.${fracStr}` : whole.toString();
}

/** Format a price for display, with `,` thousands and 2 decimals. */
export function formatPrice(p: number): string {
  if (!Number.isFinite(p)) return "-";
  if (p >= 1) {
    return p.toLocaleString("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  }
  return p.toLocaleString("en-US", { maximumFractionDigits: 6 });
}
