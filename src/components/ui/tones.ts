/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/** Status tones (status-mappings §1). The tone carries meaning; the same status gets the same tone everywhere. */
export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const TONES: readonly Tone[] = ["neutral", "info", "success", "warning", "danger"];

/** Soft background + tone text for chips and badges. */
export const toneClasses: Record<Tone, string> = {
  neutral: "bg-tone-neutral-soft text-tone-neutral",
  info: "bg-brand-soft text-brand-text",
  success: "bg-tone-success-soft text-tone-success",
  warning: "bg-tone-warning-soft text-tone-warning",
  danger: "bg-tone-danger-soft text-tone-danger-text",
};

/** Dot color matching the tone text. */
export const toneDotClasses: Record<Tone, string> = {
  neutral: "bg-tone-neutral",
  info: "bg-brand-text",
  success: "bg-tone-success",
  warning: "bg-tone-warning",
  danger: "bg-tone-danger-text",
};
