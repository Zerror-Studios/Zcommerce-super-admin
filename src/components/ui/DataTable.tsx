/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * The shared data table (01 §7.14). One card: toolbar (or the bulk bar while rows are selected) → optional filter
 * chips → table → pagination footer. Server-side paging and sorting: the page passes one page of rows, the total,
 * and handles onSortChange; use useTableUrlState to keep it all in the URL and usePersistentColumns for Columns.
 *
 * - The page scrolls, not the table: the header row sticks under the page top (`--zc-sticky-top`, raised by a
 *   sticky detail header and by the 56px top bar under 1024px) and shows a soft shadow while stuck. Below 1280px a
 *   table may scroll sideways inside its card (the header then stops sticking).
 * - Rows are 52px (64px with `rowHeight="tall"`: a 40px thumbnail or two lines). Every column is left-aligned
 *   (money and dates too), with tabular figures.
 * - First load: 10 skeleton rows shaped like each column. Reloads keep the rows at 60% under a thin progress line.
 * - `rowActions(row)` adds the 56px ⋯ column (RowMenu). `hideWhen: "narrow"` columns hide when the measured card
 *   is narrower than the fixed widths + 200px. Under 768px the rows become stacked list rows.
 */
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import type { Selection, SortDescriptor } from "@heroui/react";
import { useEffect, useRef, useState, type Key, type ReactNode } from "react";
import { cx } from "./cx";
import { EmptyState } from "./EmptyState";
import { IconExpand } from "./icons";
import { RowMenu, type RowMenuItem } from "./RowMenu";
import { Skeleton } from "./Skeleton";
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
  /** LEGACY: v2 left-aligns every column. "end" now only adds tabular figures. */
  align?: "start" | "center" | "end";
  /** Server-side sort on this column. */
  sortable?: boolean;
  /** Fixed width in px (widest content + 32). The name column leaves it out and takes the rest (min 200). */
  width?: number;
  /** LEGACY fixed width class, e.g. "w-40". Prefer `width`. */
  className?: string;
  /** Visually hidden header text. */
  hideLabel?: boolean;
  /** "narrow": the page spec's "tablet: hide". */
  hideWhen?: "narrow";
  /** Skeleton shape while loading (default a text bar). */
  skeleton?: "text" | "thumb" | "badge" | "avatar";
  /** Phone list row: "primary" is line 1 (default: the first column), "badge" sits on the right of line 1. */
  mobile?: "primary" | "badge" | "hide";
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
  /** Applied-filter chips under the toolbar. */
  chips?: ReactNode;
  /** Pagination footer (TablePagination). */
  footer?: ReactNode;
  sort?: TableSort;
  onSortChange?: (sort: TableSort) => void;
  selectedKeys?: Selection;
  onSelectionChange?: (keys: Selection) => void;
  onRowAction?: (row: T) => void;
  /** The ⋯ menu for each row (adds the 56px actions column). */
  rowActions?: (row: T) => RowMenuItem[];
  /** "Actions for #1042": names each row's ⋯ button. */
  rowActionsLabel?: (row: T) => string;
  /** 52px rows; "tall" = 64px (40px thumbnails or two-line cells). */
  rowHeight?: "default" | "tall";
  /** Pin the first data column (the name) on sideways scroll. */
  stickyFirstColumn?: boolean;
  /** Empty because of a filter → EmptyState kind="no-results"; truly empty → the first-use EmptyState. */
  emptyContent?: ReactNode;
  /** Phone list row (under 768px); without it the default row of 01 §7.14 is built from the columns. */
  mobileRow?: (row: T) => ReactNode;
  /** LEGACY: an inner scroll area (e.g. "max-h-[70vh]"); the header then sticks inside it. */
  scrollClassName?: string;
  className?: string;
}

