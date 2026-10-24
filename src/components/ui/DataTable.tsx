/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * The shared data table (docs/design/02-components.md §6, 09-settings-and-scale.md §3.1–3.2). One card:
 * toolbar (or the bulk bar while rows are selected) → table → pagination footer. Server-side paging and
 * sorting: the page passes one page of rows, the total, and handles onSortChange; use useTableUrlState to keep
 * it all in the URL and usePersistentColumns for the Columns choice.
 *
 * - First load: 8 skeleton rows the height of real rows, never a spinner in a blank card.
 * - Page, sort or filter change (isReloading): current rows stay at 60% with a thin progress line on top.
 * - Sticky header; optional sticky first column on sideways scroll; 56px rows; one line per cell.
 * - Never render more than 100 rows: page the data instead (§3.8).
 */
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import type { Selection, SortDescriptor } from "@heroui/react";
import type { Key, ReactNode } from "react";
import { cx } from "./cx";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import type { TableSort } from "./table-state";
import { tableCellClasses, tableCheckboxClassNames, tableHeaderCellClasses, tableRowClasses } from "./table-styles";
import { Tooltip } from "./Tooltip";

export interface DataTableColumn {
  key: string;
  label: ReactNode;
  /** Numbers and money: "end" (right-aligned, tabular). The actions column is always "end". */
  align?: "start" | "center" | "end";
  /** Server-side sort on this column. */
  sortable?: boolean;
  /** Fixed width class, e.g. "w-40" (checkbox 40px and actions 48px are set for you). */
  className?: string;
  /** Visually hidden header text (actions column). */
  hideLabel?: boolean;
}

export interface DataTableProps<T> {
  "aria-label": string;
  columns: DataTableColumn[];
  /** Visible column keys (from usePersistentColumns); all when omitted. */
  visibleColumns?: Set<string>;
  rows: T[];
  getRowKey: (row: T) => string;
  renderCell: (row: T, columnKey: string) => ReactNode;
  /** First load: skeleton rows. */
  isLoading?: boolean;
  /** Later loads: fade the rows and show the progress line. */
  isReloading?: boolean;
  /** Toolbar row above the table (TableToolbar / TopHeader). */
  toolbar?: ReactNode;
  /** Shown instead of the toolbar while rows are selected (SelectionBar). */
  bulkBar?: ReactNode;
  /** Pagination footer (TablePagination). */
  footer?: ReactNode;
  sort?: TableSort;
  onSortChange?: (sort: TableSort) => void;
  selectedKeys?: Selection;
  onSelectionChange?: (keys: Selection) => void;
  onRowAction?: (row: T) => void;
  /** Pin the first data column (the name) on sideways scroll. */
  stickyFirstColumn?: boolean;
  /** Empty because of a filter → a small inline line; truly empty → the illustrated EmptyState. */
  emptyContent?: ReactNode;
  /** Height of the scroll area, e.g. "max-h-[70vh]"; the header sticks inside it. */
  scrollClassName?: string;
  className?: string;
}

/** 8 skeleton rows shaped like table rows. */
export function TableSkeletonRows({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex w-full flex-col bg-surface" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex h-14 items-center gap-4 border-b border-line-subtle px-4">
          <Skeleton className="size-9 shrink-0" />
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="ml-auto h-3.5 w-16" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  );
}

/** One-line cell text: ellipsis, full text in a tooltip. Names never wrap (§3.1). */
export function CellText({ children, className }: { children: ReactNode; className?: string }) {
  const text = typeof children === "string" || typeof children === "number" ? String(children) : undefined;
  const body = <span className={cx("block max-w-full truncate", className)}>{children}</span>;
  return text && text.length > 32 ? (
    <Tooltip content={text} placement="top-start">
      {body}
    </Tooltip>
  ) : (
    body
  );
}

const toDescriptor = (sort?: TableSort): SortDescriptor | undefined =>
  sort ? { column: sort.column, direction: sort.direction === "asc" ? "ascending" : "descending" } : undefined;

