import {
  tableCellClasses,
  tableCheckboxClassNames,
  tableHeaderCellClasses,
  tablePanelClasses,
  tableRowClasses,
} from "../ui/table-styles";

/** Outer bordered white panel that wraps toolbar + table. */
export const tablePanelClassName = tablePanelClasses;

/**
 * Panel that grows with its rows up to the viewport below the page header, then scrolls inside. An empty
 * table stays as short as every other empty table (owner 2026-10-28; it used to fill the screen).
 */
export const tablePanelFillClassName = `${tablePanelClasses} flex max-h-[calc(100dvh-12.5rem)] flex-col`;

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
  th: `first:w-12 ${tableHeaderCellClasses} sticky top-0`,
  td: `first:w-12 ${tableCellClasses}`,
  tr: `cursor-pointer ${tableRowClasses}`,
  table: "min-h-[100px] min-w-full",
  emptyWrapper: "text-fg-muted h-full py-4",
} as const;

/** Table inside the fill panel: scrolls once the panel reaches its maximum height. */
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

/**
 * A table inside a card, with no selection column and no fixed height
 * (store billing, Settings › Plans; PRD-016 / PRD-017).
 */
export const compactTableClassNames = {
  ...dataTableClassNames,
  base: "rounded-none border-0 border-t border-line overflow-x-auto bg-surface",
  wrapper: "p-0 shadow-none rounded-none",
  th: dataTableClassNames.th.replace("first:w-12 ", ""),
  td: dataTableClassNames.td.replace("first:w-12 ", ""),
  tr: dataTableClassNames.tr.replace("cursor-pointer ", ""),
} as const;
