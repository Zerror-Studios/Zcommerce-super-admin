/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ReactNode } from "react";
import { cx } from "./cx";

/** Section colours (01 §5.1). "ink" is Home; the rest match the .zc-sec-* soft palettes in tokens-expression.css. */
export type SectionColor = "ink" | "blue" | "violet" | "teal" | "green" | "amber" | "coral" | "pink" | "slate";

export const sectionClass = (section?: SectionColor) => (section && section !== "ink" ? `zc-sec-${section}` : undefined);

export interface IconTileProps {
  /** A stroke icon from ./icons; sized by the tile. */
  children: ReactNode;
  /** Section colour: the solid fill with a white glyph (01 §5.1). Without it the tile is ink. */
  section?: SectionColor;
  /** lg 40px (page headers), md 36px (count tiles, named entities), sm 28px (rows). */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "size-7 rounded-lg [&_svg]:size-3.5",
  md: "size-9 rounded-[10px] [&_svg]:size-4",
  lg: "size-10 rounded-xl [&_svg]:size-5",
};

/** The solid fill per section (01 §5.1: white glyph, all at least 3:1). */
const solid: Record<SectionColor, string> = {
  ink: "bg-sec-ink-solid",
  blue: "bg-sec-blue-solid",
  green: "bg-sec-green-solid",
  violet: "bg-sec-violet-solid",
  teal: "bg-sec-teal-solid",
  coral: "bg-sec-coral-solid",
  amber: "bg-sec-amber-solid",
  pink: "bg-sec-pink-solid",
  slate: "bg-sec-slate-solid",
};

/**
 * The page-header icon tile (01 §6.4): 40px, radius 12, the section's solid colour, a white 20px glyph. One per
 * header. Decorative: the title next to it says what it is.
 */
export function IconTile({ children, section, size = "lg", className }: IconTileProps) {
  return (
    <span
      aria-hidden
      className={cx("inline-flex shrink-0 items-center justify-center text-white", solid[section ?? "ink"], sizes[size], className)}
    >
      {children}
    </span>
  );
}
