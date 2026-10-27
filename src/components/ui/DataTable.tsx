/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * The shared data table (docs/design/02-components.md §6, 09-settings-and-scale.md §3.1–3.2). One card:
 * toolbar (or the bulk bar while rows are selected) → table → pagination footer. Server-side paging and
 * sorting: the page passes one page of rows, the total, and handles onSortChange; use useTableUrlState to keep
 * it all in the URL and usePersistentColumns for the Columns choice.
 *
 * - First load: one page of skeleton rows in the real columns, never a spinner in a blank card.
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
import { DEFAULT_PAGE_SIZE } from "./TablePagination";
import type { TableSort } from "./table-state";
import {
  tableActionsColumnClass,
  tableCellClasses,
  tableCheckboxClassNames,
  tableHeaderCellClasses,
  tableRowClasses,
} from "./table-styles";
import { Tooltip } from "./Tooltip";

export interface DataTableColumn {
  key: string;
  label: ReactNode;
  /** Numbers and money: "end" (right-aligned, tabular). The actions column is always "end". */
  align?: "start" | "center" | "end";
  /** Server-side sort on this column. */
  sortable?: boolean;
  /** Fixed width class, e.g. "w-40" (the 32px checkbox column and the actions column are set for you). */
  className?: string;
  /** Visually hidden header text. Ignored on the actions column, which always shows "Actions" (owner 2026-10-27). */
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

/** A first-load placeholder row: one skeleton bar per visible column, one page of them. */
interface SkeletonRow {
  skeletonKey: string;
}
const SKELETON_ROWS: SkeletonRow[] = Array.from({ length: DEFAULT_PAGE_SIZE }, (_, index) => ({
  skeletonKey: `skeleton-${index}`,
}));
const SKELETON_KEYS = SKELETON_ROWS.map((row) => row.skeletonKey);
const isSkeletonRow = (row: unknown): row is SkeletonRow =>
  typeof row === "object" && row !== null && "skeletonKey" in row;

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
  // First load: placeholder rows in the real columns, so the header keeps its widths and the bars line up.
  const showSkeleton = isLoading && rows.length === 0;
  const items: (T | SkeletonRow)[] = showSkeleton ? SKELETON_ROWS : rows;
  const rowKey = (item: T | SkeletonRow) => (isSkeletonRow(item) ? item.skeletonKey : getRowKey(item));
  const hasSelection = selectedKeys === "all" || (selectedKeys instanceof Set && selectedKeys.size > 0);
  const byKey = new Map(rows.map((row) => [getRowKey(row), row]));
  // The checkbox column is 32px: 16px left padding + the 16px box, no right padding, so the next column sits close.
  const checkboxColumn = selectable ? "first:w-8 first:pe-0" : undefined;
  // The pinned name column sits after the 32px checkbox column when rows are selectable.
  const pinned = stickyFirstColumn
    ? selectable
      ? "[&_th:nth-child(2)]:sticky [&_th:nth-child(2)]:left-8 [&_td:nth-child(2)]:sticky [&_td:nth-child(2)]:left-8 [&_th:first-child]:sticky [&_th:first-child]:left-0 [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:nth-child(-n+2)]:z-10 [&_td:nth-child(-n+2)]:bg-surface"
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
        selectedKeys={showSkeleton ? new Set<string>() : selectedKeys}
        disabledKeys={showSkeleton ? SKELETON_KEYS : undefined}
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
          base: cx("overflow-auto custom-scroll no-scrollbar-x", scrollClassName, pinned),
          table: "min-w-full",
          thead: "sticky top-0 z-20 [&>tr]:first:shadow-none",
          th: cx(tableHeaderCellClasses, "whitespace-nowrap data-[sortable=true]:cursor-pointer", checkboxColumn),
          td: cx(tableCellClasses, "whitespace-nowrap", checkboxColumn),
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
              className={cx(column.key === "actions" && tableActionsColumnClass, column.className)}
            >
              {column.key === "actions"
                ? column.label || "Actions"
                : column.hideLabel
                  ? <span className="sr-only">{column.label}</span>
                  : column.label}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody
          items={items}
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
            <TableRow key={rowKey(row)}>
              {(columnKey) => {
                const align = columns.find((c) => c.key === columnKey)?.align;
                return (
                  <TableCell className={align === "end" ? "text-right num" : undefined}>
                    {isSkeletonRow(row) ? (
                      <Skeleton className={cx("h-3.5", columnKey === "actions" ? "ml-auto w-6" : "w-3/4 min-w-12", align === "end" && "ml-auto")} />
                    ) : (
                      renderCell(row, String(columnKey))
                    )}
                  </TableCell>
                );
              }}
            </TableRow>
          )}
        </TableBody>
      </Table>
      {footer}
    </div>
  );
}
