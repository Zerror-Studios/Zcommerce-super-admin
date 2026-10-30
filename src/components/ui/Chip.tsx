/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import type { Tone } from "./tones";

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** Status tone; "ai" is for AI-made things ("Zcom AI", "AI suggestion") and takes a sparkle as startIcon. */
  tone?: Tone | "ai";
  /** Show the 6px tone dot before the label (default true). */
  dot?: boolean;
  /** Replaces the dot (12px). */
  startIcon?: ReactNode;
  children: ReactNode;
}

/**
 * Status badge (01 §7.11, `.zc-badge` in src/styles/components.css): 22px, 6px radius, 12px/500, 6px dot,
 * sentence case. Rectangular-rounded so it never looks like a button; never clickable. Always shows text.
 */
export function Chip({ tone = "neutral", dot = true, startIcon, className, children, ...rest }: ChipProps) {
  return (
    <span
      className={cx("zc-badge", `zc-badge--${tone}`, (startIcon || !dot) && "zc-badge--no-dot", className)}
      {...rest}
    >
      {startIcon}
      {children}
    </span>
  );
}
