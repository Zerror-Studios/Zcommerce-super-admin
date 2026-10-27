/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Token-based classes for HeroUI Table (docs/design/02-components.md §6).
 * Layout sizes (column widths, scroll heights) stay in each project's table file;
 * these cover color, weight, borders and states so both products read the same.
 * Sizes use text-sm (= text-body) because HeroUI merges classNames with tailwind-merge.
 */

/** Card around toolbar + table: white, 1px border, 12px radius, no shadow. */
export const tablePanelClasses =
  "rounded-card border border-line bg-surface overflow-hidden";

/**
 * Header cell: 40px, light blue fill, 13px/600 dark slate-blue text, sentence case, bottom border (owner
 * 2026-10-27: was grey fill with 500 secondary text). Every column has a visible label, actions included.
 */
export const tableHeaderCellClasses =
  "h-10 !bg-table-head !text-table-head-fg text-[13px] font-semibold normal-case border-b border-line !rounded-none px-4";

/** Width of the trailing actions column ("Actions" label over the "···" button). */
export const tableActionsColumnClass = "w-24";

/** Body row: subtle fill on hover, soft primary fill when selected, divider between rows. */
export const tableRowClasses =
  "transition-colors duration-instant ease-standard hover:!bg-surface-muted data-[selected=true]:!bg-brand-soft border-b border-line-subtle last:border-b-0";

/** Body cell: 56px row height, 14px text, 16px side padding. Right-align numbers with "text-right num". */
export const tableCellClasses = "h-14 px-4 text-sm !text-fg";

/**
 * Selection checkbox: 16px, 4px radius, strong border, primary fill when checked. `me-0` drops HeroUI's 8px gap
 * for a label (table checkboxes have none), so the box sits centred in its column instead of leaving space on the right.
 */
export const tableCheckboxClassNames = {
  base: "m-0",
  wrapper:
    "size-4 me-0 rounded-xs before:rounded-xs after:rounded-xs before:border before:border-line-strong after:bg-brand",
  icon: "text-brand-on",
};
