/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/** Menu popover and item classes shared by Select and Dropdown (01 §7.17). */
import { presetMotion } from "./motion";

/** Popover: the floating level (G16: white, the floating shadow with a 6% ring), 16px radius, 6px padding. */
export const menuPopoverClasses = "zc-menu rounded-menu border-0 bg-surface p-1.5 !shadow-popover";

/**
 * Menu motion (round 2 §2, motion.ts `popoverVariants`): scale .97 → 1 from the trigger's corner with a fade on the
 * snappy spring; exit fades in 100ms. HeroUI places the popover, so it grows from the trigger side. Reduced motion
 * keeps only the fade (MotionConfig in AppShell).
 */
export const menuMotionProps = presetMotion("popover");

/**
 * Item: 36px (44 on phone), 8px radius, padding 0 10, 10px gap, 16px icon in the muted grey, 14px label;
 * sunken grey on hover and keyboard focus; soft primary when selected (selects).
 */
export const menuItemClasses = {
  base: [
    "min-h-9 max-md:min-h-11 h-auto rounded-lg px-2.5 py-1.5 gap-2.5 text-fg",
    "[&_svg]:size-4 [&_svg]:shrink-0 [&>svg]:text-fg-muted",
    "data-[hover=true]:bg-surface-sunken data-[hover=true]:text-fg",
    "data-[focus-visible=true]:bg-surface-sunken",
    "data-[selected=true]:bg-brand-soft data-[selected=true]:text-brand-text data-[selected=true]:font-medium",
    "data-[disabled=true]:opacity-40",
  ].join(" "),
  title: "text-sm",
  description: "text-xs text-fg-muted",
  shortcut: "text-xs text-fg-subtle border-0 font-sans",
  selectedIcon: "text-brand-text",
};

/** Add to a destructive item ("Delete", "Log out"): last, after a divider, red text and icon, red hover (wins over the grey). */
export const menuItemDangerClasses =
  "!text-tone-danger-text [&>svg]:!text-tone-danger-text data-[hover=true]:!bg-tone-danger-soft data-[hover=true]:!text-tone-danger-text data-[focus-visible=true]:!bg-tone-danger-soft";

/** Section label inside a menu: 12/500 subtle, padding 8 10 4. */
export const menuSectionClasses = {
  heading: "px-2.5 pt-2 pb-1 text-xs font-medium text-fg-subtle",
  divider: "my-1.5 bg-line",
};
