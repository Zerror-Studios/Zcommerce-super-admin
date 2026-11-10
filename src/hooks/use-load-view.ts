/**
 * How a console block shows a first load (owner, 2026-11-10: "if it isn't taking time, don't show a fake loading;
 * if the data is there, show it"). Built on the kit's `useSkeleton` timing (200ms before a skeleton, ≥ 300ms once
 * shown), for blocks whose kit component only knows `isLoading`.
 *
 * - `skeleton`: render the block's loading layout (`isLoading={view.skeleton}`). True from the first frame of a load
 *   with no data, so the block keeps its loaded height and nothing jumps when the data comes.
 * - `hold`: the first 200ms of that load. The loading layout is there but invisible (`className={view.hold ?
 *   "invisible" : undefined}` or `<LoadHold>`), so a fast answer goes straight from nothing to the real content.
 * - Tables: a DataTable can't hide its skeleton rows alone, so pass `isLoading={view.shimmer}` and, during `hold`,
 *   an empty same-height body (`<TableReserve />` as `emptyContent`) instead of the "nothing here" state.
 *
 * Data already there (cache-and-network, a background refetch): all false, the data shows.
 */
import { useSkeleton } from "../components/ui";

export interface LoadView {
  /** Render the loading layout (visible unless `hold`). */
  skeleton: boolean;
  /** The first 200ms: keep the frame, no shimmer. */
  hold: boolean;
  /** The skeleton is on screen (tables: `isLoading={view.shimmer}`, `emptyContent` = `TableReserve` while `hold`). */
  shimmer: boolean;
}

/** Pure: the view for a block (unit-tested). `shown` is the kit's useSkeleton answer. */
export function loadView(loading: boolean, hasData: boolean, shown: boolean): LoadView {
  const waiting = loading && !hasData;
  return { skeleton: waiting || shown, hold: waiting && !shown, shimmer: shown };
}

export function useLoadView(loading: boolean, hasData: boolean): LoadView {
  return loadView(loading, hasData, useSkeleton(loading, hasData));
}
