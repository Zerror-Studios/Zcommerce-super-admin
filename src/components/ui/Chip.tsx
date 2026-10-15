/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import { toneClasses, toneDotClasses } from "./tones";
import type { Tone } from "./tones";

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** Show the 6px tone dot before the label (default true). */
  dot?: boolean;
  startIcon?: ReactNode;
  children: ReactNode;
}

/** Status badge (docs/design/02-components.md §10): 22px, 6px radius, 12px/500, 6px dot, sentence case. Always shows text. */
export function Chip({ tone = "neutral", dot = true, startIcon, className, children, ...rest }: ChipProps) {
  return (
    <span
      className={cx(
        "inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm px-2 text-caption font-medium",
        toneClasses[tone],
        className,
      )}
      {...rest}
    >
      {startIcon ?? (dot ? <span aria-hidden className={cx("size-1.5 shrink-0 rounded-full", toneDotClasses[tone])} /> : null)}
      {children}
    </span>
  );
}
