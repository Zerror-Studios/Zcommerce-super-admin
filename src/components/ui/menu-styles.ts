/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/** Menu popover and item classes shared by Select and Dropdown (01 §7.17). */

/** Popover: white, 1px border, 12px radius, popover shadow, 6px padding, 200–320px wide. */
export const menuPopoverClasses = "zc-menu rounded-xl border border-line bg-surface p-1.5 !shadow-popover";

/**
 * Menu motion (01 §7.17): opacity and scale(.98 → 1) in 140ms; exit fades in 100ms. HeroUI places the popover,
 * so it grows from the trigger side.
 */
export const menuMotionProps = {
  variants: {
    initial: { opacity: 0, scale: 0.98 },
    enter: { opacity: 1, scale: 1, transition: { duration: 0.14, ease: [0.2, 0, 0, 1] as const } },
    exit: { opacity: 0, scale: 1, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] as const } },
  },
};

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

/** Add to a destructive item ("Delete"): last in the menu, after a divider, red text and icon. */
export const menuItemDangerClasses =
  "text-tone-danger-text [&>svg]:!text-tone-danger-text data-[hover=true]:bg-tone-danger-soft data-[hover=true]:text-tone-danger-text";

/** Section label inside a menu: 12/500 subtle, padding 8 10 4. */
export const menuSectionClasses = {
  heading: "px-2.5 pt-2 pb-1 text-xs font-medium text-fg-subtle",
  divider: "my-1.5 bg-line",
};
