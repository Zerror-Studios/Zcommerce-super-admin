/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { HTMLAttributes } from "react";
import { cx } from "./cx";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  count: number;
  /** Highest number shown before "+" (default 99). */
  max?: number;
}

/** Count badge (component-specs §8): 20px pill, primary fill, white 12px/500, tabular numbers. Hidden at 0. */
export function Badge({ count, max = 99, className, ...rest }: BadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      className={cx(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-caption font-medium text-brand-on tabular-nums",
        className,
      )}
      {...rest}
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}
