/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Motion (docs/review-r2/ROUND-2-FIXES.md §2): the one shared motion file. Subtle, quick, never "loading".
 * - Animate only transform and opacity.
 * - CSS uses the tokens in styles/tokens.css (--ease-out, --ease-in-out, --ease-in, --dur-1 … --dur-4);
 *   framer-motion uses the springs and variants below, and nothing else (no inline durations in components).
 * - prefers-reduced-motion: every preset becomes a 120ms opacity fade (`usePresetMotion` picks it), and the
 *   CSS rule in tokens.css does the same for transitions and keyframes.
 *
 * Variants use HeroUI's keys (`initial` → `enter`, leaving to `exit`), so they plug into `motionProps` of the
 * kit Modal, Drawer, Tooltip, menus and the toast region.
 */
import { useReducedMotion } from "framer-motion";

// ─── Curves and durations (mirror tokens.css) ───────────────────────────────

/** --ease-out: most enter motions (iOS-like). */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
/** --ease-in-out: move or resize between two states. */
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
/** --ease-in: exits only. */
export const EASE_IN = [0.4, 0, 1, 1] as const;

/** --dur-1 … --dur-4 in seconds (framer-motion's unit). */
export const DUR_1_S = 0.12;
export const DUR_2_S = 0.18;
export const DUR_3_S = 0.24;
export const DUR_4_S = 0.32;
/** --dur-1 in milliseconds, for libraries that take ms (tippy menus in the post editor). */
export const DUR_1_MS = 120;
/** Drawer and toast exits (§2 table). */
export const EXIT_S = 0.14;
/** Menu and popover exits (§2 table). */
export const POPOVER_EXIT_S = 0.1;

// ─── Springs (§2: use these and nothing else; all settle without visible overshoot) ─────────────────────

export const spring = {
  /** Pop-ups, popovers, chips, toasts. */
  snappy: { type: "spring", stiffness: 520, damping: 38, mass: 0.9 },
  /** Drawers, sheets, the AI box. */
  soft: { type: "spring", stiffness: 340, damping: 34, mass: 1 },
  /** Shared-layout morphs (AI box → large view). */
  layout: { type: "spring", stiffness: 260, damping: 32, mass: 1 },
} as const;

// ─── Variants ────────────────────────────────────────────────────────────────

/** Reduced motion: a 120ms opacity fade, nothing moves. */
export const fadeVariants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: DUR_1_S, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: DUR_1_S, ease: EASE_IN } },
} as const;

/** Pop-up (every dialog size): scale .96 → 1, y 8 → 0, fade in, snappy; leaves with a fade to .98 in 120ms. */
export const popupVariants = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  enter: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { ...spring.snappy, opacity: { duration: DUR_2_S, ease: EASE_OUT } },
  },
  exit: { opacity: 0, scale: 0.98, y: 0, transition: { duration: DUR_1_S, ease: EASE_IN } },
} as const;

/** Phone bottom sheet (dialogs on phone): rises with the soft spring, leaves in 140ms. */
export const sheetVariants = {
  initial: { opacity: 1, y: "100%" },
  enter: { opacity: 1, y: 0, transition: spring.soft },
  exit: { opacity: 1, y: "100%", transition: { duration: EXIT_S, ease: EASE_IN } },
} as const;

/**
 * Popover and menu (⋯ menus, selects, wallet, date picker): scale .97 → 1 from the trigger's side (HeroUI sets
 * the transform origin to the anchor) with a fade, snappy; leaves with a 100ms fade.
 */
export const popoverVariants = {
  initial: { opacity: 0, scale: 0.97 },
  enter: {
    opacity: 1,
    scale: 1,
    transition: { ...spring.snappy, opacity: { duration: DUR_2_S, ease: EASE_OUT } },
  },
  exit: { opacity: 0, scale: 1, transition: { duration: POPOVER_EXIT_S, ease: EASE_IN } },
} as const;

/** Tooltip: fades in over 120ms, hides at once. */
export const tooltipVariants = {
  initial: { opacity: 0, scale: 1 },
  enter: { opacity: 1, scale: 1, transition: { duration: DUR_1_S, ease: EASE_OUT } },
  exit: { opacity: 0, scale: 1, transition: { duration: 0 } },
} as const;

/** Drawer from the right (filter, order preview, customer): x 24px → 0 with a fade, soft; leaves in 140ms. */
export const drawerVariants = {
  initial: { opacity: 0, x: 24 },
  enter: { opacity: 1, x: 0, transition: { ...spring.soft, opacity: { duration: DUR_3_S, ease: EASE_OUT } } },
  exit: { opacity: 0, x: 24, transition: { duration: EXIT_S, ease: EASE_IN } },
} as const;

/** Drawer from the left (the phone menu): the mirror of drawerVariants. */
export const drawerLeftVariants = {
  initial: { opacity: 0, x: -24 },
  enter: { opacity: 1, x: 0, transition: { ...spring.soft, opacity: { duration: DUR_3_S, ease: EASE_OUT } } },
  exit: { opacity: 0, x: -24, transition: { duration: EXIT_S, ease: EASE_IN } },
} as const;

/** Toast: y 12 → 0 with a fade, snappy; leaves in 140ms. */
export const toastMotionProps = {
  initial: { opacity: 0, y: 12 },
  exit: { opacity: 0, transition: { duration: EXIT_S, ease: EASE_IN } },
  transition: spring.snappy,
} as const;

// ─── Presets for HeroUI motionProps ──────────────────────────────────────────

export type MotionPreset = "popup" | "sheet" | "popover" | "tooltip" | "drawer" | "drawer-left";

const PRESETS = {
  popup: popupVariants,
  sheet: sheetVariants,
  popover: popoverVariants,
  tooltip: tooltipVariants,
  drawer: drawerVariants,
  "drawer-left": drawerLeftVariants,
} as const;

/** `motionProps` for a HeroUI overlay: the preset's variants, starting from `initial`. */
export function presetMotion(preset: MotionPreset, reduced = false) {
  return { variants: reduced ? fadeVariants : PRESETS[preset], initial: "initial" } as const;
}

/** `presetMotion` that follows the user's reduced-motion setting. */
export function usePresetMotion(preset: MotionPreset) {
  const reduced = useReducedMotion() ?? false;
  return presetMotion(preset, reduced);
}
