/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/** Menu popover and item classes shared by Select and Dropdown (docs/design/02-components.md §11). */

/** Popover: white surface, 1px border, 12px radius, popover shadow, 4px padding. `zc-menu` adds the 4px slide (theme.css). */
export const menuPopoverClasses = "zc-menu rounded-xl border border-line bg-surface p-1 !shadow-popover";

/**
 * Menu motion (docs/design/02-components.md: "fade + 4px slide from anchor, 140ms"). Replaces HeroUI's default
 * spring that scales from 0.8: the scaled text re-rasterises as it settles, which reads as a flicker.
 * Framer only fades; the slide is a CSS animation on `.zc-menu` keyed off the resolved placement.
 */
export const menuMotionProps = {
  variants: {
    initial: { opacity: 0 },
    enter: { opacity: 1, transition: { duration: 0.14, ease: [0.2, 0, 0, 1] as const } },
    exit: { opacity: 0, transition: { duration: 0.08, ease: [0.4, 0, 1, 1] as const } },
  },
};

/**
 * Item: 32px (taller when it has a description line), 8px radius, 14px text; muted fill on hover/keyboard focus;
 * soft primary when selected.
 */
export const menuItemClasses = {
  base: [
    "min-h-8 h-auto rounded-lg px-2.5 py-1.5 gap-2 text-fg",
    "data-[hover=true]:bg-surface-sunken data-[hover=true]:text-fg",
    "data-[focus-visible=true]:bg-surface-sunken",
    "data-[selected=true]:bg-brand-soft data-[selected=true]:text-brand-text data-[selected=true]:font-medium",
    "data-[disabled=true]:opacity-50",
  ].join(" "),
  title: "text-sm",
  description: "text-xs text-fg-muted",
  selectedIcon: "text-brand-text",
};

/** Add to a destructive item ("Delete"): last in the menu, after a divider, in red. */
export const menuItemDangerClasses =
  "text-tone-danger-text data-[hover=true]:bg-tone-danger-soft data-[hover=true]:text-tone-danger-text";
