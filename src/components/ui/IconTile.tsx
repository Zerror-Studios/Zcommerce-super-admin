/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ReactNode } from "react";
import { cx } from "./cx";

/** Section colours from src/styles/tokens-expression.css (.zc-sec-*). */
export type SectionColor = "blue" | "violet" | "teal" | "green" | "amber" | "coral" | "pink" | "slate";

export const sectionClass = (section?: SectionColor) => (section ? `zc-sec-${section}` : undefined);

export interface IconTileProps {
  /** A stroke icon from ./icons; sized by the tile. */
  children: ReactNode;
  /** Section colour; without it the tile follows the nearest .zc-sec-* ancestor (slate by default). */
  section?: SectionColor;
  /** lg 44px (page headers), md 36px (count tiles, named entities), sm 28px (rows). */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "size-7 rounded-field [&_svg]:size-3.5",
  md: "size-9 rounded-thumb [&_svg]:size-4",
  lg: "size-11 rounded-tile [&_svg]:size-5",
};

/**
 * Square icon tile in the section colour (docs/design/09-settings-and-scale.md §2: 44px radius 12 in headers;
 * 08 §2.1: 36px count tiles). Decorative: the text next to it says what it is.
 */
export function IconTile({ children, section, size = "lg", className }: IconTileProps) {
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex shrink-0 items-center justify-center bg-sec-soft text-sec-fg",
        sizes[size],
        sectionClass(section),
        className,
      )}
    >
      {children}
    </span>
  );
}
