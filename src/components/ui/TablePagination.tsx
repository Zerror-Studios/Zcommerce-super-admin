/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { cx } from "./cx";
import { IconButton } from "./IconButton";
import { IconNextPage, IconPrevPage } from "./icons";
import { formatCount } from "./money";

/** Owner choice (2026-10-26): every table shows at most 10 rows a page, so there is no rows-per-page choice. */
export const PAGE_SIZES = [10] as const;
export const DEFAULT_PAGE_SIZE = 10;

export interface TablePaginationProps {
  /** 1-based page. */
  page: number;
  pageSize: number;
  /** Total rows from the API. */
  total: number;
  onPageChange: (page: number) => void;
  /** Omit to hide the rows-per-page choice. */
  onPageSizeChange?: (pageSize: number) => void;
  /** Disable the controls while a page is loading. */
  isDisabled?: boolean;
  className?: string;
}

/**
 * Table footer (docs/design/09-settings-and-scale.md §3.1): "1–50 of 12,480" left; rows per page and
 * previous/next right; 44px. Hidden when everything fits on one page and the size can't change.
 */
export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  isDisabled,
  className,
}: TablePaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const canResize = !!onPageSizeChange && PAGE_SIZES.length > 1;
  if (total === 0 || (pages <= 1 && !canResize)) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className={cx(
        "flex h-11 shrink-0 items-center justify-between gap-3 border-t border-line bg-surface px-4 text-label text-fg-muted",
        className,
      )}
    >
      <p className="num">
        {formatCount(from)}–{formatCount(to)} of {formatCount(total)}
      </p>
      <div className="flex items-center gap-3">
        {canResize ? (
          <label className="hidden items-center gap-2 sm:flex">
            Rows
            <select
              value={pageSize}
              disabled={isDisabled}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="h-7 rounded-field border border-line-strong bg-surface px-1.5 text-label text-fg"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <span className="num">
          Page {formatCount(page)} of {formatCount(pages)}
        </span>
        <div className="flex items-center gap-1">
          <IconButton
            aria-label="Previous page"
            size="sm"
            isDisabled={isDisabled || page <= 1}
            onPress={() => onPageChange(page - 1)}
          >
            <IconPrevPage />
          </IconButton>
          <IconButton
            aria-label="Next page"
            size="sm"
            isDisabled={isDisabled || page >= pages}
            onPress={() => onPageChange(page + 1)}
          >
            <IconNextPage />
          </IconButton>
        </div>
      </div>
    </nav>
  );
}
