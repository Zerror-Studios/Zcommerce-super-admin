/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ReactNode } from "react";
import { cx } from "./cx";
import { formatPercent } from "./money";

export interface RankedBarItem {
  key: string;
  label: ReactNode;
  value: number;
  /** Right-hand text; defaults to the item's share of the total ("34%"). */
  display?: ReactNode;
}

/**
 * Ranked categories (docs/design/02-components.md §14, ref 01 "Traffic sources"): label and value on one line,
 * a thin neutral bar (ink on a muted track) underneath. Bars are relative to the largest value.
 */
export function RankedBars({ items, className }: { items: RankedBarItem[]; className?: string }) {
  const total = items.reduce((sum, item) => sum + Math.max(item.value, 0), 0);
  const max = Math.max(...items.map((item) => item.value), 0);
  return (
    <ul className={cx("flex flex-col gap-3", className)}>
      {items.map((item) => (
        <li key={item.key}>
          <div className="flex items-baseline justify-between gap-3 text-body">
            <span className="truncate text-fg">{item.label}</span>
            <span className="shrink-0 text-fg-muted num">
              {item.display ?? (total > 0 ? formatPercent((item.value / total) * 100, 0) : "—")}
            </span>
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-surface-sunken">
            <div className="h-1 rounded-full bg-fg" style={{ width: max > 0 ? `${(item.value / max) * 100}%` : 0 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