const SKELETON_ROW_COUNT = 10;
const ACTIONS_KEY = "__actions";
const ACTIONS_WIDTH = 56;
const CHECKBOX_WIDTH = 44;
const FLEX_MIN_WIDTH = 200;
const PHONE_QUERY = "(max-width: 767px)";

/** LEGACY: 8 skeleton rows for lists that aren't a DataTable yet. */
export function TableSkeletonRows({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex w-full flex-col bg-surface" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex h-13 items-center gap-4 border-b border-line-subtle px-4">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

/** A first-load placeholder row: one skeleton block per visible column. */
interface SkeletonRow {
  skeletonKey: string;
  index: number;
}
const SKELETON_ROWS: SkeletonRow[] = Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => ({
  skeletonKey: `skeleton-${index}`,
  index,
}));
const SKELETON_KEYS = SKELETON_ROWS.map((row) => row.skeletonKey);
const isSkeletonRow = (row: unknown): row is SkeletonRow =>
  typeof row === "object" && row !== null && "skeletonKey" in row;
/** Text bars at 40–80% of the column, varied per row so the block reads like text. */
const SKELETON_WIDTHS = ["w-4/5", "w-3/5", "w-2/3", "w-1/2", "w-3/4", "w-2/5"];

function CellSkeleton({ shape, index, actions }: { shape?: DataTableColumn["skeleton"]; index: number; actions?: boolean }) {
  if (actions) return <Skeleton className="size-8 rounded-full" />;
  if (shape === "thumb") return <Skeleton className="size-10 rounded-lg" />;
  if (shape === "avatar") return <Skeleton className="size-8 rounded-full" />;
  if (shape === "badge") return <Skeleton className="h-5.5 w-16 rounded-md" />;
  return <Skeleton className={cx("h-3 min-w-10 rounded-md", SKELETON_WIDTHS[index % SKELETON_WIDTHS.length])} />;
}

/** One-line cell text: ellipsis, full text in a tooltip. Names never wrap. */
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

function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(PHONE_QUERY).matches : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia(PHONE_QUERY);
    const onChange = () => setPhone(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return phone;
}

/** The card's own width (not the window's), for "tablet: hide" columns (02 §14). */
function useCardWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>();
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** True while the sticky header is stuck: a sentinel above the table has scrolled past the sticky line. */
function useStuck(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node || typeof IntersectionObserver === "undefined") return undefined;
    const top = parseFloat(getComputedStyle(node).getPropertyValue("--zc-sticky-top")) || 0;
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting && entry.boundingClientRect.top < top + 1),
      { rootMargin: `-${top + 1}px 0px 0px 0px`, threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled]);
  return [ref, stuck] as const;
}

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
  chips,
  footer,
  sort,
  onSortChange,
  selectedKeys,
  onSelectionChange,
  onRowAction,
  rowActions,
  rowActionsLabel,
  rowHeight = "default",
  stickyFirstColumn = false,
  emptyContent,
  mobileRow,
  scrollClassName,
  className,
  ...rest
}: DataTableProps<T>) {
  const isPhone = useIsPhone();
  const [cardRef, cardWidth] = useCardWidth();
  const [sentinelRef, stuck] = useStuck(!scrollClassName);
  const selectable = !!onSelectionChange;

  const visible = visibleColumns ? columns.filter((column) => visibleColumns.has(column.key)) : columns;
  const withActions: DataTableColumn[] =
    rowActions && !visible.some((column) => column.key === "actions")
      ? [...visible, { key: ACTIONS_KEY, label: "Actions", hideLabel: true, width: ACTIONS_WIDTH }]
      : visible;
  // "tablet: hide" columns go when the card can't fit every fixed width plus the flex column's 200px.
  const fixedWidth =
    withActions.reduce((sum, column) => sum + (column.width ?? 0), 0) + (selectable ? CHECKBOX_WIDTH : 0);
  const narrow = cardWidth != null && cardWidth < fixedWidth + FLEX_MIN_WIDTH;
  const shown = narrow ? withActions.filter((column) => column.hideWhen !== "narrow") : withActions;
  const isActionsColumn = (key: string) => key === "actions" || key === ACTIONS_KEY;

  // First load: placeholder rows in the real columns, so the header keeps its widths and the blocks line up.
  const showSkeleton = isLoading && rows.length === 0;
  const items: (T | SkeletonRow)[] = showSkeleton ? SKELETON_ROWS : rows;
  const rowKey = (item: T | SkeletonRow) => (isSkeletonRow(item) ? item.skeletonKey : getRowKey(item));
  const hasSelection = selectedKeys === "all" || (selectedKeys instanceof Set && selectedKeys.size > 0);
  const byKey = new Map(rows.map((row) => [getRowKey(row), row]));

  const renderActions = (row: T) =>
    rowActions ? (
      <RowMenu items={rowActions(row)} label={rowActionsLabel?.(row) ?? "More actions"} />
    ) : null;
  const cellContent = (row: T, key: string) => (key === ACTIONS_KEY ? renderActions(row) : renderCell(row, key));

  const empty =
    emptyContent ?? (
      <EmptyState
        title="Nothing here yet"
        description="When there's something to show, it shows up here."
      />
    );

  const checkboxColumn = selectable ? "first:w-11 first:min-w-11 first:pe-0" : undefined;
  // The pinned name column sits after the 44px checkbox column when rows are selectable.
  const pinned = stickyFirstColumn
    ? selectable
      ? "[&_th:nth-child(2)]:sticky [&_th:nth-child(2)]:left-11 [&_td:nth-child(2)]:sticky [&_td:nth-child(2)]:left-11 [&_th:first-child]:sticky [&_th:first-child]:left-0 [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:nth-child(-n+2)]:z-10 [&_td:nth-child(-n+2)]:bg-surface"
      : "[&_th:first-child]:sticky [&_th:first-child]:left-0 [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:z-10 [&_td:first-child]:bg-surface"
    : undefined;

  const progress = isReloading ? (
    <div aria-hidden className="absolute inset-x-0 top-0 z-30 h-0.5 overflow-hidden">
      <div className="h-full w-1/3 animate-pulse bg-brand" />
    </div>
  ) : null;

  const card = (body: ReactNode) => (
    <div
      ref={cardRef}
      className={cx(
        "relative flex flex-col overflow-clip rounded-[var(--zc-radius-card)] border border-line bg-surface",
        className,
      )}
      aria-busy={isLoading || isReloading || undefined}
    >
      {hasSelection && bulkBar ? bulkBar : toolbar}
      {chips}
      {progress}
      {body}
      {footer}
    </div>
  );

  // ─── Phone: stacked list rows (01 §7.14) ─────────────────────────────────────
  if (isPhone) {
    const dataColumns = shown.filter((column) => !isActionsColumn(column.key) && column.mobile !== "hide");
    const primary = dataColumns.find((column) => column.mobile === "primary") ?? dataColumns[0];
    const badge = dataColumns.find((column) => column.mobile === "badge");
    const others = dataColumns
      .filter((column) => column !== primary && column !== badge && column.hideWhen !== "narrow")
      .slice(0, 3);
    const defaultRow = (row: T) => (
      <>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0 truncate text-body font-medium text-fg">{primary ? renderCell(row, primary.key) : null}</div>
          {badge ? <div className="shrink-0">{renderCell(row, badge.key)}</div> : null}
        </div>
        {others.length ? (
          <div className="mt-1 flex min-w-0 items-center gap-1.5 overflow-hidden text-label text-fg-muted [&>*]:min-w-0 [&>*]:truncate">
            {others.map((column, index) => (
              <span key={column.key} className="flex min-w-0 items-center gap-1.5">
                {index > 0 ? <span aria-hidden>·</span> : null}
                <span className="min-w-0 truncate">{renderCell(row, column.key)}</span>
              </span>
            ))}
          </div>
        ) : null}
      </>
    );
    return card(
      <ul aria-label={rest["aria-label"]} className={cx("transition-opacity duration-fast", isReloading && "opacity-60")}>
        {showSkeleton
          ? SKELETON_ROWS.map((row) => (
              <li key={row.skeletonKey} className="flex min-h-18 flex-col justify-center gap-2 border-b border-line-subtle px-4 py-3 last:border-b-0">
                <CellSkeleton index={row.index} />
                <Skeleton className="h-2.5 w-1/2 rounded-md" />
              </li>
            ))
          : rows.length === 0
            ? <li>{empty}</li>
            : rows.map((row) => {
                const actions = rowActions?.(row).filter((item) => item.key !== "open") ?? [];
                const content = mobileRow ? mobileRow(row) : defaultRow(row);
                return (
                  <li key={getRowKey(row)} className="flex min-h-18 items-center gap-2 border-b border-line-subtle px-4 py-3 last:border-b-0">
                    {onRowAction ? (
                      <button
                        type="button"
                        onClick={() => onRowAction(row)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:rounded-lg focus-visible:shadow-focus-strong"
                      >
                        <div className="min-w-0 flex-1">{content}</div>
                        <IconExpand aria-hidden className="size-4 shrink-0 text-fg-subtle" />
                      </button>
                    ) : (
                      <div className="min-w-0 flex-1">{content}</div>
                    )}
                    {actions.length ? (
                      <RowMenu items={actions} label={rowActionsLabel?.(row) ?? "More actions"} />
                    ) : null}
                  </li>
                );
              })}
      </ul>,
    );
  }

  // ─── Desktop and tablet: the table ───────────────────────────────────────────
  return card(
    <>
      <div ref={sentinelRef} aria-hidden className="h-0" />
      <Table
        aria-label={rest["aria-label"]}
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
          base: cx(
            scrollClassName ? cx("overflow-auto custom-scroll no-scrollbar-x", scrollClassName) : "max-xl:overflow-x-auto max-xl:custom-scroll",
            pinned,
          ),
          table: "min-w-full",
          thead: cx(
            scrollClassName ? "sticky top-0 z-20" : "xl:sticky xl:top-[var(--zc-sticky-top)] xl:z-20",
            "[&>tr]:first:shadow-none transition-shadow duration-fast",
            stuck && "shadow-sticky",
          ),
          th: cx(tableHeaderCellClasses, "whitespace-nowrap data-[sortable=true]:cursor-pointer", checkboxColumn),
          td: cx(tableCellClasses, rowHeight === "tall" && "h-16", "whitespace-nowrap", checkboxColumn),
          tr: cx(tableRowClasses, onRowAction && "cursor-pointer"),
          tbody: cx("transition-opacity duration-fast", isReloading && "opacity-60"),
        }}
      >
        <TableHeader columns={shown}>
          {(column) => (
            <TableColumn
              key={column.key}
              align="start"
              width={column.width}
              allowsSorting={!!column.sortable && !!onSortChange}
              className={cx(isActionsColumn(column.key) && tableActionsColumnClass, column.className)}
            >
              {column.hideLabel || isActionsColumn(column.key) ? (
                <span className="sr-only">{column.label || "Actions"}</span>
              ) : (
                column.label
              )}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody items={items} emptyContent={isLoading ? " " : empty}>
          {(row) => (
            <TableRow key={rowKey(row)}>
              {(columnKey) => {
                const key = String(columnKey);
                const column = shown.find((c) => c.key === key);
                return (
                  <TableCell className={column?.align === "end" ? "num" : undefined}>
                    {isSkeletonRow(row) ? (
                      <CellSkeleton shape={column?.skeleton} index={row.index} actions={isActionsColumn(key)} />
                    ) : (
                      cellContent(row, key)
                    )}
                  </TableCell>
                );
              }}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>,
  );
}
