/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Chart states and speech (round 3 D2), shared by every chart in both dashboards:
 * - `ChartSkeleton`: while the query loads, axes, gridlines and a soft shimmer shape at the chart's final size
 *   (never the empty-state text while loading).
 * - `ChartEmpty`: only when the query returned and there really is no data: a soft illustration of the chart's
 *   shape with plain words ("Not enough data yet: this fills in after 7 days of sales").
 * - `ChartSayPills`: the 1–2 white label pills a chart shows after its entrance (texts from `chart-speak.ts`), each
 *   with a 1px leader down to its point. Put them inside the `.zc-chart` root so they wait for the draw.
 */
import type { ReactNode } from "react";

import { cx } from "./cx";
import { Orb } from "./Orb";

export type ChartShape = "line" | "bars" | "ring" | "list";

const GRID = { stroke: "var(--zc-chart-grid)" } as const;
const SOFT = { fill: "var(--zc-surface-sunken)" } as const;

/** The chart's outline in soft grey (skeleton and empty state). Drawn in a 300 × 100 box, stretched to fit. */
function Shape({ shape }: { shape: ChartShape }) {
  if (shape === "ring") {
    return (
      <svg viewBox="0 0 100 100" className="h-full max-h-40 w-auto" aria-hidden>
        <circle cx="50" cy="50" r="38" fill="none" strokeWidth="12" style={{ stroke: "var(--zc-surface-sunken)" }} />
      </svg>
    );
  }
  if (shape === "list") {
    return (
      <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="size-full" aria-hidden>
        {[92, 70, 55, 38, 24].map((width, index) => (
          <rect key={index} x="0" y={4 + index * 20} width={(width / 100) * 300} height="10" rx="4" style={SOFT} />
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="size-full" aria-hidden>
      {[0, 1, 2, 3].map((row) => (
        <line key={row} x1="0" x2="300" y1={8 + row * 28} y2={8 + row * 28} strokeWidth="1" vectorEffect="non-scaling-stroke" style={GRID} />
      ))}
      {shape === "bars" ? (
        [38, 52, 30, 64, 46, 72, 58, 40, 66, 50, 34, 60].map((h, index) => (
          <rect key={index} x={6 + index * 24.5} y={92 - h} width="16" height={h} rx="3" style={SOFT} />
        ))
      ) : (
        <path d="M0 74 C 40 66, 60 48, 100 54 S 160 30, 200 40 S 260 22, 300 28 L 300 92 L 0 92 Z" style={SOFT} />
      )}
    </svg>
  );
}

export interface ChartSkeletonProps {
  /** The final chart's height in px, so nothing moves when the data arrives. */
  height: number;
  shape?: ChartShape;
  className?: string;
}

export function ChartSkeleton({ height, shape = "line", className }: ChartSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading chart"
      className={cx("zc-c-skeleton flex w-full items-center justify-center rounded-field", className)}
      style={{ height }}
    >
      <Shape shape={shape} />
    </div>
  );
}

export interface ChartEmptyProps {
  height: number;
  shape?: ChartShape;
  /** Default "Not enough data yet". */
  title?: string;
  /** "This fills in after 7 days of sales". */
  description?: ReactNode;
  className?: string;
}

export function ChartEmpty({ height, shape = "line", title = "Not enough data yet", description, className }: ChartEmptyProps) {
  return (
    <div className={cx("relative flex w-full items-center justify-center overflow-hidden rounded-field", className)} style={{ height }}>
      <div className="absolute inset-0 flex items-center justify-center opacity-70">
        <Shape shape={shape} />
      </div>
      <div className="relative max-w-80 rounded-field bg-surface/90 px-4 py-2.5 text-center">
        <p className="text-label-strong text-fg">{title}</p>
        {description ? <p className="mt-0.5 text-caption text-fg-muted">{description}</p> : null}
      </div>
    </div>
  );
}

export interface PlacedSay {
  /** Point position in px inside the chart box. */
  x: number;
  y: number;
  /** Top of the pill in px (the leader runs from the pill down to y). */
  top: number;
  text: string;
  align: "start" | "center" | "end";
  /** Written by Zcom AI: shows the orb. Data-driven labels leave it off. */
  ai?: boolean;
}

const SHIFT: Record<PlacedSay["align"], string> = {
  start: "translateX(-10px)",
  center: "translateX(-50%)",
  end: "translateX(calc(-100% + 10px))",
};

/** The chart's label pills, absolutely placed in the (relative) chart box. */
export function ChartSayPills({ says }: { says: PlacedSay[] }) {
  return (
    <>
      {says.map((say) => (
        <div
          key={say.text}
          aria-hidden
          className="pointer-events-none absolute"
          style={{ left: say.x, top: say.top, height: Math.max(8, say.y - say.top - 4), transform: SHIFT[say.align] }}
        >
          <div className="zc-c-say h-full" data-align={say.align}>
            <span className="zc-c-say__pill">
              {say.ai ? <Orb size="sm" /> : null}
              {say.text}
            </span>
            <span className="zc-c-say__lead" />
          </div>
        </div>
      ))}
    </>
  );
}
