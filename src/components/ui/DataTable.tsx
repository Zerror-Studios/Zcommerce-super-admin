/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * The shared data table (v2 §4.3, §4.4). The toolbar (tabs, search, filter, sort, view switch) and the applied-filter
 * chips sit ABOVE the card, never inside it; the card holds the bulk bar while rows are selected → table →
 * pagination footer. Rows that open something end in a small 30px chevron (`rowChevron`, on by default with
 * `onRowAction`). Server-side paging and sorting: the page passes one page of rows, the total,
 * and handles onSortChange; use useTableUrlState to keep it all in the URL and usePersistentColumns for Columns.
 *
 * - The page scrolls, not the table: the header row sticks under the page top (`--zc-sticky-top`, raised by a
 *   sticky detail header) and shows a soft shadow while stuck. Below 1280px a
 *   table may scroll sideways inside its card (the header then stops sticking).
 * - Rows are 60px (64px with `rowHeight="tall"`: a 40px thumbnail or two lines; v2 §4.4). Every column is left-aligned
 *   (money and dates too), with tabular figures.
 * - First load: 10 skeleton rows shaped like each column. Reloads keep the rows at 60% under a thin progress line.
 * - `rowActions(row)` adds the 56px ⋯ column (RowMenu). `hideWhen: "narrow"` columns (the low-priority ones: keep
 *   the identifier, the key number, status and the chevron) hide when the measured card is narrower than the fixed
 *   widths + 200px (laptop and tablet, v2 §10); they stay in Choose columns.
 * - Under 768px (v2 §10) each row becomes a card: line 1 the identifier (`mobile: "primary"`, default the first
 *   column) and the key number right-aligned (`"value"`); line 2 the name or customer (`"title"`) and the date
 *   (`"meta"`); line 3 the status badges (`"badge"`, several allowed). Without title/meta columns line 2 lists up to
 *   three other columns. A tap opens the row; with selection, a long press selects it and, while anything is
 *   selected, a tap toggles instead (each card also has a screen-reader "Select" button). `hideWhen: "narrow"` has
 *   no effect here (the card picks columns by role). A column's `mobileCell(row)` replaces its `renderCell` on the
 *   card and `mobileMeta(row)` fills line 2 right, so a two-line identifier ("#1897" / date) needs no `mobileRow`.
 * - `rowTone(row)` tints a failing ("danger") or past-due ("warning") row very lightly (boards 16, 59, 63); the
 *   status badge still says why. The phone card gets the same tint.
 * - `renderExpanded(row)` makes rows expandable (board 59): a round "Show details" toggle before the chevron, and a
 *   real full-width row under the open row (one cell spanning every column; on phone, a panel inside the card).
 *   Controlled with `expandedKeys` / `onExpandedChange`, or left to the table. `canExpand(row)` hides the toggle
 *   on rows with nothing to show.
 */
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import type { Selection, SortDescriptor } from "@heroui/react";
import { useEffect, useRef, useState, type Key, type PointerEvent, type ReactNode } from "react";
import { cx } from "./cx";
import { EmptyState } from "./EmptyState";
import { IconCaret, IconCheck, IconNextPage } from "./icons";
import { RowChevron, rowControlProps } from "./TableToolbar";
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
import { useIsPhone } from "./use-media";

export interface DataTableColumn<T = unknown> {
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
  /**
   * Phone card (v2 §10): "primary" line 1 left (default: the first column), "value" line 1 right (the key number),
   * "title" line 2 left (name or customer), "meta" line 2 right (the date), "badge" line 3 (status), "hide".
   */
  mobile?: "primary" | "value" | "title" | "meta" | "badge" | "hide";
  /**
   * Phone card only: what this column shows on the card instead of `renderCell` (e.g. the number without the date).
   * A method, so a typed column list still fits wherever plain `DataTableColumn[]` is expected.
   */
  mobileCell?(row: T): ReactNode;
  /**
   * Phone card only: line 2 right (the date) taken from this column when no column has `mobile: "meta"`. With
   * `mobileCell` it splits a two-line identifier ("#1897" over "4 Nov, 10:12") into line 1 and the date.
   */
  mobileMeta?(row: T): ReactNode;
}

