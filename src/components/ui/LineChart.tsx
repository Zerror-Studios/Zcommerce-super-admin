/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * One line / area chart for both dashboards (round 3 D2): Net sales over time, Sessions, Sales over time.
 * - Theme: the line in --zc-primary, an area gradient from 18% down to transparent, the compare period grey and
 *   dashed on the same axis, gridlines --zc-chart-grid, axis text 11px Geist Mono --zc-chart-axis.
 * - Entrance (useChartEntrance + styles/chart-motion.css): the line draws left to right in 700ms, the area fades in
 *   over the last 300ms, the compare line after; then the chart speaks (peak and flat-end pills, chart-speak.ts).
 * - Data changes morph: one requestAnimationFrame tween (useMorph) rewrites the paths through refs.
 * - The last point has a dot; when the range ends today it pulses (2.4s) as "live".
 * - Many points (8+): a tooltip follows the cursor (snappy spring), a guide snaps to the nearest day and the
 *   compare line dims; it says the change in words. Loading is a skeleton, empty is ChartEmpty.
 * Hand-drawn SVG (no chart library), so both apps draw the same chart.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { motion } from "framer-motion";

import { ChartEmpty, ChartSayPills, ChartSkeleton, type PlacedSay } from "./ChartParts";
import { endsToday, seriesSays } from "./chart-speak";
import { spring } from "./motion";
import { useIsPhone } from "./use-media";
import { useChartEntrance, useMorph } from "./use-chart-entrance";

export interface LinePoint {
  /** Axis and tooltip label, already formatted ("22 Oct"). */
  label: string;
  value: number;
  /** The point's day, for the live end point (pulses when it is today). */
  date?: Date | string | number;
}

export interface LineChartProps {
  points: LinePoint[];
  /** The compare period's values matched by position (day 1 with day 1); null where it has none. */
  compare?: (number | null)[] | null;
  /** Series names for the tooltip and legend. */
  name: string;
  compareName?: string;
  /** Formats a value for the axis, tooltip and pills. */
  format: (value: number) => string;
  /** Plural noun for the flat-end pill: "No orders since 25 Oct". */
  noun?: string;
  /** "Best day" (default) or "Best month"... */
  peakNoun?: string;
  height?: number;
  /** The entrance plays once per page visit per key. */
  entranceKey?: string;
  loading?: boolean;
  /** Empty-state words when the query returned nothing. */
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  /** Show the label pills (default true). */
  speak?: boolean;
  /** Force the live pulse on or off; default: the last point's date is today. */
  live?: boolean;
  /** The tooltip's change sentence; default "₹12,400 more than the same day before". null hides it (when the dashed
   *  line is another measure, such as MRR, not the period before). */
  changeWords?: ((value: number, compare: number) => string) | null;
  /** A phone shows the last 14 points (v2 §10); default true. */
  phoneWindow?: boolean;
  className?: string;
}

const PAD_RIGHT = 14;
const PAD_BOTTOM = 24;
const AXIS_FONT = 11;
const TOOLTIP_MIN_POINTS = 8;

/** A round axis maximum with four even steps (1, 2, 2.5 or 5 × 10ⁿ per step). */
function niceMax(value: number): number {
  if (!(value > 0)) return 1;
  const raw = value / 4;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * exp).find((s) => s >= raw) ?? raw;
  return step * 4;
}

const r1 = (value: number) => Math.round(value * 10) / 10;

