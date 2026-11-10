/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ReactNode } from "react";
import { cx } from "./cx";
import { formatPercent } from "./money";
import { useChartEntrance } from "./use-chart-entrance";

export interface RankedBarItem {
  key: string;
  label: ReactNode;
  value: number;
  /** Right-hand text; defaults to the item's share of the total ("34%"). */
  display?: ReactNode;
}

/**
 * Ranked categories (docs/design/02-components.md §14, ref 01 "Traffic sources"): label and value on one line,
 * a thin primary-blue bar on a muted track underneath (owner 2026-10-29: blue, was ink). Bars are relative to
 * the largest value. Round 3 D2: the bars grow from the left the first time the list is on screen in a visit
 * (`entranceKey`), slide to new values, and a hovered row stays bright while the others dim.
 */
export function RankedBars({ items, className, entranceKey }: { items: RankedBarItem[]; className?: string; entranceKey?: string }) {
  const { ref, play } = useChartEntrance<HTMLUListElement>(entranceKey ? `ranked:${entranceKey}` : undefined);
  const total = items.reduce((sum, item) => sum + Math.max(item.value, 0), 0);
  const max = Math.max(...items.map((item) => item.value), 0);
  return (
    <ul ref={ref} data-play={play} className={cx("zc-chart zc-c-hover-group flex flex-col gap-3", className)}>
      {items.map((item, index) => (
        <li key={item.key} className="zc-c-item">
          <div className="flex items-baseline justify-between gap-3 text-body">
            <span className="truncate text-fg">{item.label}</span>
            <span className="shrink-0 text-fg-muted num">
              {item.display ?? (total > 0 ? formatPercent((item.value / total) * 100, 0) : "—")}
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-sunken">
            <div className="zc-c-hbar h-1" style={{ ["--i" as string]: index }}>
              <div
                className="zc-c-morph-x h-1 origin-left rounded-full bg-brand"
                style={{ transform: `scaleX(${max > 0 ? Math.max(0, item.value) / max : 0})` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
