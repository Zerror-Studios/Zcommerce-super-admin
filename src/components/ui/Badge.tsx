/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { HTMLAttributes } from "react";
import { cx } from "./cx";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  count: number;
  /** Highest number shown before "+" (default 99). */
  max?: number;
}

/** Count pill (docs/design/02-components.md §1): 18px, blue fill, white 11px/600, tabular numbers. Hidden at 0. */
export function Badge({ count, max = 99, className, ...rest }: BadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      className={cx(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-nav-count px-1.5 text-[11px] font-semibold leading-none text-brand-on tabular-nums",
        className,
      )}
      {...rest}
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}