export function DataTable<T>({
  columns,
  visibleColumns,
  rows,
  getRowKey,
  renderCell,
  isLoading = false,
  isReloading = false,
  toolbar,
  bulkBar,
  footer,
  sort,
  onSortChange,
  selectedKeys,
  onSelectionChange,
  onRowAction,
  stickyFirstColumn = false,
  emptyContent,
  scrollClassName,
  className,
  ...rest
}: DataTableProps<T>) {
  const shown = visibleColumns ? columns.filter((column) => visibleColumns.has(column.key)) : columns;
  const selectable = !!onSelectionChange;
  const hasSelection = selectedKeys === "all" || (selectedKeys instanceof Set && selectedKeys.size > 0);
  const byKey = new Map(rows.map((row) => [getRowKey(row), row]));
  // The pinned name column sits after the 40px checkbox column when rows are selectable.
  const pinned = stickyFirstColumn
    ? selectable
      ? "[&_th:nth-child(2)]:sticky [&_th:nth-child(2)]:left-10 [&_td:nth-child(2)]:sticky [&_td:nth-child(2)]:left-10 [&_th:first-child]:sticky [&_th:first-child]:left-0 [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:nth-child(-n+2)]:z-10 [&_td:nth-child(-n+2)]:bg-surface"
      : "[&_th:first-child]:sticky [&_th:first-child]:left-0 [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:z-10 [&_td:first-child]:bg-surface"
    : undefined;

  return (
    <div className={cx("relative flex flex-col overflow-hidden rounded-card border border-line bg-surface", className)}>
      {hasSelection && bulkBar ? bulkBar : toolbar}
      {isReloading ? (
        <div aria-hidden className="absolute inset-x-0 top-0 z-30 h-0.5 overflow-hidden">
          <div className="h-full w-1/3 animate-pulse bg-brand" />
        </div>
      ) : null}
      <Table
        aria-label={rest["aria-label"]}
        isHeaderSticky
        removeWrapper
        selectionMode={selectable ? "multiple" : "none"}
        selectionBehavior="toggle"
        selectedKeys={selectedKeys}
        onSelectionChange={onSelectionChange}
        sortDescriptor={toDescriptor(sort)}
        onSortChange={(descriptor) =>
          onSortChange?.({
            column: String(descriptor.column),
            direction: descriptor.direction === "ascending" ? "asc" : "desc",
          })
        }
        onRowAction={
          onRowAction
            ? (key: Key) => {
                const row = byKey.get(String(key));
                if (row) onRowAction(row);
              }
            : undefined
        }
        checkboxesProps={{ classNames: tableCheckboxClassNames }}
        classNames={{
          base: cx("overflow-auto custom-scroll", scrollClassName, pinned),
          table: "min-w-full",
          thead: "sticky top-0 z-20 [&>tr]:first:shadow-none",
          th: cx(tableHeaderCellClasses, "whitespace-nowrap first:w-10 data-[sortable=true]:cursor-pointer"),
          td: cx(tableCellClasses, "whitespace-nowrap first:w-10"),
          tr: cx(tableRowClasses, onRowAction && "cursor-pointer"),
          tbody: cx("transition-opacity duration-fast", isReloading && "opacity-60"),
        }}
      >
        <TableHeader columns={shown}>
          {(column) => (
            <TableColumn
              key={column.key}
              align={column.align ?? (column.key === "actions" ? "end" : "start")}
              allowsSorting={!!column.sortable && !!onSortChange}
              className={cx(column.key === "actions" && "w-12", column.className)}
            >
              {column.hideLabel ? <span className="sr-only">{column.label}</span> : column.label}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody
          items={rows}
          isLoading={isLoading && rows.length === 0}
          loadingContent={<TableSkeletonRows />}
          emptyContent={
            isLoading
              ? " "
              : (emptyContent ?? (
                  <EmptyState
                    title="Nothing here yet"
                    description="When there's something to show, it will appear here."
                    className="py-16"
                  />
                ))
          }
        >
          {(row) => (
            <TableRow key={getRowKey(row)}>
              {(columnKey) => (
                <TableCell className={columns.find((c) => c.key === columnKey)?.align === "end" ? "text-right num" : undefined}>
                  {renderCell(row, String(columnKey))}
                </TableCell>
              )}
            </TableRow>
          )}
        </TableBody>
      </Table>
      {footer}
    </div>
  );
}
