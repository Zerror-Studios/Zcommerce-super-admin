/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * "The chart speaks" (round 3 D2): after a chart's entrance, 1–2 small label pills on the chart say, in plain
 * words, what its data shows: "Best day · 22 Oct · ₹1,68,185" on the peak, "No orders since 25 Oct" over a flat
 * end, "+41% · fastest growing" on a bar. Pure functions over the chart's points (labels and values already
 * formatted by the caller), so they are unit-tested in tests/unit/r3-5-chart-speak.test.ts.
 */

export interface SayPoint {
  /** Shown in the pill, already formatted ("22 Oct"). */
  label: string;
  value: number;
}

export interface ChartSay {
  /** Index of the point or bar the pill points at. */
  index: number;
  text: string;
  /** Where the pill sits so it stays inside the chart: left edge, centred, or right edge on the point. */
  align: "start" | "center" | "end";
  /** "peak" | "flat" | "growth" (styling and tests). */
  kind: "peak" | "flat" | "growth";
}

/** Where a pill for point `index` of `length` sits horizontally. */
export function sayAlign(index: number, length: number): ChartSay["align"] {
  if (length <= 1) return "center";
  const at = index / (length - 1);
  return at < 0.2 ? "start" : at > 0.8 ? "end" : "center";
}

/** The best point, when the series has at least 3 points and is not flat. Ties go to the latest. */
export function peakSay(points: readonly SayPoint[], show: (value: number) => string, noun = "Best day"): ChartSay | null {
  if (points.length < 3) return null;
  let index = -1;
  points.forEach((point, at) => {
    if (point.value > 0 && (index < 0 || point.value >= points[index].value)) index = at;
  });
  if (index < 0) return null;
  const min = Math.min(...points.map((point) => point.value));
  if (min === points[index].value) return null;
  return { index, text: `${noun} · ${points[index].label} · ${show(points[index].value)}`, align: sayAlign(index, points.length), kind: "peak" };
}

/** A trailing run of at least `minRun` zero points after some activity: "No orders since 25 Oct". */
export function flatEndSay(points: readonly SayPoint[], noun = "orders", minRun = 3): ChartSay | null {
  let index = points.length;
  while (index > 0 && points[index - 1].value <= 0) index -= 1;
  const run = points.length - index;
  if (run < minRun || index === 0) return null;
  const at = Math.min(points.length - 1, index + Math.floor(run / 2));
  return { index: at, text: `No ${noun} since ${points[index].label}`, align: sayAlign(at, points.length), kind: "flat" };
}

export interface GrowthRow {
  label: string;
  value: number;
  previous: number | null | undefined;
}

/** The bar that grew the most against its previous value (at least +5%, previous above 0): "+41% · fastest growing". */
export function growthSay(rows: readonly GrowthRow[], minPercent = 5): ChartSay | null {
  let best = -1;
  let bestChange = -Infinity;
  rows.forEach((row, index) => {
    if (!row.previous || row.previous <= 0) return;
    const change = ((row.value - row.previous) / row.previous) * 100;
    if (change > bestChange) {
      best = index;
      bestChange = change;
    }
  });
  if (best < 0 || bestChange < minPercent) return null;
  return { index: best, text: `+${Math.round(bestChange)}% · fastest growing`, align: "end", kind: "growth" };
}

/**
 * The 1–2 pills for a line or bar series over time: the peak and, when the series ends flat, the flat end.
 * `noun` is plural ("orders", "sales", "sessions").
 */
export function seriesSays(points: readonly SayPoint[], show: (value: number) => string, options: { noun?: string; peakNoun?: string } = {}): ChartSay[] {
  const says: ChartSay[] = [];
  const peak = peakSay(points, show, options.peakNoun);
  if (peak) says.push(peak);
  const flat = flatEndSay(points, options.noun);
  if (flat) says.push(flat);
  return says;
}

/** True when the series' last day is today (local), so the line's end point pulses as "live". */
export function endsToday(last: Date | string | number | null | undefined, now: Date = new Date()): boolean {
  if (last == null) return false;
  const date = last instanceof Date ? last : new Date(last);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}
