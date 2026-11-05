/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Route loading (board 47; styles `.zc-route-*` in src/styles/components.css). Used as the Suspense fallback while a
 * page chunk downloads, inside the shell, so the menu and the AI bar stay put.
 *
 * - <RouteSkeleton>: the page's frame shows at once (the title row with its icon tile, the action pills, the tabs and
 *   toolbar); the table rows wait 300ms before they fade in, so a fast load never flashes rows.
 * - <RouteProgress>: a 2px line at the top of the content area, shown only when the load takes longer than 300ms.
 *   It slides with transform; under reduced motion it stays still.
 */
import { cx } from "./cx";
import { Skeleton } from "./Skeleton";

const ROW_COUNT = 8;
/** Text bars at varied widths, so the block reads like a list. */
const ROW_WIDTHS = ["w-3/5", "w-1/2", "w-2/3", "w-2/5", "w-3/4", "w-1/2", "w-3/5", "w-2/5"];

export function RouteProgress({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cx("zc-route-progress", className)}>
      <span className="zc-route-progress__bar" />
    </div>
  );
}

export interface RouteSkeletonProps {
  /** Show the tabs and toolbar row (list pages). Default true. */
  toolbar?: boolean;
  /** Show the 2px top progress line (after 300ms). Default true. */
  progress?: boolean;
  className?: string;
}

export function RouteSkeleton({ toolbar = true, progress = true, className }: RouteSkeletonProps) {
  return (
    <div role="status" aria-label="Loading page" aria-busy className={cx("zc-route-skeleton", className)}>
      {progress ? <RouteProgress /> : null}
      <div className="zc-route-skeleton__title">
        <span className="flex min-w-0 items-center gap-3.5">
          <Skeleton className="size-[var(--zc-title-tile)] shrink-0 rounded-tile max-md:hidden" />
          <span className="flex min-w-0 flex-col gap-2">
            <Skeleton className="h-5 w-40 rounded-md" />
            <Skeleton className="h-3 w-64 max-w-full rounded-md" />
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-full max-md:hidden" />
          <Skeleton className="h-9 w-32 rounded-full" />
        </span>
      </div>
      {toolbar ? (
        <div className="zc-route-skeleton__toolbar">
          <Skeleton className="h-[var(--zc-seg-h)] w-80 max-w-full rounded-full" />
          <span className="flex items-center gap-2 max-md:hidden">
            <Skeleton className="h-9 w-56 rounded-full" />
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="size-9 rounded-full" />
          </span>
        </div>
      ) : null}
      <div className="zc-route-skeleton__card">
        <div className="zc-route-skeleton__head" />
        <div className="zc-route-skeleton__rows">
          {Array.from({ length: ROW_COUNT }, (_, index) => (
            <div key={index} className="zc-route-skeleton__row">
              <Skeleton className="size-10 shrink-0 rounded-thumb" />
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className={cx("h-3 rounded-md", ROW_WIDTHS[index % ROW_WIDTHS.length])} />
                <Skeleton className="h-2.5 w-1/4 rounded-md" />
              </span>
              <Skeleton className="h-5.5 w-16 shrink-0 rounded-md max-md:hidden" />
              <Skeleton className="h-3 w-20 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