export interface DataTableProps<T> {
  "aria-label": string;
  /** NoInfer: the row type comes from `rows` / `renderCell`; a plain `DataTableColumn[]` list still fits. */
  columns: DataTableColumn<NoInfer<T>>[];
  /** Visible column keys (from usePersistentColumns); all when omitted. */
  visibleColumns?: Set<string>;
  rows: T[];
  getRowKey: (row: T) => string;
  renderCell: (row: T, columnKey: string) => ReactNode;
  /** First load: skeleton rows. */
  isLoading?: boolean;
  /** Later loads: fade the rows and show the progress line. */
  isReloading?: boolean;
  /** Toolbar above the table card (TableToolbar). Rendered outside the card (v2 §4.3). */
  toolbar?: ReactNode;
  /** Shown at the top of the card while rows are selected (SelectionBar). */
  bulkBar?: ReactNode;
  /** Applied-filter chips under the toolbar, above the card. */
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
  /** 60px rows; "tall" = 64px (40px thumbnails or two-line cells). */
  rowHeight?: "default" | "tall";
  /** The 30px chevron at the row end (v2 §4.4). Default: shown when `onRowAction` is set. */
  rowChevron?: boolean;
  /** Pin the first data column (the name) on sideways scroll. */
  stickyFirstColumn?: boolean;
  /** Empty because of a filter → EmptyState kind="no-results"; truly empty → the first-use EmptyState. */
  emptyContent?: ReactNode;
  /** Phone card body (under 768px); without it the three-line card is built from the columns' `mobile` roles. */
  mobileRow?: (row: T) => ReactNode;
  /** A light tint for rows that need attention: "danger" (failing, sold out) or "warning" (past due, running low). */
  rowTone?: (row: T) => DataTableRowTone | undefined;
  /** The detail shown in a full-width row under an expanded row (board 59). Adds the expand toggle column. */
  renderExpanded?: (row: T) => ReactNode;
  /** Rows that can expand; default every row (when `renderExpanded` is set). */
  canExpand?: (row: T) => boolean;
  /** Expanded row keys (controlled). Without it the table keeps its own. */
  expandedKeys?: ReadonlySet<string>;
  onExpandedChange?: (keys: Set<string>) => void;
  /** Names each row's expand toggle: "Details for Kesar & Kin". Default "Show details". */
  expandLabel?: (row: T) => string;
  /** LEGACY: an inner scroll area (e.g. "max-h-[70vh]"); the header then sticks inside it. */
  scrollClassName?: string;
  className?: string;
}

export type DataTableRowTone = "danger" | "warning";

const SKELETON_ROW_COUNT = 10;
const ACTIONS_KEY = "__actions";
const ACTIONS_WIDTH = 56;
const CHEVRON_KEY = "__chevron";
const CHEVRON_WIDTH = 48;
const EXPAND_KEY = "__expand";
const EXPAND_WIDTH = 48;
const EXPANDED_SUFFIX = "::expanded";
const CHECKBOX_WIDTH = 44;
const FLEX_MIN_WIDTH = 200;
const LONG_PRESS_MS = 500;
const LONG_PRESS_SLOP_PX = 10;

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
/** The full-width detail row under an expanded row (desktop table). */
interface ExpandedRow<T> {
  expandedKey: string;
  row: T;
}
function isExpandedRow<T>(row: unknown): row is ExpandedRow<T> {
  return typeof row === "object" && row !== null && "expandedKey" in row;
}
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

/**
 * Long press on a phone card (v2 §10: bulk select). Returns pointer handlers and `consumeClick`, true once right
 * after a long press so the click that follows doesn't also open the row.
 */
