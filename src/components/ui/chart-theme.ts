/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Chart theme (component-specs §24). Colors come from the CSS variables in tokens.css. They are read lazily
 * (on first use, when a chart renders), not at module load: if a chart module is imported before the
 * stylesheet, reading at load returns empty strings and charts fall back to black.
 * Presets cover both chart libraries in use: Recharts (Super Admin) and ApexCharts (Store Dashboard).
 */

interface ThemeValues {
  series: string[];
  categorical: string[];
  grid: string;
  axis: string;
  text: string;
  surface: string;
  positive: string;
  negative: string;
  fontFamily: string;
  popoverShadow: string;
}

function cssVar(name: string): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

let cache: ThemeValues | null = null;

/** Reads the tokens once they exist; retries until the stylesheet has loaded. */
function theme(): ThemeValues {
  if (cache) return cache;
  const values: ThemeValues = {
    series: ["--zc-chart-1", "--zc-chart-2", "--zc-chart-3", "--zc-chart-4"].map(cssVar),
    categorical: ["--zc-chart-cat-1", "--zc-chart-cat-2", "--zc-chart-cat-3", "--zc-chart-cat-4", "--zc-chart-cat-5", "--zc-chart-cat-6"].map(cssVar),
    grid: cssVar("--zc-chart-grid"),
    axis: cssVar("--zc-fg-subtle"),
    text: cssVar("--zc-fg"),
    surface: cssVar("--zc-surface"),
    positive: cssVar("--zc-success"),
    negative: cssVar("--zc-danger-text"),
    fontFamily: cssVar("--zc-font-sans"),
    popoverShadow: cssVar("--zc-shadow-popover"),
  };
  if (values.series[0]) cache = values; // only cache once the stylesheet is there
  return values;
}

/** Token colors for charts. Read properties at render time (getters). */
export const chartColors = {
  get series() { return theme().series; },
  /** Categorical palette for multi-series charts, donuts and bars (Store Dashboard analytics colors). */
  get categorical() { return theme().categorical; },
  get grid() { return theme().grid; },
  get axis() { return theme().axis; },
  get text() { return theme().text; },
  get surface() { return theme().surface; },
  get positive() { return theme().positive; },
  get negative() { return theme().negative; },
  get fontFamily() { return theme().fontFamily; },
  get popoverShadow() { return theme().popoverShadow; },
};

/** Axis, legend and tooltip text in ApexCharts: the 12px caption size. Recharts takes the number 12. */
export const CHART_FONT_SIZE = "12px";

/** Fixed plan colors in both products (owner decision 2026-10-13: categorical palette instead of blue shades). */
export const planColors: Record<string, string> = {
  // FE-16: both key sets, so the file is identical in both products. The
  // backend plan codes (Super Admin) and the display names map to the same
  // colors.
  get STARTER() { return theme().categorical[3]; },
  get PREMIUM() { return theme().categorical[1]; },
  get PLUS() { return theme().categorical[0]; },
  get ENTERPRISE() { return theme().categorical[2]; },
  get Free() { return theme().categorical[3]; },
  get Starter() { return theme().categorical[1]; },
  get Pro() { return theme().categorical[0]; },
  get Enterprise() { return theme().categorical[2]; },
};

export function planColor(plan: string): string {
  return planColors[plan] ?? theme().series[3];
}

/** Color for the n-th category (wraps around). */
export function categoryColor(index: number): string {
  const palette = theme().categorical;
  return palette[index % palette.length];
}

/** Recharts presets. Spread onto the matching component at render time. */
export const recharts = {
  line: { type: "monotone", strokeWidth: 2, dot: false, activeDot: { r: 4 } } as const,
  get grid() {
    return { stroke: theme().grid, vertical: false } as const; // spec §14: solid 1px, horizontal only
  },
  get axis() {
    return {
      axisLine: false,
      tickLine: false,
      tick: { fill: theme().axis, fontSize: 12, fontFamily: theme().fontFamily },
    } as const;
  },
  get tooltip() {
    const t = theme();
    return {
      contentStyle: {
        background: t.surface,
        border: `1px solid ${cssVar("--zc-border")}`,
        borderRadius: 12,
        boxShadow: t.popoverShadow,
        fontSize: 12,
        fontFamily: t.fontFamily,
        color: t.text,
      },
      labelStyle: { color: t.axis, fontSize: 12 },
      itemStyle: { color: t.text, fontSize: 12 },
    };
  },
  donut: { paddingAngle: 3, strokeWidth: 0 } as const,
  /** Gradient area fill like the Store Dashboard analytics: use with <defs><linearGradient …> (see areaGradientStops). */
  area: { type: "monotone", strokeWidth: 2, fillOpacity: 1, dot: false, activeDot: { r: 4 } } as const,
};

/** Gradient stops for area fills (top → bottom): spec §14 soft vertical gradient, 14% → 0%. */
export const areaGradientStops = [
  { offset: "0%", stopOpacity: 0.14 },
  { offset: "100%", stopOpacity: 0 },
] as const;

/** ApexCharts base options (call at render time). Merge with chart-specific options. */
export function apexBaseOptions() {
  const t = theme();
  return {
    colors: [...t.series],
    chart: {
      fontFamily: t.fontFamily,
      foreColor: t.axis,
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    grid: {
      borderColor: t.grid,
      strokeDashArray: 0,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    stroke: { curve: "smooth", width: 2 },
    markers: { size: 0, hover: { size: 4 } },
    dataLabels: { enabled: false },
    legend: { fontSize: CHART_FONT_SIZE, labels: { colors: t.axis } },
    xaxis: {
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: t.axis, fontSize: CHART_FONT_SIZE } },
    },
    yaxis: { labels: { style: { colors: t.axis, fontSize: CHART_FONT_SIZE } } },
    tooltip: { theme: "light", style: { fontSize: CHART_FONT_SIZE, fontFamily: t.fontFamily } },
  };
}