/** A smooth path through the points that never overshoots (monotone cubic, Fritsch–Carlson). */
function smoothPath(pts: [number, number][]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${r1(pts[0][0])},${r1(pts[0][1])}`;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i += 1) slopes.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0] || 1));
  const tangents = pts.map((_, i) => {
    if (i === 0) return slopes[0];
    if (i === n - 1) return slopes[n - 2];
    return slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2;
  });
  for (let i = 0; i < n - 1; i += 1) {
    if (slopes[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i] / slopes[i];
    const b = tangents[i + 1] / slopes[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      tangents[i] = k * a * slopes[i];
      tangents[i + 1] = k * b * slopes[i];
    }
  }
  let d = `M${r1(pts[0][0])},${r1(pts[0][1])}`;
  for (let i = 0; i < n - 1; i += 1) {
    const dx = (pts[i + 1][0] - pts[i][0]) / 3;
    d += `C${r1(pts[i][0] + dx)},${r1(pts[i][1] + tangents[i] * dx)},${r1(pts[i + 1][0] - dx)},${r1(pts[i + 1][1] - tangents[i + 1] * dx)},${r1(pts[i + 1][0])},${r1(pts[i + 1][1])}`;
  }
  return d;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

function geometry(values: number[], compare: (number | null)[], max: number, box: Box) {
  const n = values.length;
  const x = (index: number) => box.left + (n <= 1 ? box.width / 2 : (index / (n - 1)) * box.width);
  const y = (value: number) => box.top + box.height - (Math.max(0, value) / max) * box.height;
  const pts = values.map((value, index) => [x(index), y(value)] as [number, number]);
  const line = smoothPath(pts);
  const base = r1(box.top + box.height);
  const area = n > 1 ? `${line}L${r1(pts[n - 1][0])},${base}L${r1(pts[0][0])},${base}Z` : "";
  const cmpPts = compare.flatMap((value, index) => (value == null || index >= n ? [] : [[x(index), y(value)] as [number, number]]));
  const end = pts[n - 1] ?? [0, 0];
  return { x, y, pts, line, area, cmp: smoothPath(cmpPts), end };
}

export function LineChart({
  points: allPoints,
  compare: allCompare,
  name,
  compareName = "Period before",
  format,
  noun = "sales",
  peakNoun,
  height = 240,
  entranceKey,
  loading = false,
  emptyTitle,
  emptyDescription,
  speak = true,
  live,
  changeWords,
  phoneWindow = true,
  className,
}: LineChartProps) {
  const isPhone = useIsPhone();
  const offset = phoneWindow && isPhone && allPoints.length > 14 ? allPoints.length - 14 : 0;
  const points = useMemo(() => allPoints.slice(offset), [allPoints, offset]);
  const compare = useMemo(() => (allCompare ?? []).slice(offset, offset + points.length), [allCompare, offset, points.length]);
  const hasCompare = compare.some((value) => value != null);
  const values = useMemo(() => points.map((point) => point.value), [points]);
  const cmpValues = useMemo(() => compare.map((value) => value ?? 0), [compare]);
  const max = niceMax(Math.max(0, ...values, ...cmpValues));

  const { ref: entranceRef, play } = useChartEntrance<HTMLDivElement>(entranceKey);
  const [width, setWidth] = useState(0);
  // The root mounts after a skeleton or an empty state, so the measuring follows the node itself.
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const ref = useCallback(
    (next: HTMLDivElement | null) => {
      setNode(next);
      entranceRef(next);
    },
    [entranceRef],
  );
  useEffect(() => {
    if (!node) return;
    setWidth(Math.round(node.getBoundingClientRect().width));
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);

  const ticks = [0, 1, 2, 3, 4].map((step) => (max / 4) * step);
  const axisWidth = Math.max(28, Math.max(...ticks.map((tick) => format(tick).length)) * 6.8 + 10);
  const padTop = speak ? 36 : 10;
  const box: Box = { left: axisWidth, top: padTop, width: Math.max(1, width - axisWidth - PAD_RIGHT), height: Math.max(1, height - padTop - PAD_BOTTOM) };
  const geo = geometry(values, compare, max, box);

  // Morph: tween the values, the compare values and the scale; write the paths straight to the DOM.
  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const cmpRef = useRef<SVGPathElement>(null);
  const endRef = useRef<SVGGElement>(null);
  useMorph(
    [values, cmpValues, [max]],
    ([frameValues, frameCmp, [frameMax]]) => {
      const mask = compare.map((value, index) => (value == null ? null : frameCmp[index] ?? 0));
      const g = geometry(frameValues, mask, frameMax || 1, box);
      lineRef.current?.setAttribute("d", g.line);
      areaRef.current?.setAttribute("d", g.area);
      cmpRef.current?.setAttribute("d", g.cmp);
      endRef.current?.setAttribute("transform", `translate(${r1(g.end[0])},${r1(g.end[1])})`);
    },
    width > 0,
  );

  // The chart speaks: the best day and a flat end, placed on their points.
  const says: PlacedSay[] = useMemo(() => {
    if (!speak || width === 0) return [];
    return seriesSays(points, format, { noun, peakNoun }).map((say) => {
      const [px, py] = geo.pts[say.index] ?? [0, 0];
      const top = say.kind === "peak" ? 2 : Math.max(2, py - 64);
      return { x: px, y: py, top, text: say.text, align: say.align };
    });
    // geo follows width and data, which are in the deps through points/width/max
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak, width, points, format, noun, peakNoun, max, height]);

  const isLive = live ?? endsToday(points[points.length - 1]?.date);

  // Tooltip (many points only): the nearest day under the cursor.
  const withTooltip = points.length >= TOOLTIP_MIN_POINTS;
  const [hover, setHover] = useState<number | null>(null);
  const onMove = (event: PointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const at = ((event.clientX - rect.left) / Math.max(1, rect.width)) * (points.length - 1);
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(at))));
  };

  const gradientId = `zc-area-${useId().replace(/:/g, "")}`;

  if (loading) return <ChartSkeleton height={height} shape="line" className={className} />;
  if (points.length === 0 || values.every((value) => value === 0)) {
    return (
      <ChartEmpty
        height={height}
        shape="line"
        title={emptyTitle}
        description={emptyDescription ?? `This fills in as ${noun} come in.`}
        className={className}
      />
    );
  }

  const xTicks = isPhone || points.length <= 5 ? [0, points.length - 1] : [0, 1, 2, 3, 4].map((step) => Math.round(((points.length - 1) / 4) * step));
  const peak = points.reduce((best, point) => (point.value > best.value ? point : best), points[0]);
  const hovered = hover != null ? points[hover] : null;
  const hoveredCompare = hover != null ? compare[hover] : null;
  const tipX = hover != null ? geo.x(hover) : 0;

  return (
    <div
      ref={ref}
      className={`zc-chart relative w-full select-none ${className ?? ""}`}
      data-play={play}
      style={{ height }}
      role="img"
      aria-label={`${name}: ${points.length} points from ${points[0].label} to ${points[points.length - 1].label}; best ${peak.label} with ${format(peak.value)}`}
    >
      {width > 0 ? (
        <svg width={width} height={height} className="block overflow-visible" aria-hidden>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--zc-chart-area)" }} />
              <stop offset="100%" style={{ stopColor: "var(--zc-chart-area-end)" }} />
            </linearGradient>
          </defs>
          {ticks.map((tick) => {
            const ty = geo.y(tick);
            return (
              <g key={tick}>
                <line x1={box.left} x2={box.left + box.width} y1={r1(ty)} y2={r1(ty)} strokeWidth="1" style={{ stroke: "var(--zc-chart-grid)" }} />
                <text
                  x={box.left - 8}
                  y={r1(ty)}
                  dy="0.35em"
                  textAnchor="end"
                  className="font-mono"
                  style={{ fontSize: AXIS_FONT, fill: "var(--zc-chart-axis)" }}
                >
                  {format(tick)}
                </text>
              </g>
            );
          })}
          {[...new Set(xTicks)].map((index, at, all) => (
            <text
              key={index}
              x={r1(geo.x(index))}
              y={height - 6}
              textAnchor={at === 0 ? "start" : at === all.length - 1 ? "end" : "middle"}
              className="font-mono"
              style={{ fontSize: AXIS_FONT, fill: "var(--zc-chart-axis)" }}
            >
              {points[index].label}
            </text>
          ))}
          <path ref={areaRef} className="zc-c-area" d={geo.area} fill={`url(#${gradientId})`} />
          {hasCompare ? (
            <g style={{ opacity: hover != null ? 0.4 : 1, transition: "opacity var(--dur-1) var(--ease-out)" }}>
              <path
                ref={cmpRef}
                className="zc-c-cmp"
                d={geo.cmp}
                fill="none"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                strokeLinecap="round"
                style={{ stroke: "var(--zc-chart-compare)" }}
              />
            </g>
          ) : null}
          <path
            ref={lineRef}
            className="zc-c-line"
            d={geo.line}
            pathLength={1}
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ stroke: "var(--zc-primary)" }}
          />
          <g ref={endRef} className="zc-c-end" transform={`translate(${r1(geo.end[0])},${r1(geo.end[1])})`}>
            {isLive ? <circle className="zc-c-live" r="9" fill="none" strokeWidth="2" style={{ stroke: "var(--zc-chart-pulse)" }} /> : null}
            <circle r="4" strokeWidth="2" style={{ fill: "var(--zc-primary)", stroke: "var(--zc-surface)" }} />
          </g>
          {withTooltip && hover != null ? (
            <g pointerEvents="none">
              <line x1={r1(tipX)} x2={r1(tipX)} y1={box.top} y2={box.top + box.height} strokeWidth="1" style={{ stroke: "var(--zc-chart-crosshair)" }} />
              <circle cx={r1(tipX)} cy={r1(geo.pts[hover][1])} r="4" strokeWidth="2" style={{ fill: "var(--zc-primary)", stroke: "var(--zc-surface)" }} />
            </g>
          ) : null}
          {withTooltip ? (
            <rect
              x={box.left}
              y={box.top}
              width={box.width}
              height={box.height}
              fill="transparent"
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
            />
          ) : null}
        </svg>
      ) : null}
      {says.length && hover == null ? <ChartSayPills says={says} /> : null}
      {withTooltip && hovered ? (
        <motion.div
          className="pointer-events-none absolute top-0 left-0 z-10 min-w-40 rounded-field border border-line bg-surface px-3 py-2 text-caption shadow-float"
          initial={false}
          animate={{ x: Math.min(Math.max(0, tipX + 12), Math.max(0, width - 180)), y: Math.max(0, box.top - 4) }}
          transition={spring.snappy}
        >
          <p className="font-mono text-micro text-fg-subtle">{hovered.label}</p>
          <p className="mt-1 flex items-center justify-between gap-3 text-fg">
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden className="size-2 rounded-full bg-brand" />
              {name}
            </span>
            <b className="font-semibold num">{format(hovered.value)}</b>
          </p>
          {hasCompare && hoveredCompare != null ? (
            <>
              <p className="flex items-center justify-between gap-3 text-fg-muted">
                <span className="inline-flex items-center gap-1.5">
                  <i aria-hidden className="size-2 rounded-full bg-chart-3" />
                  {compareName}
                </span>
                <span className="num">{format(hoveredCompare)}</span>
              </p>
              {changeWords === null ? null : (
                <p className="mt-1 text-fg-muted">
                  {changeWords
                    ? changeWords(hovered.value, hoveredCompare)
                    : hovered.value === hoveredCompare
                      ? "Same as the same day before"
                      : `${format(Math.abs(hovered.value - hoveredCompare))} ${hovered.value > hoveredCompare ? "more" : "less"} than the same day before`}
                </p>
              )}
            </>
          ) : null}
        </motion.div>
      ) : null}
    </div>
  );
}
