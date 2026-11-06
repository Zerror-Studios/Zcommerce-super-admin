/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { HTMLAttributes } from "react";
import { cx } from "./cx";
import { formatMoney } from "./money";

export interface MoneyTextProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  amount: number | null | undefined;
  currency?: string;
  compact?: boolean;
  showSign?: boolean;
  /** Always 2 decimals (finance tables, invoices): ₹49.50. */
  paise?: boolean;
  /** Settled money on detail pages: the paise when there are any (see formatMoney). */
  exact?: boolean;
  /** Whole rupees (the default). */
  whole?: boolean;
}

/** Money value (component-specs §20). Always tabular numbers. Never format money inline in pages. */
export function MoneyText({ amount, currency, compact, showSign, paise, exact, whole, className, ...rest }: MoneyTextProps) {
  return (
    <span className={cx("tabular-nums", className)} {...rest}>
      {formatMoney(amount, { currency, compact, showSign, paise, exact, whole })}
    </span>
  );
}
