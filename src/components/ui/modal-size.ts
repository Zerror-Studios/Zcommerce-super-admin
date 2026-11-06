/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/** The four pop-up sizes (round 2 §3 G4) and the legacy HeroUI sizes that map onto them. */

/** The four pop-up sizes (round 2 G4): sm 420 · md 640 · lg 960 · full 100vw − 64 × 100vh − 64. */
export type ModalSize = "sm" | "md" | "lg" | "full";
/** LEGACY name of ModalSize (the `width` prop). */
export type ModalWidth = ModalSize;
/** LEGACY HeroUI sizes, mapped onto the four: xs → sm, xl → md, 2xl–5xl → lg. */
export type LegacyModalSize = "xs" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";

const LEGACY_SIZES: Record<LegacyModalSize, ModalSize> = {
  xs: "sm",
  xl: "md",
  "2xl": "lg",
  "3xl": "lg",
  "4xl": "lg",
  "5xl": "lg",
};

/** The G4 size a (possibly legacy) size renders as. */
export function resolveModalSize(size: ModalSize | LegacyModalSize | undefined): ModalSize {
  if (!size) return "sm";
  return (LEGACY_SIZES as Record<string, ModalSize>)[size] ?? (size as ModalSize);
}
