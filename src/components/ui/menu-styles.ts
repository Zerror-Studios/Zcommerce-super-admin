/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/** Menu popover and item classes shared by Select and Dropdown (component-specs §6). */

/** Popover: white surface, 8px radius, popover shadow, 4px padding. */
export const menuPopoverClasses = "rounded-lg bg-surface p-1 !shadow-popover";

/** Item: 36px, 6px radius, 14px text; muted on hover/keyboard focus; soft primary when selected. */
export const menuItemClasses = {
  base: [
    "h-9 rounded-sm px-3 gap-2 text-fg",
    "data-[hover=true]:bg-surface-muted data-[hover=true]:text-fg",
    "data-[focus-visible=true]:bg-surface-muted",
    "data-[selected=true]:bg-brand-soft data-[selected=true]:text-brand-text data-[selected=true]:font-medium",
    "data-[disabled=true]:opacity-50",
  ].join(" "),
  title: "text-sm",
  description: "text-xs text-fg-muted",
  selectedIcon: "text-brand-text",
};

/** Add to a destructive item ("Delete"): danger text, soft danger fill on hover. */
export const menuItemDangerClasses =
  "text-tone-danger-text data-[hover=true]:bg-tone-danger-soft data-[hover=true]:text-tone-danger-text";
