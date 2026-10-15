/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Token-based classes for HeroUI Table (component-specs §10).
 * Layout sizes (column widths, scroll heights) stay in each project's table file;
 * these cover color, weight, borders and states so both products read the same.
 * Sizes use text-sm (= text-body) because HeroUI merges classNames with tailwind-merge.
 */

/** Card-style container around toolbar + table. */
export const tablePanelClasses =
  "rounded-card border border-line bg-surface shadow-card overflow-hidden";

/**
 * Header cell: 44px, light-blue fill, 14px/500, bottom border.
 * Owner override (2026-10-13): light-blue header kept, using primary-tint from the brand palette
 * instead of the spec's surface-muted (component-specs §10).
 */
export const tableHeaderCellClasses =
  "h-11 !bg-brand-tint !text-fg text-sm font-medium border-b border-line !rounded-none";

/** Body row: muted fill on hover (150ms), soft primary fill when selected. */
export const tableRowClasses =
  "transition-colors duration-fast ease-standard hover:!bg-surface-muted data-[selected=true]:!bg-brand-soft border-b border-line last:border-b-0";

/** Body cell text color. */
export const tableCellClasses = "!text-fg";

/** Selection checkbox (§7): 6px radius, strong border, primary fill when checked. */
export const tableCheckboxClassNames = {
  base: "m-0",
  wrapper:
    "rounded-sm before:rounded-sm after:rounded-sm before:border-line-strong after:bg-brand",
  icon: "text-brand-on",
};
