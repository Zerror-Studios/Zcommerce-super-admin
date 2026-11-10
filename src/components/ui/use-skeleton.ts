/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * When a block shows its skeleton (owner, 2026-11-10: "if it isn't taking time, don't show a fake loading").
 *
 * - Data already there (cache, or a refetch in the background): never a skeleton; show the data.
 * - Still loading with no data: the skeleton appears only after `SKELETON_DELAY_MS`, so a fast answer goes straight
 *   from nothing to the real content (no flash of grey).
 * - Once shown, it stays at least `SKELETON_MIN_MS`, so it never flickers for a frame.
 *
 * Use it for every page block and card: `const skeleton = useSkeleton(loading, Boolean(data));`
 * then `skeleton ? <MatchingSkeleton /> : data ? <Real /> : loading ? <Reserved /> : <Empty />`, where `Reserved`
 * keeps the block's frame and height without the shimmer, so nothing jumps when the content arrives.
 */
import { useEffect, useRef, useState } from "react";

/** A load shorter than this never shows a skeleton. */
export const SKELETON_DELAY_MS = 200;
/** A skeleton that showed stays at least this long. */
export const SKELETON_MIN_MS = 300;

export type SkeletonStep = { action: "show" | "hide"; after: number } | null;

/**
 * The next change for a skeleton, and when. Pure (unit-tested).
 * `waiting` = loading with no data yet; `shown` = the skeleton is on screen; `shownFor` = ms it has been on screen.
 */
export function nextSkeletonStep(waiting: boolean, shown: boolean, shownFor: number): SkeletonStep {
  if (waiting && !shown) return { action: "show", after: SKELETON_DELAY_MS };
  if (!waiting && shown) return { action: "hide", after: Math.max(0, SKELETON_MIN_MS - shownFor) };
  return null;
}

/** True while the block should show its skeleton (see the file comment). */
export function useSkeleton(loading: boolean, hasData: boolean): boolean {
  const waiting = loading && !hasData;
  const [shown, setShown] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    const step = nextSkeletonStep(waiting, shown, shown ? performance.now() - shownAt.current : 0);
    if (!step) return undefined;
    const timer = window.setTimeout(() => {
      if (step.action === "show") shownAt.current = performance.now();
      setShown(step.action === "show");
    }, step.after);
    return () => window.clearTimeout(timer);
  }, [waiting, shown]);

  return shown;
}

/**
 * True while the block should render its skeleton markup: from the first frame of a load with no data until
 * `useSkeleton` lets it go. Skeleton blocks (`.zc-skel`, `ChartSkeleton`, `RouteSkeleton`) stay invisible for
 * `--zc-skeleton-delay` (= `SKELETON_DELAY_MS`) after they mount, so during a fast load this keeps the block's frame
 * and height without any grey, and a slow load shows the shimmer at the same moment `useSkeleton` turns on.
 *
 * `const placeholder = useSkeletonFrame(loading, Boolean(data));`
 * then `placeholder ? <MatchingSkeleton /> : data ? <Real /> : <Empty />`.
 */
export function useSkeletonFrame(loading: boolean, hasData: boolean): boolean {
  const shown = useSkeleton(loading, hasData);
  return (loading && !hasData) || shown;
}
