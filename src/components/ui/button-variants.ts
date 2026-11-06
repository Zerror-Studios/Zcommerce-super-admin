/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * The G10 button variants and sizes (round 2 §3 G10) and the legacy names that map onto them. Kept apart from
 * Button.tsx so non-component code (ErrorBoundary, links styled as buttons) can use `buttonClasses`.
 */
import { cx } from "./cx";

export type ButtonVariantName = "primary" | "secondary" | "ghost" | "dark" | "on-dark" | "danger";

/** LEGACY variant names, mapped onto the six above (see `resolveButtonVariant`). */
export type LegacyButtonVariant =
  | "tertiary"
  | "link"
  | "destructive"
  | "destructive-secondary"
  | "danger-outline"
  | "outline"
  | "glass"
  | "ai"
  | "secondary-on-dark";

export type ButtonVariant = ButtonVariantName | LegacyButtonVariant;

/** md 36 / 14px (default) and sm 32 / 13px (inside cards and tables). LEGACY lg → md, xs → sm. */
export type ButtonSize = "md" | "sm" | "lg" | "xs";

const VARIANT_ALIASES: Record<LegacyButtonVariant, ButtonVariantName> = {
  tertiary: "ghost",
  link: "ghost",
  destructive: "danger",
  "destructive-secondary": "secondary",
  "danger-outline": "secondary",
  outline: "secondary",
  glass: "on-dark",
  ai: "secondary",
  "secondary-on-dark": "on-dark",
};

/** The G10 variant a (possibly legacy) variant name renders as. */
export function resolveButtonVariant(variant: ButtonVariant): ButtonVariantName {
  return (VARIANT_ALIASES as Record<string, ButtonVariantName>)[variant] ?? (variant as ButtonVariantName);
}

/** The G10 size a (possibly legacy) size renders as: lg → md, xs → sm. */
export function resolveButtonSize(size: ButtonSize): "md" | "sm" {
  return size === "sm" || size === "xs" ? "sm" : "md";
}

/** The `.zc-btn` classes for a variant and size (also for links styled as buttons). */
export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  return cx("zc-btn", `zc-btn--${resolveButtonVariant(variant)}`, resolveButtonSize(size) === "sm" && "zc-btn--sm");
}
