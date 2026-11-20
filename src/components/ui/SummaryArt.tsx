/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * The pictures in the summary panel ("KPI bands · all tabs · chart slots" board, 2026-11-20). Every cell of the
 * blue band can carry one: a dot grid, column bars, two bars (previous vs now), a donut with an icon in the hole, a
 * tick gauge, a square grid, orbit rings, pills, chips, little people, a value track and a few fixed pictures
 * (transit lines, all clear, nothing yet, conversion). Shapes and sizes are copied from the board; the numbers
 * drive what is filled. Colours come from the band tokens in tokens.css (--zc-band-*).
 *
 * Placement (SummaryPanel CSS): `center` charts sit in the middle of the cell's right side, `bottom` charts sit on
 * the note line. In the last cell, centred charts move left to clear the collapse button.
 */
import { useId, type ReactNode } from "react";

export type BandTone = "white" | "light" | "faint" | "off" | "red" | "amber";
export type BandIcon = "rupee" | "card" | "cube" | "eye" | "image" | "user" | "post" | "tag" | "exit" | "archive";

export type SummaryArt =
  /** Circles, 6 to a row: `filled` of `total` lit (white, or the light blue with `tone: "light"`). */
  | { kind: "dotGrid"; filled: number; total?: number; size?: "md" | "sm"; tone?: "white" | "light" }
  /** Up to four columns, the last one white (the latest period). */
  | { kind: "columns"; values: number[] }
  /** Two bars: the previous period (light) and this one (white). */
  | { kind: "pair"; previous: number; current: number }
  /** A ring with an icon in the hole; `percent` in `tone` from 12 o'clock, the rest light. `trail`: the "all paid" look. */
  | { kind: "donut"; icon: BandIcon; percent: number; tone?: "white" | "red" | "amber"; trail?: boolean }
  /** 31 ticks on a half circle; `percent` of them lit. */
  | { kind: "gauge"; percent: number; tone?: "white" | "amber" }
  /** Rounded squares, row by row; `cols` per row. */
  | { kind: "squares"; cells: BandTone[]; cols?: number; size?: "md" | "sm"; placement?: SummaryArtPlacement }
  /** Up to three rings from 12 o'clock (white, light, pale). */
  | { kind: "orbit"; rings: number[] }
  /** Seven pills; `filled` lit from the right. */
  | { kind: "pills"; filled: number; total?: number }
  /** A short row of small squares (e.g. drafts that need something). */
  | { kind: "chips"; tones: BandTone[] }
  /** Twenty tiny people in two rows; `filled` lit. */
  | { kind: "people"; filled: number }
  /** Ten people in two rows; `filled` white, the rest light. */
  | { kind: "crowd"; filled: number }
  /** A dotted track from 0 to `max` with the value marked; labels under it. */
  | { kind: "track"; value: number; max: number; valueLabel: ReactNode; maxLabel: ReactNode }
  /** Lollipops, the tallest lit (up to five values). */
  | { kind: "lollipop"; values: number[] }
  | { kind: "steps" }
  | { kind: "transit" }
  | { kind: "allClear"; placement?: SummaryArtPlacement }
  | { kind: "empty" }
  | { kind: "funnel" };

export type SummaryArtPlacement = "center" | "bottom";

const TONE_FILL: Record<BandTone, { fill: string; opacity?: number }> = {
  white: { fill: "white" },
  light: { fill: "var(--zc-band-light)" },
  faint: { fill: "white", opacity: 0.25 },
  off: { fill: "white", opacity: 0.2 },
  red: { fill: "var(--zc-red-on-dark)" },
  amber: { fill: "var(--zc-amber-on-dark)" },
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));

/** Where each kind sits in the cell (board positions). */
export function artPlacement(art: SummaryArt): SummaryArtPlacement {
  switch (art.kind) {
    case "dotGrid":
    case "columns":
    case "pair":
    case "donut":
    case "crowd":
    case "track":
    case "transit":
    case "funnel":
      return "center";
    case "squares":
      return art.placement ?? (art.size === "sm" ? "bottom" : "center");
    case "allClear":
      return art.placement ?? "bottom";
    default:
      return "bottom";
  }
}

/** The picture's width on the board, so the value and note stop short of it. */
export function artWidth(art: SummaryArt): number {
  switch (art.kind) {
    case "dotGrid":
      return art.size === "sm" ? 63 : 75;
    case "columns":
      return 71;
    case "pair":
      return 50;
    case "gauge":
      return 96;
    case "squares": {
      const cols = Math.max(1, art.cols ?? (art.size === "sm" ? 7 : 6));
      return Math.round((Math.min(cols, art.cells.length) - 1) * (art.size === "sm" ? 9.6 : 11) + (art.size === "sm" ? 8 : 9));
    }
    case "orbit":
      return 55;
    case "chips":
      return 64;
    case "people":
    case "lollipop":
      return 68;
    case "crowd":
      return 82;
    case "track":
      return 135;
    case "steps":
      return 76;
    case "transit":
      return 107;
    case "allClear":
      return 37;
    case "empty":
      return 52;
    case "funnel":
      return 64;
    default:
      return 56;
  }
}

// ─── Pieces ────────────────────────────────────────────────────────────────────

/** Annular sector from `from`° to `to`° (0 = 12 o'clock, clockwise) around (28, 28); a 2px stroke softens the corners. */
function sector(from: number, to: number) {
  const point = (radius: number, degrees: number) => {
    const radians = ((degrees - 90) * Math.PI) / 180;
    return `${(28 + radius * Math.cos(radians)).toFixed(3)} ${(28 + radius * Math.sin(radians)).toFixed(3)}`;
  };
  const outer = 27;
  const inner = 19;
  const large = to - from > 180 ? 1 : 0;
  return `M${point(outer, from)}A${outer} ${outer} 0 ${large} 1 ${point(outer, to)}L${point(inner, to)}A${inner} ${inner} 0 ${large} 0 ${point(inner, from)}Z`;
}

function Ring({ fill }: { fill: string }) {
  return <circle cx="28" cy="28" r="23" strokeWidth="10" style={{ stroke: fill }} />;
}

function Segment({ from, to, fill, opacity }: { from: number; to: number; fill: string; opacity?: number }) {
  return (
    <path
      d={sector(from, to)}
      style={{ fill, stroke: fill }}
      strokeWidth="2"
      strokeLinejoin="round"
      opacity={opacity}
    />
  );
}

const DONUT_GAP = 4.5;

