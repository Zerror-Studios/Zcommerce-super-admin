/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Token-based classes for HeroUI Table (01 §7.14), used by DataTable and by the smaller tables that still use
 * HeroUI's Table directly. Layout sizes (column widths) stay in each table; these cover colour, type, borders,
 * row height and states so every table reads the same.
 * Sizes use text-sm / text-xs because HeroUI merges classNames with tailwind-merge.
 */

/** Card around the table: white, 1px border, 22px radius (v2 §4.4), no shadow; `overflow-clip` keeps sticky heads working. */
export const tablePanelClasses =
  "rounded-[var(--zc-radius-card)] border border-line bg-surface overflow-clip";

/**
 * Header cell (v2 §4.4): 40px, light grey table-head fill, 12/500 grey text, sentence case, left-aligned (every column, money too).
 * Sortable headers show their arrow on hover; the active sort shows ↑ or ↓ (HeroUI).
 */
export const tableHeaderCellClasses =
  "h-10 !bg-table-head !text-table-head-fg text-xs font-medium normal-case text-start border-b border-line-subtle !rounded-none px-cell-x";

/** The trailing ⋯ column: 56px, its header label visually hidden. */
export const tableActionsColumnClass = "w-14 min-w-14";

/**
 * Body row: row-hover grey on hover, row-selected blue when selected (checkbox), 1px divider between rows, none after the last.
 * The cells take the same fill, so sticky cells (pinned name or actions, which carry their own white background)
 * change with the rest of the row instead of staying white.
 */
export const tableRowClasses =
  "transition-colors duration-fast ease-standard hover:!bg-row-hover data-[selected=true]:!bg-row-selected hover:[&>td]:!bg-row-hover data-[selected=true]:[&>td]:!bg-row-selected border-b border-line-subtle last:border-b-0";

/** Body cell (v2 §4.4): 60px rows (64px for thumbnails or two lines: add h-16), 14px text, 18px side padding, left-aligned. */
export const tableCellClasses = "h-15 px-cell-x text-sm text-start !text-fg";

/** Selection checkbox: the v2 checkbox (1.5px grey outline, blue when checked) centred in its 44px column. */
export const tableCheckboxClassNames = {
  base: "m-0",
  wrapper: "zc-check-box me-0",
  icon: "text-brand-on",
};
