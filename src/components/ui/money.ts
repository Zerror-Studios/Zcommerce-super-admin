/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/** Number formatting (docs/design/05-wording.md §2): en-IN grouping (₹4,82,650), INR by default. */
export interface FormatMoneyOptions {
  currency?: string;
  /** ₹25k / ₹1.2L / ₹3.4Cr for chart axes and tight spaces. */
  compact?: boolean;
  /** "+₹1,200" / "−₹300" for deltas. */
  showSign?: boolean;
  /** Always 2 decimals (finance, invoices, transactions): ₹49.50. */
  paise?: boolean;
  /** Whole rupees only (summaries, KPIs): ₹52,500. */
  whole?: boolean;
}

const MINUS = "−";

/** Typographic minus before the currency sign: "−₹20.50", never "-₹20.5". */
function withMinus(text: string): string {
  return text.replace(/^-/, MINUS);
}

export function formatMoney(
  amount: number | null | undefined,
  { currency = "INR", compact = false, showSign = false, paise = false, whole = false }: FormatMoneyOptions = {},
): string {
  const value = Number(amount ?? 0);
  const safe = Number.isFinite(value) ? value : 0;
  // Fractions are either none or exactly two digits: ₹49.5 is never shown.
  const fraction = compact ? 1 : whole ? 0 : paise || !Number.isInteger(safe) ? 2 : 0;
  const text = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    minimumFractionDigits: compact ? 0 : fraction,
    maximumFractionDigits: fraction,
    signDisplay: showSign ? "exceptZero" : "auto",
  }).format(safe);
  // en-IN compact writes "K" for thousands; the spec uses "₹25k".
  return withMinus(compact ? text.replace(/K$/, "k") : text);
}

/** Plain numbers with Indian grouping (12,34,567). */
export function formatCount(value: number | null | undefined, compact = false): string {
  const n = Number(value ?? 0);
  return withMinus(
    new Intl.NumberFormat("en-IN", {
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : 0,
    }).format(Number.isFinite(n) ? n : 0),
  );
}

/** "+6.7%" / "−2%" / "0%". Input is already a percentage (6.7 means 6.7%). Max 1 decimal, no trailing ".0". */
export function formatDelta(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : value < 0 ? MINUS : "";
  return `${sign}${formatPercent(Math.abs(value), digits)}`;
}

/** "2.4%" / "17%": max 1 decimal, no trailing ".0". */
export function formatPercent(value: number, digits = 1): string {
  const n = Number.isFinite(value) ? value : 0;
  return `${Number(n.toFixed(digits))}%`;
}