function Donut({ art }: { art: Extract<SummaryArt, { kind: "donut" }> }) {
  const percent = clamp(art.percent, 0, 100);
  const main = art.tone === "red" ? TONE_FILL.red.fill : art.tone === "amber" ? TONE_FILL.amber.fill : "white";
  const light = TONE_FILL.light.fill;
  let ring: ReactNode;
  if (art.trail) {
    // Board, "Everything is paid": white most of the way round, then three fading pieces, then a gap.
    ring = (
      <>
        <Segment from={DONUT_GAP / 2} to={232 - DONUT_GAP / 2} fill="white" />
        <Segment from={232 + DONUT_GAP / 2} to={272 - DONUT_GAP / 2} fill="white" opacity={0.7} />
        <Segment from={272 + DONUT_GAP / 2} to={305 - DONUT_GAP / 2} fill="white" opacity={0.45} />
        <Segment from={305 + DONUT_GAP / 2} to={330 - DONUT_GAP / 2} fill="white" opacity={0.25} />
      </>
    );
  } else if (percent >= 99.5) {
    ring = <Ring fill={main} />;
  } else if (percent <= 0) {
    ring = <Ring fill={light} />;
  } else {
    // A small share still shows as a visible piece (at least 18°), as on the board.
    const split = clamp((percent / 100) * 360, 18, 342);
    ring = (
      <>
        <Segment from={DONUT_GAP / 2} to={split - DONUT_GAP / 2} fill={main} />
        <Segment from={split + DONUT_GAP / 2} to={360 - DONUT_GAP / 2} fill={light} />
      </>
    );
  }
  return (
    <svg viewBox="0 0 56 56" width="56" height="56">
      {ring}
      <g transform="translate(28 28)">{BAND_ICONS[art.icon]}</g>
    </svg>
  );
}

function DotGrid({ art }: { art: Extract<SummaryArt, { kind: "dotGrid" }> }) {
  const sm = art.size === "sm";
  const radius = sm ? 4 : 5;
  const pitch = sm ? 11 : 13;
  const total = Math.max(1, Math.round(art.total ?? 30));
  const filled = clamp(Math.round(art.filled), 0, total);
  const cols = 6;
  const rows = Math.ceil(total / cols);
  const width = (cols - 1) * pitch + radius * 2;
  const height = (rows - 1) * pitch + radius * 2;
  const on = art.tone === "light" ? TONE_FILL.light.fill : "white";
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      {Array.from({ length: total }, (_, index) => (
        <circle
          key={index}
          cx={radius + (index % cols) * pitch}
          cy={radius + Math.floor(index / cols) * pitch}
          r={radius}
          style={{ fill: index < filled ? on : "white" }}
          opacity={index < filled ? undefined : 0.2}
        />
      ))}
    </svg>
  );
}

/** A bar with rounded top corners standing on the bottom of a `height` box. */
function barPath(x: number, width: number, barHeight: number, height: number, radius = 4) {
  const top = height - barHeight;
  const r = Math.min(radius, barHeight / 2, width / 2);
  return `M${x} ${top + r}C${x} ${top + r * 0.45} ${x + r * 0.45} ${top} ${x + r} ${top}H${x + width - r}C${x + width - r * 0.45} ${top} ${x + width} ${top + r * 0.45} ${x + width} ${top + r}V${height}H${x}Z`;
}

function Columns({ art }: { art: Extract<SummaryArt, { kind: "columns" }> }) {
  const values = art.values.slice(-4);
  while (values.length < 4) values.unshift(0);
  const max = Math.max(1, ...values);
  return (
    <svg viewBox="0 0 71 56" width="71" height="56">
      {values.map((value, index) => (
        <path
          key={index}
          d={barPath(index * 19, 14, Math.max(4, (clamp(value, 0, max) / max) * 56), 56)}
          fill="white"
          opacity={index === values.length - 1 ? undefined : 0.2}
        />
      ))}
    </svg>
  );
}

function Pair({ art }: { art: Extract<SummaryArt, { kind: "pair" }> }) {
  const max = Math.max(1, art.previous, art.current);
  const previous = Math.max(4, (clamp(art.previous, 0, max) / max) * 56);
  const current = Math.max(4, (clamp(art.current, 0, max) / max) * 56);
  return (
    <svg viewBox="0 0 50 56" width="50" height="56">
      <path d={barPath(0, 20, previous, 56)} style={{ fill: TONE_FILL.light.fill }} />
      <path d={barPath(30, 20, current, 56)} fill="white" />
    </svg>
  );
}

function Gauge({ art }: { art: Extract<SummaryArt, { kind: "gauge" }> }) {
  const lit = Math.round((clamp(art.percent, 0, 100) / 100) * 31);
  const on = art.tone === "amber" ? TONE_FILL.amber.fill : "white";
  return (
    <svg viewBox="0 0 96 49" width="96" height="49">
      {Array.from({ length: 31 }, (_, index) => (
        <rect
          key={index}
          x="30"
          y="-0.9"
          width="18"
          height="1.8"
          rx="0.9"
          transform={`translate(48 48) rotate(${-180 + index * 6})`}
          style={{ fill: index < lit ? on : "white" }}
          opacity={index < lit ? undefined : 0.2}
        />
      ))}
    </svg>
  );
}

function Squares({ art }: { art: Extract<SummaryArt, { kind: "squares" }> }) {
  const sm = art.size === "sm";
  const side = sm ? 8 : 9;
  const pitch = sm ? 9.6 : 11;
  const cols = Math.max(1, art.cols ?? (sm ? 7 : 6));
  const rows = Math.max(1, Math.ceil(art.cells.length / cols));
  const width = (cols - 1) * pitch + side;
  const height = (rows - 1) * pitch + side;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      {art.cells.map((tone, index) => (
        <rect
          key={index}
          x={(index % cols) * pitch}
          y={Math.floor(index / cols) * pitch}
          width={side}
          height={side}
          rx="2"
          style={{ fill: TONE_FILL[tone].fill }}
          opacity={TONE_FILL[tone].opacity}
        />
      ))}
    </svg>
  );
}

/** Arc of `radius` from 12 o'clock, clockwise, `percent` of the circle, around (27.5, 27.5). */
function arc(radius: number, percent: number) {
  const sweep = (clamp(percent, 0, 99.9) / 100) * 360;
  const radians = ((sweep - 90) * Math.PI) / 180;
  const x = 27.5 + radius * Math.cos(radians);
  const y = 27.5 + radius * Math.sin(radians);
  return `M27.5 ${27.5 - radius}A${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${x.toFixed(3)} ${y.toFixed(3)}`;
}

