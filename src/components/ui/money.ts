/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/** Money formatting (component-specs §20): en-IN grouping (₹1,00,000), INR by default. */
export interface FormatMoneyOptions {
  currency?: string;
  /** ₹1.2L / ₹75K for chart axes and tight spaces. */
  compact?: boolean;
  /** "+₹1,200" / "-₹300" for deltas. */
  showSign?: boolean;
}

export function formatMoney(amount: number | null | undefined, { currency = "INR", compact = false, showSign = false }: FormatMoneyOptions = {}): string {
  const value = Number(amount ?? 0);
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    minimumFractionDigits: 0,
    maximumFractionDigits: compact ? 1 : Number.isInteger(safe) ? 0 : 2,
    signDisplay: showSign ? "exceptZero" : "auto",
  }).format(safe);
}

/** Plain numbers with Indian grouping (12,34,567). */
export function formatCount(value: number | null | undefined, compact = false): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(Number.isFinite(n) ? n : 0);
}

/** "+6.7%" / "-2.0%" / "0.0%". Input is already a percentage (6.7 means 6.7%). */
export function formatDelta(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}
