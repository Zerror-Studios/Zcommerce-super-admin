/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/** Menu popover and item classes shared by Select and Dropdown (docs/design/02-components.md §11). */

/** Popover: white surface, 1px border, 12px radius, popover shadow, 4px padding. */
export const menuPopoverClasses = "rounded-xl border border-line bg-surface p-1 !shadow-popover";

/** Item: 32px, 8px radius, 14px text; muted fill on hover/keyboard focus; soft primary when selected. */
export const menuItemClasses = {
  base: [
    "h-8 rounded-lg px-2.5 gap-2 text-fg",
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
