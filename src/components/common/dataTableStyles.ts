import {
  tableCellClasses,
  tableCheckboxClassNames,
  tableHeaderCellClasses,
  tablePanelClasses,
  tableRowClasses,
} from "../ui/table-styles";

/** Outer bordered white panel that wraps toolbar + table. */
export const tablePanelClassName = tablePanelClasses;

/** Panel that fills remaining viewport below page header. */
export const tablePanelFillClassName = `${tablePanelClasses} flex h-[calc(100dvh-12.5rem)] flex-col`;

/** Fixed-height scroll area for table body (header stays sticky). */
export const tableScrollClassName =
  "h-[min(26rem,calc(100vh-22rem))] overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

const scrollHidden =
  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

/** Table styles aligned with the main product TableComponent. */
export const dataTableClassNames = {
  base: "bg-surface gap-0 rounded-none border-0 overflow-hidden",
  wrapper: `scrollbar p-0 shadow-none rounded-none mt-0 overflow-auto h-[min(26rem,calc(100vh-22rem))] ${scrollHidden}`,
  thead: "sticky top-0 z-20 !rounded-none [&>tr]:first:shadow-none",
  th: `first:w-[4.2rem] ${tableHeaderCellClasses} first:pl-4 xl:first:pl-8 last:pr-4 xl:last:pr-8 sticky top-0`,
  td: `first:w-[4.2rem] py-4 text-sm ${tableCellClasses} first:pl-4 xl:first:pl-8 last:pr-4 xl:last:pr-8`,
  tr: `cursor-pointer ${tableRowClasses}`,
  table: "min-h-[100px] min-w-full",
  emptyWrapper: "text-fg-muted h-full py-8",
} as const;

/** Taller table that fills the viewport panel. */
export const dataTableFillClassNames = {
  ...dataTableClassNames,
  base: "bg-surface gap-0 rounded-none border-0 overflow-hidden min-h-0 flex-1 flex flex-col",
  wrapper: `scrollbar p-0 shadow-none rounded-none mt-0 overflow-auto flex-1 min-h-0 !h-auto ${scrollHidden}`,
} as const;

/** HeroUI selection checkboxes — same look as product tables. */
export const dataTableCheckboxesProps = {
  color: "primary" as const,
  size: "sm" as const,
  radius: "sm" as const,
  classNames: tableCheckboxClassNames,
};

/** Shared selection props so every table checkbox looks the same. */
export const dataTableSelectionProps = {
  selectionMode: "multiple" as const,
  selectionBehavior: "toggle" as const,
  color: "primary" as const,
  checkboxesProps: dataTableCheckboxesProps,
};
