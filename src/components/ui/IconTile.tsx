/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * LEGACY section colours (01 §5.1). Retired in design v2 (§2.1): every value now renders the ink tile, and the
 * `.zc-sec-*` palettes resolve to neutral. Kept so old call sites compile; new code leaves `section` out.
 */
export type SectionColor = "ink" | "blue" | "violet" | "teal" | "green" | "amber" | "coral" | "pink" | "slate";

export const sectionClass = (section?: SectionColor) => (section && section !== "ink" ? `zc-sec-${section}` : undefined);

/**
 * ink: page-title tiles (white icon). neutral: pop-up title rows and list rows (grey, ink icon). danger: delete.
 * success (green tint) and info (blue tint): status tiles that carry meaning, e.g. the order detail's "Paid" and
 * "Shipped" cards (board 14). Never for decoration.
 */
export type IconTileTone = "ink" | "neutral" | "danger" | "success" | "info";

export interface IconTileProps {
  /** A stroke icon from ./icons; sized by the tile. */
  children: ReactNode;
  /** LEGACY: ignored in v2 (all ink). */
  section?: SectionColor;
  tone?: IconTileTone;
  /** lg 44px (page titles), md 36px (pop-up titles, named entities), sm 28px (rows). */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "size-7 rounded-lg [&_svg]:size-3.5",
  md: "size-[var(--zc-popup-tile)] rounded-field [&_svg]:size-4.5",
  lg: "size-[var(--zc-title-tile)] rounded-tile [&_svg]:size-5",
};

const tones: Record<IconTileTone, string> = {
  ink: "bg-ink text-white",
  neutral: "bg-surface-sunken text-fg",
  danger: "bg-tone-danger-soft text-tone-danger",
  success: "bg-tone-success-soft text-tone-success",
  info: "bg-tone-info-soft text-tone-info",
};

/**
 * Icon tile (v2 §2.1, §4.1, §4.6): page titles get a 44px ink tile with a white icon; pop-up title rows a 36px grey
 * tile (red for delete). Decorative: the title next to it says what it is.
 */
export function IconTile({ children, tone = "ink", size = "lg", className }: IconTileProps) {
  return (
    <span aria-hidden className={cx("inline-flex shrink-0 items-center justify-center", tones[tone], sizes[size], className)}>
      {children}
    </span>
  );
}