function useLongPress(onLongPress: (key: string) => void) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const callback = useRef(onLongPress);
  callback.current = onLongPress;
  const cancel = () => {
    window.clearTimeout(timer.current);
    start.current = null;
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const handlers = (key: string) => ({
    onPointerDown: (event: PointerEvent) => {
      if (event.button !== 0) return;
      fired.current = false;
      start.current = { x: event.clientX, y: event.clientY };
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        fired.current = true;
        start.current = null;
        callback.current(key);
      }, LONG_PRESS_MS);
    },
    onPointerMove: (event: PointerEvent) => {
      const origin = start.current;
      if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > LONG_PRESS_SLOP_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
  });
  const consumeClick = () => {
    const was = fired.current;
    fired.current = false;
    return was;
  };
  return { handlers, consumeClick };
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
  rowChevron,
  stickyFirstColumn = false,
  emptyContent,
  mobileRow,
  rowTone,
  renderExpanded,
  canExpand,
  expandedKeys,
  onExpandedChange,
  expandLabel,
  scrollClassName,
  className,
  ...rest
}: DataTableProps<T>) {
  const isPhone = useIsPhone();
  const [cardRef, cardWidth] = useCardWidth();
  /** Phone cards: add or remove one row from the selection ("all" becomes every row on the page but this one). */
  const toggleSelected = (key: string) => {
    if (!onSelectionChange) return;
    const next = new Set<string | number>(
      selectedKeys === "all" ? rows.map(getRowKey) : selectedKeys instanceof Set ? selectedKeys : [],
    );
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange(next);
  };
  const longPress = useLongPress(toggleSelected);
  const [sentinelRef, stuck] = useStuck(!scrollClassName);
  const selectable = !!onSelectionChange;
  const [ownExpanded, setOwnExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const expanded = expandedKeys ?? ownExpanded;
  const expandable = (row: T) => !!renderExpanded && (canExpand?.(row) ?? true);
  const isExpanded = (key: string) => expanded.has(key);
  const toggleExpanded = (key: string) => {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    if (expandedKeys == null) setOwnExpanded(next);
    onExpandedChange?.(next);
  };
  const expandedId = (key: string) => `zc-dt-x-${key.replace(/[^A-Za-z0-9_-]/g, "_")}`;

  const visible = visibleColumns ? columns.filter((column) => visibleColumns.has(column.key)) : columns;
  const showChevron = rowChevron ?? !!onRowAction;
  const withMenu: DataTableColumn<T>[] =
    rowActions && !visible.some((column) => column.key === "actions")
      ? [...visible, { key: ACTIONS_KEY, label: "Actions", hideLabel: true, width: ACTIONS_WIDTH }]
      : visible;
  const withExpand: DataTableColumn<T>[] = renderExpanded
    ? [...withMenu, { key: EXPAND_KEY, label: "Details", hideLabel: true, width: EXPAND_WIDTH }]
    : withMenu;
  const withActions: DataTableColumn<T>[] = showChevron
    ? [...withExpand, { key: CHEVRON_KEY, label: "Open", hideLabel: true, width: CHEVRON_WIDTH }]
    : withExpand;
  // "tablet: hide" columns go when the card can't fit every fixed width plus the flex column's 200px.
  const fixedWidth =
    withActions.reduce((sum, column) => sum + (column.width ?? 0), 0) + (selectable ? CHECKBOX_WIDTH : 0);
  const narrow = cardWidth != null && cardWidth < fixedWidth + FLEX_MIN_WIDTH;
  const shown = narrow ? withActions.filter((column) => column.hideWhen !== "narrow") : withActions;
  const isActionsColumn = (key: string) =>
    key === "actions" || key === ACTIONS_KEY || key === CHEVRON_KEY || key === EXPAND_KEY;

  // First load: placeholder rows in the real columns, so the header keeps its widths and the blocks line up.
  const showSkeleton = isLoading && rows.length === 0;
  // An expanded row is followed by its detail row: a real <tr> with one cell spanning every column.
  const items: (T | SkeletonRow | ExpandedRow<T>)[] = showSkeleton
    ? SKELETON_ROWS
    : renderExpanded
      ? rows.flatMap((row): (T | ExpandedRow<T>)[] => {
          const key = getRowKey(row);
          return expandable(row) && isExpanded(key) ? [row, { expandedKey: `${key}${EXPANDED_SUFFIX}`, row }] : [row];
        })
      : rows;
  const detailKeys = items.filter((item): item is ExpandedRow<T> => isExpandedRow<T>(item)).map((item) => item.expandedKey);
  const rowKey = (item: T | SkeletonRow | ExpandedRow<T>) =>
    isSkeletonRow(item) ? item.skeletonKey : isExpandedRow<T>(item) ? item.expandedKey : getRowKey(item);
  const hasSelection = selectedKeys === "all" || (selectedKeys instanceof Set && selectedKeys.size > 0);
  const byKey = new Map(rows.map((row) => [getRowKey(row), row]));

  const renderActions = (row: T) =>
    rowActions ? (
      <RowMenu items={rowActions(row)} label={rowActionsLabel?.(row) ?? "More actions"} />
    ) : null;
  const renderToggle = (row: T) => {
    if (!expandable(row)) return null;
    const key = getRowKey(row);
    const open = isExpanded(key);
    return (
      <button
        type="button"
        className="zc-row-expand"
        aria-expanded={open}
        aria-controls={open ? expandedId(key) : undefined}
        aria-label={expandLabel?.(row) ?? "Show details"}
        {...rowControlProps}
        onClick={(event) => {
          event.stopPropagation();
          toggleExpanded(key);
        }}
      >
        <IconCaret aria-hidden />
      </button>
    );
  };
  const cellContent = (row: T, key: string) =>
    key === CHEVRON_KEY ? (
      <RowChevron />
    ) : key === ACTIONS_KEY ? (
      renderActions(row)
    ) : key === EXPAND_KEY ? (
      renderToggle(row)
    ) : (
      renderCell(row, key)
    );

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

  const tableCard = (body: ReactNode) => (
    <div
      ref={cardRef}
      className={cx(
        "relative flex flex-col overflow-clip rounded-[var(--zc-radius-card)] border border-line bg-surface",
        className,
      )}
      aria-busy={isLoading || isReloading || undefined}
    >
      {hasSelection && bulkBar ? bulkBar : null}
      {progress}
      {body}
      {footer}
    </div>
  );
  // v2 §4.3: tabs, search, filter and sort sit above the table, never inside the card.
  const card = (body: ReactNode) =>
    toolbar || chips ? (
      <div className="zc-table-wrap">
        {toolbar ? <div className="zc-table-toolbar">{toolbar}</div> : null}
        {chips}
        {tableCard(body)}
      </div>
    ) : (
      tableCard(body)
    );

  // ─── Phone: one card per row (v2 §10) ──────────────────────────────────────
  if (isPhone) {
    // Cards pick columns by role, so the laptop/tablet "narrow" hiding doesn't apply here.
    const dataColumns = withActions.filter((column) => !isActionsColumn(column.key) && column.mobile !== "hide");
    const primary = dataColumns.find((column) => column.mobile === "primary") ?? dataColumns[0];
    const value = dataColumns.find((column) => column.mobile === "value" && column !== primary);
    const titles = dataColumns.filter((column) => column.mobile === "title" && column !== primary);
    const meta = dataColumns.find((column) => column.mobile === "meta" && column !== primary);
    const metaSource = meta ? undefined : dataColumns.find((column) => column.mobileMeta);
    const badges = dataColumns.filter((column) => column.mobile === "badge" && column !== primary);
    // No line-2 roles: up to three other columns, as before.
    const others =
      titles.length || meta || metaSource
        ? titles
        : dataColumns
            .filter((column) => column !== primary && !column.mobile)
            .slice(0, 3);
    const isSelected = (key: string) =>
      selectedKeys === "all" || (selectedKeys instanceof Set && selectedKeys.has(key));

    const cell = (row: T, column: DataTableColumn<T>) =>
      column.mobileCell ? column.mobileCell(row) : renderCell(row, column.key);
    const metaCell = (row: T) => (meta ? cell(row, meta) : metaSource?.mobileMeta?.(row));
    const defaultCard = (row: T) => (
      <>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0 truncate text-body font-medium text-fg">{primary ? cell(row, primary) : null}</div>
          {value ? <div className="shrink-0 text-body font-semibold text-fg num">{cell(row, value)}</div> : null}
        </div>
        {others.length || meta || metaSource ? (
          <div className="mt-1 flex min-w-0 items-center justify-between gap-3 text-label text-fg-muted">
            <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
              {others.map((column, index) => (
                <span key={column.key} className="flex min-w-0 items-center gap-1.5">
                  {index > 0 ? <span aria-hidden>·</span> : null}
                  <span className="min-w-0 truncate">{cell(row, column)}</span>
                </span>
              ))}
            </div>
            {meta || metaSource ? <div className="shrink-0 num">{metaCell(row)}</div> : null}
          </div>
        ) : null}
        {badges.length ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {badges.map((column) => (
              <span key={column.key} className="inline-flex min-w-0">
                {cell(row, column)}
              </span>
            ))}
          </div>
        ) : null}
      </>
    );

    const cards = (
      <ul aria-label={rest["aria-label"]} className={cx("zc-dt-cards transition-opacity duration-fast", isReloading && "opacity-60")}>
        {showSkeleton
          ? SKELETON_ROWS.map((row) => (
              <li key={row.skeletonKey} className="zc-dt-card flex-col items-stretch justify-center gap-2">
                <CellSkeleton index={row.index} />
                <Skeleton className="h-2.5 w-1/2 rounded-md" />
              </li>
            ))
          : rows.length === 0
            ? <li className="zc-dt-panel">{empty}</li>
            : rows.map((row) => {
                const key = getRowKey(row);
                const selected = selectable && isSelected(key);
                const actions = rowActions?.(row).filter((item) => item.key !== "open") ?? [];
                const content = mobileRow ? mobileRow(row) : defaultCard(row);
                const canOpen = expandable(row);
                const open = canOpen && isExpanded(key);
                const interactive = !!onRowAction || selectable;
                const onPress = () => {
                  if (longPress.consumeClick()) return;
                  if (selectable && hasSelection) toggleSelected(key);
                  else onRowAction?.(row);
                };
                return (
                  <li
                    key={key}
                    className={cx("zc-dt-card", open && "zc-dt-card--open")}
                    data-selected={selected || undefined}
                    data-tone={rowTone?.(row)}
                  >
                    {selectable && hasSelection ? (
                      <span aria-hidden className="zc-dt-card__check">
                        {selected ? <IconCheck /> : null}
                      </span>
                    ) : null}
                    {interactive ? (
                      <button
                        type="button"
                        onClick={onPress}
                        onContextMenu={selectable ? (event) => event.preventDefault() : undefined}
                        aria-pressed={selectable && hasSelection ? selected : undefined}
                        {...(selectable ? longPress.handlers(key) : {})}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:rounded-lg focus-visible:shadow-focus-strong"
                      >
                        <div className="min-w-0 flex-1">{content}</div>
                        {onRowAction && !hasSelection ? (
                          <IconNextPage aria-hidden className="size-4 shrink-0 text-fg-subtle" />
                        ) : null}
                      </button>
                    ) : (
                      <div className="min-w-0 flex-1">{content}</div>
                    )}
                    {selectable ? (
                      <button type="button" className="sr-only" aria-pressed={selected} onClick={() => toggleSelected(key)}>
                        Select
                      </button>
                    ) : null}
                    {actions.length && !hasSelection ? (
                      <RowMenu items={actions} label={rowActionsLabel?.(row) ?? "More actions"} />
                    ) : null}
                    {canOpen && !hasSelection ? renderToggle(row) : null}
                    {open ? (
                      <div id={expandedId(key)} className="zc-dt-card__expanded">
                        {renderExpanded?.(row)}
                      </div>
                    ) : null}
                  </li>
                );
              })}
      </ul>
    );

    return (
      <div className={cx("flex flex-col gap-3", className)} aria-busy={isLoading || isReloading || undefined}>
        {toolbar ? <div className="zc-table-toolbar">{toolbar}</div> : null}
        {chips}
        {hasSelection && bulkBar ? <div className="zc-dt-panel zc-dt-panel--sticky">{bulkBar}</div> : null}
        <div className="relative">
          {progress}
          {cards}
        </div>
        {footer ? <div className="zc-dt-panel">{footer}</div> : null}
      </div>
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
        // Detail rows can't be selected; they stay readable and their controls work.
        disabledKeys={showSkeleton ? SKELETON_KEYS : detailKeys.length ? detailKeys : undefined}
        disabledBehavior={detailKeys.length ? "selection" : undefined}
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
          {(row) =>
            isExpandedRow<T>(row) ? (
              <TableRow key={row.expandedKey} className="zc-dt-expanded">
                <TableCell colSpan={shown.length} className="zc-dt-expanded__cell">
                  <div id={expandedId(getRowKey(row.row))} role="region" aria-label={expandLabel?.(row.row) ?? "Details"}>
                    {renderExpanded?.(row.row)}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
            <TableRow
              key={rowKey(row)}
              data-tone={isSkeletonRow(row) ? undefined : rowTone?.(row)}
              data-expanded={!isSkeletonRow(row) && renderExpanded && isExpanded(getRowKey(row)) ? "true" : undefined}
            >
              {(columnKey) => {
                const key = String(columnKey);
                const column = shown.find((c) => c.key === key);
                return (
                  <TableCell className={column?.align === "end" ? "num" : undefined}>
                    {isSkeletonRow(row) ? (
                      key === CHEVRON_KEY || key === EXPAND_KEY ? null : <CellSkeleton shape={column?.skeleton} index={row.index} actions={isActionsColumn(key)} />
                    ) : (
                      cellContent(row, key)
                    )}
                  </TableCell>
                );
              }}
            </TableRow>
            )
          }
        </TableBody>
      </Table>
    </>,
  );
}
