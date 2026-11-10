/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Chart entrance and morph (round 3 D2, ROUND-3-FIXES §12.5). Replaces round 2's `useDrawOnce` ("draw once, never
 * animate"): charts now animate the first time they are on screen, once per page visit.
 *
 * - `useChartEntrance(key)` returns `{ ref, play }`. Put `ref` and `data-play={play}` on the chart root (class
 *   `zc-chart`, `zc-dots` or `zc-ring`); `styles/chart-motion.css` does the rest. It plays when 30% of the root is
 *   in view (IntersectionObserver 0.3). A chart with a `key` that already played in this page visit renders final at
 *   once: coming back to a cached tab, a refetch, a remount or window focus never replays it. A page visit is the
 *   first two path segments (`/admin/insights`): its tabs share one visit; going to another page starts a new one.
 *   A newly opened tab's charts mount when it shows, so they play then.
 * - Reduced motion: `play` is true at once and the CSS swaps every entrance for a 120ms fade.
 * - `useMorph(series, apply)`: when the data changes, one requestAnimationFrame loop tweens the old values to the new
 *   ones over 400ms and calls `apply` (which writes to the DOM through refs); no React state per frame.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const played = new Set<string>();
let visit = "";

function currentVisit(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/").filter(Boolean).slice(0, 2).join("/");
}

/** True when the chart with this key already played in the current page visit (clears the set on a new visit). */
function alreadyPlayed(key: string | undefined): boolean {
  const now = currentVisit();
  if (now !== visit) {
    played.clear();
    visit = now;
  }
  return key ? played.has(key) : false;
}

export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface ChartEntrance<T extends Element> {
  /** Callback ref for the chart root (it may mount after a skeleton). */
  ref: (node: T | null) => void;
  /** Goes true once; put it on the root as `data-play`. */
  play: boolean;
}

export function useChartEntrance<T extends Element = HTMLDivElement>(key?: string): ChartEntrance<T> {
  const [play, setPlay] = useState(() => alreadyPlayed(key) || prefersReducedMotion());
  const [node, setNode] = useState<T | null>(null);
  const ref = useCallback((next: T | null) => setNode(next), []);

  useEffect(() => {
    if (play || !node) return;
    const done = () => {
      if (key) played.add(key);
      setPlay(true);
    };
    if (typeof IntersectionObserver === "undefined") {
      done();
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          io.disconnect();
          // One frame so the hidden starting state is painted before the transition starts.
          requestAnimationFrame(done);
        }
      },
      { threshold: 0.3 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [key, node, play]);

  return { ref, play };
}

// ─── Morph ───────────────────────────────────────────────────────────────────

export const MORPH_MS = 400;

/** Reads `values` at the same relative position in an array of another length (linear). */
export function resample(values: readonly number[], length: number): number[] {
  if (length <= 0) return [];
  if (values.length === 0) return Array.from({ length }, () => 0);
  if (values.length === length) return [...values];
  if (values.length === 1 || length === 1) return Array.from({ length }, () => values[values.length - 1]);
  return Array.from({ length }, (_, index) => {
    const at = (index / (length - 1)) * (values.length - 1);
    const low = Math.floor(at);
    const high = Math.min(values.length - 1, low + 1);
    return values[low] + (values[high] - values[low]) * (at - low);
  });
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Tweens each series in `series` from what was last shown to the new numbers over 400ms, calling `apply` each frame
 * (a series that changed length is resampled first, so 30 days morph into 7). React renders the final values; the
 * layout effect paints the old ones before the browser does, so the change never jumps. Compared by content: a new
 * array with the same numbers does nothing.
 */
export function useMorph(series: readonly (readonly number[])[], apply: (frame: number[][]) => void, enabled = true): void {
  const shown = useRef<number[][] | null>(null);
  const applyRef = useRef(apply);
  useLayoutEffect(() => {
    applyRef.current = apply;
  });
  const signature = series.map((values) => values.join(",")).join("|");

  useLayoutEffect(() => {
    const target = series.map((values) => [...values]);
    const from = shown.current;
    shown.current = target;
    if (!enabled || !from || prefersReducedMotion()) return;
    const start = target.map((values, index) => (from[index] ? resample(from[index], values.length) : values));
    let frame = 0;
    const began = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / MORPH_MS);
      const k = easeOut(t);
      const current = target.map((values, s) => values.map((value, index) => start[s][index] + (value - start[s][index]) * k));
      shown.current = current;
      applyRef.current(current);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    applyRef.current(start);
    frame = requestAnimationFrame(step);
    // Interrupted by newer data: `shown` keeps the in-between values, so the next morph starts from there.
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `signature` stands for the content of `series`
  }, [signature, enabled]);
}

/**
 * For a one-off entrance such as the KPI number roll: true the first time `key` mounts in this page visit (and it
 * is marked as played at once), false afterwards and with reduced motion.
 */
export function useEntranceOnce(key: string): boolean {
  const [first] = useState(() => {
    if (alreadyPlayed(key) || prefersReducedMotion()) return false;
    played.add(key);
    return true;
  });
  return first;
}

/**
 * For a chart drawn by a library (Recharts in the console): render the chart once `play` is true and pass `animate`
 * to the library's animation flag. It is true only when the entrance really runs (not for a chart that already
 * played in this visit, nor with reduced motion), and the library then also morphs later data changes.
 */
export function useLibraryEntrance<T extends Element = HTMLDivElement>(key?: string): ChartEntrance<T> & { animate: boolean } {
  const entrance = useChartEntrance<T>(key);
  const [animate] = useState(() => !entrance.play);
  return { ...entrance, animate };
}
