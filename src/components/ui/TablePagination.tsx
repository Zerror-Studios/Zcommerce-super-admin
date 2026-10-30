/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { cx } from "./cx";
import { IconButton } from "./IconButton";
import { IconNextPage, IconPrevPage } from "./icons";
import { formatCount } from "./money";

/** v2 (01 §7.14): 30 rows a page by default; 30, 50 or 100, remembered per table (useTableUrlState). */
export const PAGE_SIZES = [30, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 30;

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
 * Table footer (01 §7.14): 52px, 1px top divider, padding 0 16. Left: "Rows per page" and a 30 / 50 / 100 select.
 * Right: "1–30 of 219" and previous / next circle buttons (disabled at the ends). Hidden when there are no rows.
 * On phone the rows-per-page choice hides and prev/next stay.
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
  const canResize = !!onPageSizeChange;
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className={cx(
        "flex h-[var(--zc-table-footer-h)] shrink-0 items-center justify-between gap-3 border-t border-line-subtle bg-surface px-4 text-label text-fg-muted",
        className,
      )}
    >
      {canResize ? (
        <label className="hidden items-center gap-2 md:flex">
          Rows per page
          <span className="relative inline-flex">
            <select
              value={pageSize}
              disabled={isDisabled}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="h-8 cursor-pointer appearance-none rounded-[var(--zc-radius-field)] border border-field-line bg-surface pr-8 pl-3 text-label text-fg num transition-colors duration-fast hover:border-field-line-hover focus-visible:border-brand focus-visible:shadow-focus focus-visible:outline-none"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-fg-muted">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </label>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-3">
        <p className="num" aria-live="polite">
          {formatCount(from)}–{formatCount(to)} of {formatCount(total)}
        </p>
        <div className="flex items-center gap-2">
          <IconButton
            aria-label="Previous page"
            variant="default"
            size="sm"
            isDisabled={isDisabled || page <= 1}
            onPress={() => onPageChange(page - 1)}
          >
            <IconPrevPage />
          </IconButton>
          <IconButton
            aria-label="Next page"
            variant="default"
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