const ORBIT_COLOURS = ["white", "var(--zc-band-light)", "var(--zc-band-pale)"];

function Orbit({ art }: { art: Extract<SummaryArt, { kind: "orbit" }> }) {
  return (
    <svg viewBox="0 0 55 55" width="55" height="55" fill="none">
      {art.rings.slice(0, 3).map((percent, index) => {
        const radius = 25 - index * 7;
        return (
          <g key={index}>
            <circle cx="27.5" cy="27.5" r={radius} stroke="white" strokeWidth="4.5" opacity={0.15} />
            {percent > 0 ? (
              <path
                d={arc(radius, percent)}
                strokeWidth="4.5"
                strokeLinecap="round"
                style={{ stroke: ORBIT_COLOURS[index] }}
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function Pills({ art }: { art: Extract<SummaryArt, { kind: "pills" }> }) {
  const total = Math.max(1, art.total ?? 7);
  const filled = clamp(Math.round(art.filled), 0, total);
  const width = (total - 1) * 8.33 + 6;
  return (
    <svg viewBox={`0 0 ${width} 22`} width={width} height="22">
      {Array.from({ length: total }, (_, index) => (
        <rect
          key={index}
          x={index * 8.33}
          y="0"
          width="6"
          height="22"
          rx="3"
          fill="white"
          opacity={index >= total - filled ? undefined : 0.15}
        />
      ))}
    </svg>
  );
}

function Chips({ art }: { art: Extract<SummaryArt, { kind: "chips" }> }) {
  const width = Math.max(8, art.tones.length * 11 - 3);
  return (
    <svg viewBox={`0 0 ${width} 8`} width={width} height="8">
      {art.tones.map((tone, index) => (
        <rect
          key={index}
          x={index * 11}
          y="0"
          width="8"
          height="8"
          rx="2"
          style={{ fill: TONE_FILL[tone].fill }}
          opacity={TONE_FILL[tone].opacity}
        />
      ))}
    </svg>
  );
}

function People({ art }: { art: Extract<SummaryArt, { kind: "people" }> }) {
  const filled = clamp(Math.round(art.filled), 0, 20);
  return (
    <svg viewBox="0 0 68 21" width="68" height="21">
      {Array.from({ length: 20 }, (_, index) => {
        const x = 2.5 + (index % 10) * 7;
        const y = 1.75 + Math.floor(index / 10) * 12;
        return (
          <g key={index} fill="white" opacity={index < filled ? undefined : 0.2}>
            <circle cx={x} cy={y} r="1.75" />
            <path d={`M${x - 2.5} ${y + 5.25}a2.5 2.5 0 0 1 5 0v1.5a.5 .5 0 0 1 -.5 .5h-4a.5 .5 0 0 1 -.5 -.5z`} />
          </g>
        );
      })}
    </svg>
  );
}

function Crowd({ art }: { art: Extract<SummaryArt, { kind: "crowd" }> }) {
  const filled = clamp(Math.round(art.filled), 0, 10);
  return (
    <svg viewBox="0 0 82 48" width="82" height="48">
      {Array.from({ length: 10 }, (_, index) => {
        const x = 5.8 + (index % 5) * 17.39;
        const y = 4.06 + Math.floor(index / 5) * 27.13;
        return (
          <g key={index} style={{ fill: index < filled ? "white" : TONE_FILL.light.fill }}>
            <circle cx={x} cy={y} r="4.06" />
            <path
              d={`M${x - 5.8} ${y + 12.17}a5.8 5.8 0 0 1 11.6 0v3.48a1.16 1.16 0 0 1 -1.16 1.16h-9.28a1.16 1.16 0 0 1 -1.16 -1.16z`}
            />
          </g>
        );
      })}
    </svg>
  );
}

function Track({ art, uid }: { art: Extract<SummaryArt, { kind: "track" }>; uid: string }) {
  const spot = Math.round(clamp(art.max > 0 ? art.value / art.max : 0, 0, 1) * 12);
  return (
    <svg viewBox="0 0 135 34" width="135" height="34" className="zc-summary__track">
      <rect x="0.5" y="1" width={spot * 8.8 + 11.5} height="11.5" rx="5.75" style={{ fill: TONE_FILL.light.fill }} />
      {Array.from({ length: 13 }, (_, index) => {
        const cx = 6.25 + index * 8.8;
        if (index < spot)
          return <circle key={index} cx={cx} cy="6.75" r="3.25" style={{ fill: "var(--zc-band-mid)" }} />;
        if (index === spot)
          return <circle key={index} cx={cx} cy="6.75" r="3.25" fill="white" filter={`url(#${uid}glow)`} />;
        return <circle key={index} cx={cx} cy="6.75" r="3.25" fill="white" opacity={0.2} />;
      })}
      <circle cx={6.25 + 12 * 8.8} cy="6.75" r="5" stroke="white" fill="none" />
      <text x={6.25 + spot * 8.8} y="32" textAnchor={spot > 9 ? "end" : "middle"} fill="white">
        {art.valueLabel}
      </text>
      {spot <= 9 ? (
        <text x="134" y="32" textAnchor="end" fill="white">
          {art.maxLabel}
        </text>
      ) : null}
      <defs>
        <filter id={`${uid}glow`} x="-3" y="-3" width="20" height="20" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="3" in="SourceGraphic" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

function Lollipop({ art }: { art: Extract<SummaryArt, { kind: "lollipop" }> }) {
  const values = art.values.slice(0, 5);
  const max = Math.max(1, ...values);
  const best = values.indexOf(Math.max(...values));
  return (
    <svg viewBox="0 0 68 55" width="68" height="55">
      {values.map((value, index) => {
        const x = 3.85 + index * 15.2;
        const top = !value ? 51.3 : 54 - Math.max(2.7, (value / max) * 50);
        const isBest = index === best && value > 0;
        return (
          <g key={index} fill="white" opacity={isBest ? undefined : value ? 0.45 : 0.25}>
            <rect x={x - 0.75} y={top} width="1.5" height={54 - top} />
            {54 - top > 22 ? <circle cx={x} cy="34.7" r="2" /> : null}
            {isBest ? <circle cx={x} cy={top + 11.4} r="2" /> : null}
            <circle cx={x} cy={top} r={isBest ? 4 : 3} />
          </g>
        );
      })}
    </svg>
  );
}

function Steps() {
  return (
    <svg viewBox="0 0 76 8" width="76" height="8">
      <rect y="3.5" width="76" height="1" rx="0.5" fill="white" opacity={0.2} />
      {[4, 21, 38, 55].map((cx) => (
        <circle key={cx} cx={cx} cy="4" r="4" fill="white" />
      ))}
      <circle cx="72" cy="4" r="3.25" strokeWidth="1.5" stroke="white" style={{ fill: "var(--zc-band-blue)" }} />
    </svg>
  );
}

function Fixed({ box, children }: { box: string; children: ReactNode }) {
  const [, , width, height] = box.split(" ").map(Number);
  return (
    <svg viewBox={box} width={width} height={height} fill="none">
      {children}
    </svg>
  );
}

// ─── Drawn from the board (the board's own coordinates) ─────────────────────────

// transit (b01c3)
const TRANSIT_BOX = "829.5 229 107 52";
function TransitArt() {
  return (
    <>
      <path
        d="M830.75 230.5V262.3C830.75 272.11 838.7 280.05 848.5 280.05C858.31 280.05 866.26 272.11 866.26 262.3V252.76C866.26 247.52 870.51 243.27 875.75 243.27C880.99 243.27 885.23 247.52 885.23 252.76V254.88"
        strokeWidth="2"
        strokeLinejoin="round"
        stroke="white"
      />
      <path
        opacity="0.25"
        d="M885.234 254.884V262.304C885.234 272.024 893.114 279.904 902.834 279.904C912.554 279.904 920.434 272.024 920.434 262.304V250.434C920.434 243.754 925.844 238.344 932.514 238.344H936.014"
        strokeWidth="2"
        strokeLinejoin="round"
        stroke="white"
      />
      <circle cx="885.234" cy="254.88" r="2" fill="white" />
      <path
        d="M834.672 230.5V262.3C834.672 269.94 840.872 276.13 848.502 276.13C856.142 276.13 862.342 269.94 862.342 262.3V252.76C862.342 245.35 868.342 239.35 875.752 239.35C883.152 239.35 889.162 245.35 889.162 252.76V258.27"
        strokeWidth="2"
        strokeLinejoin="round"
        stroke="white"
      />
      <path
        opacity="0.25"
        d="M889.156 258.272V262.302C889.156 269.852 895.276 275.972 902.826 275.972C910.376 275.972 916.496 269.852 916.496 262.302V250.432C916.496 241.592 923.666 234.422 932.506 234.422H936.006"
        strokeWidth="2"
        strokeLinejoin="round"
        stroke="white"
      />
      <circle cx="889.156" cy="258.272" r="2" fill="white" />
      <path
        d="M838.488 230.5V262.3C838.488 267.83 842.968 272.32 848.498 272.32C854.038 272.32 858.518 267.83 858.518 262.3V252.76C858.518 243.25 866.228 235.54 875.748 235.54C885.258 235.53 892.968 243.25 892.968 252.76V261.66"
        strokeWidth="2"
        strokeLinejoin="round"
        stroke="white"
      />
      <path
        opacity="0.25"
        d="M892.972 261.656V262.296C892.972 267.736 897.392 272.156 902.832 272.156C908.272 272.156 912.692 267.736 912.692 262.296V250.426C912.692 239.476 921.562 230.606 932.512 230.606H936.012"
        strokeWidth="2"
        strokeLinejoin="round"
        stroke="white"
      />
      <circle cx="892.972" cy="261.664" r="2" fill="white" />
    </>
  );
}

// allClear (b04c3)
const ALLCLEAR_BOX = "902.5 812 36.5 36";
function AllClearArt({ uid }: { uid: string }) {
  return (
    <>
      <g clipPath={`url(#${uid}clip36)`}>
        <rect opacity="0.45" x="902.75" y="812" width="36" height="36" rx="10" fill="white" />
        <path
          d="M902.75 826.922C902.75 822.747 906.289 819.448 910.453 819.739L932.053 821.251C935.825 821.515 938.75 824.652 938.75 828.434V860.8C938.75 864.777 935.526 868 931.55 868H909.95C905.974 868 902.75 864.777 902.75 860.8V826.922Z"
          style={{ fill: "var(--zc-band-light)" }}
        />
        <path
          d="M902.75 838.581C902.75 834.772 905.717 831.622 909.519 831.394L931.119 830.098C935.257 829.85 938.75 833.139 938.75 837.285V860.8C938.75 864.777 935.526 868 931.55 868H909.95C905.974 868 902.75 864.777 902.75 860.8V838.581Z"
          fill="white"
        />
        <path
          d="M907.61 839.9L911.39 843.68L917.87 837.2"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ stroke: "var(--zc-band-blue)" }}
        />
      </g>
      <defs>
        <clipPath id={`${uid}clip36`}>
          <rect x="902.75" y="812" width="36" height="36" rx="10" fill="white" />
        </clipPath>
      </defs>
    </>
  );
}

// empty (b11c3)
const EMPTY_BOX = "886.75 2068 49 50";
function EmptyArt() {
  return (
    <>
      <path
        opacity="0.07"
        d="M888.75 2096C886.75 2084 900.75 2076 912.75 2078C926.75 2080 936.75 2088 934.75 2102C932.75 2114 916.75 2118 904.75 2116C894.75 2114 890.75 2108 888.75 2096Z"
        fill="white"
      />
      <path
        d="M889.35 2077H894.15M891.75 2074.6V2079.4"
        strokeWidth="1.1"
        strokeLinecap="round"
        stroke="white"
        strokeOpacity="0.55"
      />
      <path
        d="M928.35 2074H933.15M930.75 2071.6V2076.4"
        strokeWidth="1.1"
        strokeLinecap="round"
        stroke="white"
        strokeOpacity="0.55"
      />
      <circle cx="915.75" cy="2070.5" r="0.9" fill="white" fillOpacity="0.55" />
      <rect opacity="0.22" x="894.75" y="2084" width="30" height="27" rx="3" fill="white" />
      <rect
        x="902.271"
        y="2074.9"
        width="19.7466"
        height="15.5894"
        rx="2.5"
        transform="rotate(15 902.271 2074.9)"
        fill="white"
      />
      <circle cx="906.756" cy="2081.54" r="0.85" style={{ fill: "var(--zc-band-navy)" }} />
      <circle cx="913.518" cy="2083.35" r="0.85" style={{ fill: "var(--zc-band-navy)" }} />
      <path
        d="M905.696 2087.62C908.116 2086.06 909.983 2086.56 911.299 2089.12"
        strokeWidth="1.2"
        strokeLinecap="round"
        style={{ stroke: "var(--zc-band-navy)" }}
      />
      <path
        d="M888.75 2089.5C888.75 2088.12 889.869 2087 891.25 2087H898C898.787 2087 899.528 2087.37 900 2088L901.5 2090C901.972 2090.63 902.713 2091 903.5 2091H922.25C923.631 2091 924.75 2092.12 924.75 2093.5V2110.5C924.75 2111.88 923.631 2113 922.25 2113H891.25C889.869 2113 888.75 2111.88 888.75 2110.5V2089.5Z"
        style={{ fill: "var(--zc-band-deep)" }}
        strokeWidth="1.25"
        strokeLinejoin="round"
        stroke="white"
        strokeOpacity="0.8"
      />
      <path
        d="M927.15 2110.4L933.25 2116.5"
        strokeWidth="3.2"
        strokeLinecap="round"
        stroke="white"
        strokeOpacity="0.85"
      />
      <circle
        cx="920.75"
        cy="2104"
        r="7.625"
        style={{ fill: "var(--zc-band-deep)" }}
        strokeWidth="1.75"
        stroke="white"
      />
      <path
        d="M916.35 2102.2C916.883 2100.6 917.883 2099.6 919.35 2099.2"
        strokeWidth="1.1"
        strokeLinecap="round"
        stroke="white"
        strokeOpacity="0.6"
      />
    </>
  );
}

// funnel (b15c4)
const FUNNEL_BOX = "1154.8 2792 64 40";
function FunnelArt() {
  return (
    <>
      <path
        d="M1155 2796C1155 2793.79 1156.79 2792 1159 2792H1167C1169.21 2792 1171 2793.79 1171 2796V2832H1155V2796Z"
        style={{ fill: "var(--zc-band-light)" }}
      />
      <path
        d="M1179 2812.08C1179 2809.87 1180.79 2808.08 1183 2808.08H1191C1193.21 2808.08 1195 2809.87 1195 2812.08V2832H1179V2812.08Z"
        style={{ fill: "var(--zc-band-light)" }}
      />
      <path
        d="M1203 2829.5C1203 2828.12 1204.12 2827 1205.5 2827H1216.5C1217.88 2827 1219 2828.12 1219 2829.5V2832H1203V2829.5Z"
        fill="white"
      />
      <path
        d="M1213.22 2810.9C1214.18 2810.9 1214.94 2811.6 1215.06 2812.56L1215.93 2819.33C1216.11 2820.52 1215.17 2821.54 1213.98 2821.54H1208.03C1206.83 2821.54 1205.9 2820.52 1206.07 2819.33L1206.95 2812.56C1207.06 2811.6 1207.82 2810.9 1208.78 2810.9H1213.22ZM1212.69 2812.34C1212.41 2812.34 1212.18 2812.57 1212.18 2812.85C1212.18 2813.68 1211.65 2814.18 1211 2814.18C1210.35 2814.18 1209.82 2813.68 1209.82 2812.85C1209.82 2812.57 1209.59 2812.34 1209.31 2812.34C1209.03 2812.34 1208.8 2812.57 1208.8 2812.85C1208.8 2814.18 1209.72 2815.2 1211 2815.2C1212.28 2815.2 1213.2 2814.18 1213.2 2812.85C1213.2 2812.57 1212.97 2812.34 1212.69 2812.34Z"
        fillRule="evenodd"
        clipRule="evenodd"
        fill="white"
      />
    </>
  );
}

/** Icons in the donut's hole (board glyphs, centred on 0,0). */
const BAND_ICONS: Record<BandIcon, ReactNode> = {
  rupee: (
    <g transform="translate(-1183.80 -257.00)">
      <path
        d="M1184 249.5C1185.99 249.5 1187.9 250.29 1189.3 251.697C1190.71 253.103 1191.5 255.011 1191.5 257C1191.5 258.989 1190.71 260.897 1189.3 262.303C1187.9 263.71 1185.99 264.5 1184 264.5C1182.01 264.5 1180.1 263.71 1178.7 262.303C1177.29 260.897 1176.5 258.989 1176.5 257C1176.5 255.011 1177.29 253.103 1178.7 251.697C1180.1 250.29 1182.01 249.5 1184 249.5ZM1180.93 252.972V253.895H1182.84C1183.37 253.895 1183.79 254.032 1184.1 254.305C1184.29 254.474 1184.43 254.675 1184.5 254.907H1180.93V255.824H1184.51C1184.44 256.095 1184.3 256.325 1184.08 256.516C1183.76 256.801 1183.33 256.944 1182.79 256.944H1181.83V257.697L1184.74 261.028H1186.9L1184.06 257.853C1184.65 257.776 1185.15 257.564 1185.56 257.214C1186 256.848 1186.26 256.385 1186.35 255.824H1187.07V254.907H1186.33C1186.25 254.521 1186.08 254.184 1185.82 253.895H1187.07V252.972H1180.93Z"
        fillRule="evenodd"
        clipRule="evenodd"
        fill="white"
      />
    </g>
  ),
  card: (
    <g transform="translate(-911.00 -439.00)">
      <path
        d="M918.5 442.375C918.5 442.972 918.263 443.544 917.841 443.966C917.419 444.388 916.847 444.625 916.25 444.625H905.75C905.153 444.625 904.581 444.388 904.159 443.966C903.737 443.544 903.5 442.972 903.5 442.375V437.875H918.5V442.375ZM906.312 440.781C906.138 440.781 905.971 440.85 905.848 440.973C905.725 441.096 905.656 441.263 905.656 441.438C905.656 441.612 905.725 441.779 905.848 441.902C905.971 442.025 906.138 442.094 906.312 442.094H909.312C909.487 442.094 909.654 442.025 909.777 441.902C909.9 441.779 909.969 441.612 909.969 441.438C909.969 441.263 909.9 441.096 909.777 440.973C909.654 440.85 909.487 440.781 909.312 440.781H906.312Z"
        fillRule="evenodd"
        clipRule="evenodd"
        fill="white"
      />
      <path
        d="M916.25 433.375C916.847 433.375 917.419 433.612 917.841 434.034C918.263 434.456 918.5 435.028 918.5 435.625V436.375H903.5V435.625C903.5 435.028 903.737 434.456 904.159 434.034C904.581 433.612 905.153 433.375 905.75 433.375H916.25Z"
        fill="white"
      />
    </g>
  ),
  cube: (
    <g transform="translate(-910.00 -621.00)">
      <path
        d="M908.93 620.666C909.3 620.861 909.531 621.244 909.531 621.662V626.387C909.531 627.234 908.63 627.777 907.881 627.382L903.85 625.254C903.481 625.059 903.25 624.676 903.25 624.259V619.54C903.25 618.693 904.15 618.15 904.899 618.544L908.93 620.666Z"
        fill="white"
      />
      <path
        d="M916.75 624.259C916.75 624.676 916.519 625.059 916.15 625.254L912.119 627.382C911.37 627.777 910.469 627.234 910.469 626.387V621.662C910.469 621.244 910.7 620.861 911.07 620.666L915.101 618.544C915.85 618.15 916.75 618.693 916.75 619.54V624.259Z"
        fill="white"
      />
      <path
        d="M914.44 615.843C915.24 616.265 915.24 617.412 914.439 617.833L910.524 619.894C910.196 620.067 909.804 620.067 909.476 619.894L905.561 617.833C904.76 617.412 904.759 616.265 905.56 615.843L909.475 613.777C909.804 613.604 910.196 613.604 910.525 613.777L914.44 615.843Z"
        fill="white"
      />
    </g>
  ),
  eye: (
    <g transform="translate(-1181.00 -621.00)">
      <path
        d="M1181 618.938C1181.55 618.938 1182.07 619.155 1182.46 619.542C1182.85 619.929 1183.06 620.453 1183.06 621C1183.06 621.547 1182.85 622.071 1182.46 622.458C1182.07 622.845 1181.55 623.062 1181 623.062C1180.45 623.062 1179.93 622.845 1179.54 622.458C1179.15 622.071 1178.94 621.547 1178.94 621C1178.94 620.453 1179.15 619.929 1179.54 619.542C1179.93 619.155 1180.45 618.938 1181 618.938Z"
        fill="white"
      />
      <path
        d="M1181 615.375C1183.85 615.375 1186.4 616.8 1188.5 621C1186.4 625.2 1183.85 626.625 1181 626.625C1178.15 626.625 1175.6 625.2 1173.5 621C1175.6 616.8 1178.15 615.375 1181 615.375ZM1181 617.625C1180.1 617.625 1179.25 617.981 1178.61 618.614C1177.98 619.247 1177.62 620.105 1177.62 621C1177.62 621.895 1177.98 622.753 1178.61 623.386C1179.25 624.019 1180.1 624.375 1181 624.375C1181.9 624.375 1182.75 624.019 1183.39 623.386C1184.02 622.753 1184.38 621.895 1184.38 621C1184.38 620.105 1184.02 619.247 1183.39 618.614C1182.75 617.981 1181.9 617.625 1181 617.625Z"
        fillRule="evenodd"
        clipRule="evenodd"
        fill="white"
      />
    </g>
  ),
  image: (
    <g transform="translate(-911.00 -985.00)">
      <path
        d="M915.5 978.625C916.196 978.625 916.864 978.902 917.356 979.394C917.848 979.886 918.125 980.554 918.125 981.25V988.75C918.125 989.446 917.848 990.114 917.356 990.606C916.864 991.098 916.196 991.375 915.5 991.375H906.5C905.804 991.375 905.136 991.098 904.644 990.606C904.152 990.114 903.875 989.446 903.875 988.75V981.25C903.875 980.554 904.152 979.886 904.644 979.394C905.136 978.902 905.804 978.625 906.5 978.625H915.5ZM909.574 985.083C909.311 984.837 908.897 984.849 908.649 985.111L905.086 988.861C904.837 989.123 904.848 989.539 905.111 989.789C905.373 990.038 905.789 990.027 906.039 989.764L909.151 986.487L911.676 988.854C911.934 989.096 912.339 989.09 912.589 988.839L914 987.429L915.973 989.402C916.229 989.658 916.646 989.658 916.902 989.402C917.158 989.146 917.158 988.729 916.902 988.473L914.464 986.036C914.208 985.779 913.792 985.779 913.536 986.036L912.11 987.461L909.574 985.083ZM913.812 980.688C913.415 980.688 913.033 980.846 912.752 981.127C912.471 981.408 912.312 981.79 912.312 982.188C912.312 982.585 912.471 982.967 912.752 983.248C913.033 983.529 913.415 983.688 913.812 983.688C914.21 983.687 914.592 983.529 914.873 983.248C915.154 982.967 915.312 982.585 915.312 982.188C915.312 981.79 915.154 981.408 914.873 981.127C914.592 980.846 914.21 980.688 913.812 980.688Z"
        fillRule="evenodd"
        clipRule="evenodd"
        fill="white"
      />
    </g>
  ),
  user: (
    <g transform="translate(-1187.30 -1167.00)">
      <path
        d="M1190.38 1168.12C1191.17 1168.12 1191.93 1168.44 1192.5 1169C1193.06 1169.57 1193.38 1170.33 1193.38 1171.12C1193.38 1171.92 1193.06 1172.68 1192.5 1173.25C1191.93 1173.81 1191.17 1174.12 1190.38 1174.12H1183.62C1182.83 1174.12 1182.07 1173.81 1181.5 1173.25C1180.94 1172.68 1180.62 1171.92 1180.62 1171.12C1180.62 1170.33 1180.94 1169.57 1181.5 1169C1182.07 1168.44 1182.83 1168.12 1183.62 1168.12H1190.38Z"
        fill="white"
      />
      <path
        d="M1187 1159.88C1187.9 1159.88 1188.75 1160.23 1189.39 1160.86C1190.02 1161.5 1190.38 1162.35 1190.38 1163.25C1190.38 1164.15 1190.02 1165 1189.39 1165.64C1188.75 1166.27 1187.9 1166.62 1187 1166.62C1186.1 1166.62 1185.25 1166.27 1184.61 1165.64C1183.98 1165 1183.62 1164.15 1183.62 1163.25C1183.62 1162.35 1183.98 1161.5 1184.61 1160.86C1185.25 1160.23 1186.1 1159.88 1187 1159.88Z"
        fill="white"
      />
    </g>
  ),
  post: (
    <g transform="translate(-307.50 -1895.00)">
      <path
        d="M313.978 1898.37L310.273 1902.07L307.25 1902.54L307.715 1899.52L311.42 1895.81L313.978 1898.37Z"
        fill="white"
      />
      <path
        d="M310.25 1887.5C310.847 1887.5 311.419 1887.74 311.841 1888.16C312.263 1888.58 312.5 1889.15 312.5 1889.75V1893.73C312.428 1893.76 312.359 1893.81 312.299 1893.87L311.384 1894.79C311.297 1894.87 311.234 1894.98 311.198 1895.09C311.086 1895.13 310.979 1895.19 310.89 1895.28L307.185 1898.99C307.1 1899.07 307.037 1899.17 307.001 1899.29L306.974 1899.4L306.509 1902.42C306.505 1902.45 306.503 1902.47 306.502 1902.5H303.5C302.903 1902.5 302.331 1902.26 301.909 1901.84C301.487 1901.42 301.25 1900.85 301.25 1900.25V1889.75C301.25 1889.15 301.487 1888.58 301.909 1888.16C302.331 1887.74 302.903 1887.5 303.5 1887.5H310.25ZM304.25 1893.69C303.939 1893.69 303.688 1893.94 303.688 1894.25C303.688 1894.56 303.939 1894.81 304.25 1894.81H307.625C307.936 1894.81 308.188 1894.56 308.188 1894.25C308.188 1893.94 307.936 1893.69 307.625 1893.69H304.25ZM304.25 1890.69C303.939 1890.69 303.688 1890.94 303.688 1891.25C303.688 1891.56 303.939 1891.81 304.25 1891.81H309.5C309.811 1891.81 310.062 1891.56 310.062 1891.25C310.062 1890.94 309.811 1890.69 309.5 1890.69H304.25Z"
        fillRule="evenodd"
        clipRule="evenodd"
        fill="white"
      />
      <path
        d="M312.347 1901.06C312.235 1901.35 312.065 1901.62 311.841 1901.84C311.617 1902.07 311.349 1902.23 311.059 1902.35L312.347 1901.06Z"
        fill="white"
      />
      <path d="M315.387 1896.96L314.472 1897.87L311.914 1895.32L312.83 1894.4L315.387 1896.96Z" fill="white" />
    </g>
  ),
  tag: (
    <g transform="translate(-612.80 -2441.00)">
      <path
        d="M611.794 2434.04C612.598 2433.29 613.402 2433.29 614.206 2434.04L617.309 2436.94C618.186 2437.76 618.625 2438.77 618.625 2439.97V2446.27C618.625 2447.77 617.875 2448.52 616.375 2448.52H609.625C608.125 2448.52 607.375 2447.77 607.375 2446.27V2439.97C607.375 2438.77 607.814 2437.76 608.691 2436.94L611.794 2434.04ZM614.05 2437.19C614.05 2437.77 613.58 2438.24 613 2438.24C612.42 2438.24 611.95 2437.77 611.95 2437.19C611.95 2436.61 612.42 2436.14 613 2436.14C613.58 2436.14 614.05 2436.61 614.05 2437.19ZM612.25 2442.14C612.25 2442.76 611.746 2443.27 611.125 2443.27C610.504 2443.27 610 2442.76 610 2442.14C610 2441.52 610.504 2441.02 611.125 2441.02C611.746 2441.02 612.25 2441.52 612.25 2442.14ZM616 2445.97C616 2446.59 615.496 2447.09 614.875 2447.09C614.254 2447.09 613.75 2446.59 613.75 2445.97C613.75 2445.35 614.254 2444.84 614.875 2444.84C615.496 2444.84 616 2445.35 616 2445.97ZM614.61 2441.46L610.56 2445.89C610.35 2446.12 610.366 2446.47 610.595 2446.68C610.824 2446.89 611.181 2446.88 611.39 2446.65L615.44 2442.22C615.65 2441.99 615.634 2441.64 615.405 2441.43C615.176 2441.22 614.82 2441.23 614.61 2441.46Z"
        fillRule="evenodd"
        clipRule="evenodd"
        fill="white"
      />
    </g>
  ),
  exit: (
    <g transform="translate(-915.00 -2804.00)">
      <path
        d="M914.25 2797.25C914.847 2797.25 915.419 2797.49 915.841 2797.91C916.263 2798.33 916.5 2798.9 916.5 2799.5V2802.03H912C911.478 2802.03 910.977 2802.24 910.608 2802.61C910.238 2802.98 910.031 2803.48 910.031 2804C910.031 2804.52 910.238 2805.02 910.608 2805.39C910.977 2805.76 911.478 2805.97 912 2805.97H916.5V2808.5C916.5 2809.1 916.263 2809.67 915.841 2810.09C915.419 2810.51 914.847 2810.75 914.25 2810.75H910.5C909.903 2810.75 909.331 2810.51 908.909 2810.09C908.487 2809.67 908.25 2809.1 908.25 2808.5V2799.5C908.25 2798.9 908.487 2798.33 908.909 2797.91C909.331 2797.49 909.903 2797.25 910.5 2797.25H914.25Z"
        fill="white"
      />
      <path
        d="M918.756 2800.55C918.974 2800.55 919.186 2800.63 919.345 2800.78L921.956 2803.39C921.961 2803.39 921.967 2803.4 921.972 2803.4C922.13 2803.56 922.219 2803.78 922.219 2804C922.219 2804.22 922.13 2804.44 921.972 2804.6C921.965 2804.6 921.956 2804.61 921.948 2804.62L919.345 2807.22C919.186 2807.37 918.974 2807.45 918.756 2807.45C918.537 2807.44 918.328 2807.36 918.174 2807.2C918.019 2807.05 917.931 2806.84 917.927 2806.62C917.923 2806.4 918.004 2806.19 918.153 2806.03L919.337 2804.84H913.125C912.901 2804.84 912.686 2804.76 912.528 2804.6C912.37 2804.44 912.281 2804.22 912.281 2804C912.281 2803.78 912.37 2803.56 912.528 2803.4C912.686 2803.25 912.901 2803.16 913.125 2803.16H919.339L918.153 2801.97C918.004 2801.81 917.923 2801.6 917.927 2801.38C917.931 2801.16 918.019 2800.95 918.174 2800.8C918.328 2800.64 918.537 2800.56 918.756 2800.55Z"
        fill="white"
      />
    </g>
  ),
  archive: (
    <g transform="translate(-409.50 -3167.00)">
      <path
        d="M413.125 3165.12C413.722 3165.12 414.294 3165.36 414.716 3165.78C415.138 3166.21 415.375 3166.78 415.375 3167.38V3171.5C415.375 3172.1 415.138 3172.67 414.716 3173.09C414.294 3173.51 413.722 3173.75 413.125 3173.75H404.875C404.278 3173.75 403.706 3173.51 403.284 3173.09C402.862 3172.67 402.625 3172.1 402.625 3171.5V3167.38C402.625 3166.78 402.862 3166.21 403.284 3165.78C403.706 3165.36 404.278 3165.12 404.875 3165.12H413.125ZM407.125 3167.47C406.951 3167.47 406.784 3167.54 406.661 3167.66C406.538 3167.78 406.469 3167.95 406.469 3168.12C406.469 3168.3 406.538 3168.47 406.661 3168.59C406.784 3168.71 406.951 3168.78 407.125 3168.78H410.875C411.049 3168.78 411.216 3168.71 411.339 3168.59C411.462 3168.47 411.531 3168.3 411.531 3168.12C411.531 3167.95 411.462 3167.78 411.339 3167.66C411.216 3167.54 411.049 3167.47 410.875 3167.47H407.125Z"
        fillRule="evenodd"
        clipRule="evenodd"
        fill="white"
      />
      <path
        d="M414.625 3160.25C415.023 3160.25 415.404 3160.41 415.686 3160.69C415.967 3160.97 416.125 3161.35 416.125 3161.75V3162.5C416.125 3162.9 415.967 3163.28 415.686 3163.56C415.404 3163.84 415.023 3164 414.625 3164H403.375C402.977 3164 402.596 3163.84 402.314 3163.56C402.033 3163.28 401.875 3162.9 401.875 3162.5V3161.75C401.875 3161.35 402.033 3160.97 402.314 3160.69C402.596 3160.41 402.977 3160.25 403.375 3160.25H414.625Z"
        fill="white"
      />
    </g>
  ),
};

/** The info glyph after a label: a filled 11.7px circle with the "i" cut out (board). */
export function SummaryInfoGlyph() {
  return (
    <svg viewBox="192.167 217.667 11.667 11.667" width="12" height="12" aria-hidden>
      <path
        d="M198 217.667C199.547 217.667 201.031 218.281 202.125 219.375C203.219 220.469 203.834 221.953 203.834 223.5C203.834 225.047 203.219 226.531 202.125 227.625C201.031 228.719 199.547 229.333 198 229.333C196.453 229.333 194.969 228.719 193.875 227.625C192.781 226.531 192.167 225.047 192.167 223.5C192.167 221.953 192.781 220.469 193.875 219.375C194.969 218.281 196.453 217.667 198 217.667ZM198 222.261C197.826 222.261 197.659 222.33 197.536 222.453C197.413 222.576 197.344 222.743 197.344 222.917V226.125C197.344 226.299 197.413 226.466 197.536 226.589C197.659 226.712 197.826 226.782 198 226.782C198.174 226.782 198.342 226.712 198.465 226.589C198.587 226.466 198.656 226.299 198.657 226.125V222.917C198.657 222.743 198.587 222.576 198.465 222.453C198.342 222.33 198.174 222.261 198 222.261ZM198 220.059C197.784 220.059 197.576 220.145 197.423 220.298C197.27 220.451 197.183 220.659 197.183 220.875C197.184 221.092 197.27 221.299 197.423 221.452C197.576 221.606 197.784 221.692 198 221.692C198.217 221.692 198.424 221.605 198.577 221.452C198.73 221.299 198.817 221.092 198.817 220.875C198.817 220.659 198.73 220.451 198.577 220.298C198.424 220.145 198.217 220.059 198 220.059Z"
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
      />
    </svg>
  );
}

/** The collapse chevron (board), pointing up; the panel turns it when collapsed. */
export function SummaryChevron() {
  return (
    <svg viewBox="1230.48 221.229 9.04 5.25" width="9" height="5" aria-hidden>
      <path
        d="M1235 221.229C1235.19 221.229 1235.38 221.306 1235.52 221.443L1239.31 225.234C1239.44 225.371 1239.52 225.556 1239.52 225.75C1239.52 225.943 1239.44 226.129 1239.31 226.265C1239.17 226.402 1238.99 226.479 1238.79 226.479C1238.7 226.479 1238.6 226.46 1238.51 226.424C1238.42 226.387 1238.34 226.333 1238.28 226.265L1235 222.989L1231.72 226.265C1231.59 226.402 1231.4 226.479 1231.21 226.479C1231.02 226.479 1230.83 226.402 1230.69 226.265C1230.56 226.129 1230.48 225.943 1230.48 225.75C1230.48 225.556 1230.56 225.371 1230.69 225.234L1234.48 221.443C1234.62 221.306 1234.81 221.229 1235 221.229Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** One cell's picture. */
export function SummaryArtView({ art }: { art: SummaryArt }) {
  const uid = useId().replace(/:/g, "");
  switch (art.kind) {
    case "dotGrid":
      return <DotGrid art={art} />;
    case "columns":
      return <Columns art={art} />;
    case "pair":
      return <Pair art={art} />;
    case "donut":
      return <Donut art={art} />;
    case "gauge":
      return <Gauge art={art} />;
    case "squares":
      return <Squares art={art} />;
    case "orbit":
      return <Orbit art={art} />;
    case "pills":
      return <Pills art={art} />;
    case "chips":
      return <Chips art={art} />;
    case "people":
      return <People art={art} />;
    case "crowd":
      return <Crowd art={art} />;
    case "track":
      return <Track art={art} uid={uid} />;
    case "lollipop":
      return <Lollipop art={art} />;
    case "steps":
      return <Steps />;
    case "transit":
      return (
        <Fixed box={TRANSIT_BOX}>
          <TransitArt />
        </Fixed>
      );
    case "allClear":
      return (
        <Fixed box={ALLCLEAR_BOX}>
          <AllClearArt uid={uid} />
        </Fixed>
      );
    case "empty":
      return (
        <Fixed box={EMPTY_BOX}>
          <EmptyArt />
        </Fixed>
      );
    case "funnel":
      return (
        <Fixed box={FUNNEL_BOX}>
          <FunnelArt />
        </Fixed>
      );
    default:
      return null;
  }
}

/**
 * Square-grid cells for shares of a whole: `parts` in order ([count, tone]), the rest in `restTone`. Every part with
 * a count gets at least one square.
 */
export function squaresFor(total: number, parts: [number | null | undefined, BandTone][], size = 35, restTone: BandTone = "off"): BandTone[] {
  const cells: BandTone[] = [];
  const whole = Math.max(0, total);
  for (const [count, tone] of parts) {
    if (!count || whole <= 0) continue;
    const n = Math.max(1, Math.round((count / whole) * size));
    for (let i = 0; i < n && cells.length < size; i++) cells.push(tone);
  }
  while (cells.length < size) cells.push(restTone);
  return cells;
}
