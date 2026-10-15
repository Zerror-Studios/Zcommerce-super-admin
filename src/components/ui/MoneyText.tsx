/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { HTMLAttributes } from "react";
import { cx } from "./cx";
import { formatMoney } from "./money";

export interface MoneyTextProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  amount: number | null | undefined;
  currency?: string;
  compact?: boolean;
  showSign?: boolean;
}

/** Money value (component-specs §20). Always tabular numbers. Never format money inline in pages. */
export function MoneyText({ amount, currency, compact, showSign, className, ...rest }: MoneyTextProps) {
  return (
    <span className={cx("tabular-nums", className)} {...rest}>
      {formatMoney(amount, { currency, compact, showSign })}
    </span>
  );
}
