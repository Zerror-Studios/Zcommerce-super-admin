/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Status tones (docs/design/02-components.md §10). The tone carries meaning; the same status gets the same tone
 * everywhere. "danger" is the spec's "critical" tone.
 */
export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const TONES: readonly Tone[] = ["neutral", "info", "success", "warning", "danger"];

/** Soft background + tone text for chips and badges. */
export const toneClasses: Record<Tone, string> = {
  neutral: "bg-tone-neutral-soft text-tone-neutral",
  info: "bg-tone-info-soft text-tone-info",
  success: "bg-tone-success-soft text-tone-success",
  warning: "bg-tone-warning-soft text-tone-warning",
  danger: "bg-tone-danger-soft text-tone-danger-text",
};

/** 6px status dot (badges, "Needs attention" rows, health). */
export const toneDotClasses: Record<Tone, string> = {
  neutral: "bg-tone-neutral-dot",
  info: "bg-brand",
  success: "bg-tone-success",
  warning: "bg-tone-warning-dot",
  danger: "bg-tone-danger-dot",
};

/** Inline status text without a badge ("8 left", "Out of stock", delta numbers). */
export const toneTextClasses: Record<Tone, string> = {
  neutral: "text-fg-muted",
  info: "text-tone-info",
  success: "text-tone-success",
  warning: "text-tone-warning",
  danger: "text-tone-danger-text",
};
