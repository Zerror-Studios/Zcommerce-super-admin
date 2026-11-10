/**
 * Loading-pass helpers (owner, 2026-11-10), used with `useLoadView` (src/hooks/use-load-view.ts).
 *
 * - <LoadHold hold>: during the first 200ms of a first load the block's skeleton is laid out but invisible, so it
 *   keeps its height without a flash of grey; `display: contents`, so grids and flex rows keep their children.
 * - <TableReserve>: a DataTable body for that same window: empty, the height of the skeleton rows (10 rows of 3.75rem, the 60px row), in
 *   place of the "nothing here" state, which must never show before the answer.
 */
import type { ReactNode } from "react";

export function LoadHold({ hold, children }: { hold: boolean; children: ReactNode }) {
  return (
    <div className={hold ? "invisible contents" : "contents"} aria-busy={hold || undefined}>
      {children}
    </div>
  );
}

/** Empty table body that keeps the skeleton rows' height (DataTable's first load shows 10 rows). */
export function TableReserve({ rows = 10 }: { rows?: number }) {
  return <div aria-hidden style={{ minHeight: `calc(${rows} * 3.75rem)` }} />;
}
