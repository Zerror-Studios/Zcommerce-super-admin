/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * The summary panel, "the blue bar" (docs/design-v2/README.md §4.2; styles `.zc-summary` in
 * src/styles/components.css). One per list page, directly under the title row: exactly four numbers on the AI
 * gradient, split by 1px dividers, each with a label and dot, a 26px value, a one-line note and a small white chart.
 * Colour means something: a cell that needs attention tints its dot, note and chart red or amber; nothing else
 * changes colour. Collapsible to one 48px line; the choice is remembered per user, per page (`storageKey`).
 * `variant="lite"` is the white version for Analytics overview's extra rows.
 *
 * Responsive (v2 §10): four cells in a row down to 900px, 2 × 2 below. On phone it always starts collapsed (the slim
 * line scrolls sideways, the light stands still); the arrow opens it as 2 × 2 for this visit. The phone choice is
 * not saved, so it never overwrites the desktop one.
 */
import { useCallback, useId, useState, type ReactNode } from "react";
import { cx } from "./cx";
import { IconCaret, IconInfo } from "./icons";
import { Skeleton } from "./Skeleton";
import { Tooltip } from "./Tooltip";
import { useChartEntrance } from "./use-chart-entrance";
import { useIsPhone } from "./use-media";

export type SummaryTone = "default" | "warning" | "danger";

/** Small decorative chart in the cell's bottom-right corner. Use real 8–10 point series when they exist. */
export type SummaryChart =
  | { kind: "bars"; values: number[] }
  | { kind: "dots" }
  /**
   * `good`: the ring shows a good "nothing to worry about" (no stock running low, no checkout failures, all paid): a
   * full green ring (round 3 F3), never a full white one that reads as empty.
   */
  | { kind: "ring"; percent: number; good?: boolean }
  | { kind: "segments"; filled: number; total?: number };

export interface SummaryCell {
  key: string;
  label: ReactNode;
  value: ReactNode;
  /** One line under the value (72% white). */
  note?: ReactNode;
  /** What the number means: a small ⓘ after the label shows it on hover or focus (round 2 §5.11, "every number has an ⓘ"). */
  info?: ReactNode;
  /** "warning" amber / "danger" red: only when the number needs attention. */
  tone?: SummaryTone;
  chart?: SummaryChart;
}

export interface SummaryPanelProps {
  /** Exactly four cells (§4.2). Extra cells are not shown. */
  cells: SummaryCell[];
  /**
   * Remembers collapsed/open per page: "orders", "products"… The caller namespaces it per user or store when it
   * can (e.g. `${storeKey}:orders`). Without it the panel still collapses for this visit.
   */
  storageKey?: string;
  /** Start collapsed when nothing is remembered (desktop and tablet; phones always start collapsed, §10). */
  defaultCollapsed?: boolean;
  variant?: "panel" | "lite";
  isLoading?: boolean;
  /** Names the region for screen readers ("Orders summary"). */
  "aria-label"?: string;
  className?: string;
}

const STORAGE_PREFIX = "zc.summary.";

function readCollapsed(key: string | undefined, fallback: boolean): boolean {
  if (!key) return fallback;
  try {
    const saved = window.localStorage.getItem(STORAGE_PREFIX + key);
    return saved == null ? fallback : saved === "1";
  } catch {
    return fallback;
  }
}

/** Round 3 D2: the mini chart plays its entrance the first time it is on screen (segments fill one by one, bars grow). */
function MiniChart({ chart }: { chart: SummaryChart }) {
  const { ref, play } = useChartEntrance<HTMLSpanElement>();
  if (chart.kind === "dots") return <span className="zc-mini-dots" />;
  if (chart.kind === "ring") {
    const percent = Math.max(0, Math.min(100, chart.percent));
    // Round 2 §6.4: no empty ring at 0; a 0 reads as a grey full ring.
    return (
      <span ref={ref} data-play={play} className="zc-chart inline-flex">
        <span
          className="zc-mini-ring zc-c-center"
          data-zero={(percent === 0 && !chart.good) || undefined}
          data-good={chart.good || undefined}
          style={{ ["--_p" as string]: chart.good ? 100 : percent }}
        />
      </span>
    );
  }
  if (chart.kind === "segments") {
    const total = chart.total ?? 10;
    return (
      <span ref={ref} data-play={play} className="zc-mini-segs zc-chart">
        {Array.from({ length: total }, (_, index) => (
          <i key={index} data-on={index < chart.filled ? "" : undefined} className={index < chart.filled ? "zc-c-seg" : undefined} style={{ ["--i" as string]: index }} />
        ))}
      </span>
    );
  }
  const max = Math.max(1, ...chart.values);
  return (
    <span ref={ref} data-play={play} className="zc-mini-bars zc-chart">
      {chart.values.slice(-10).map((value, index) => (
        <i key={index} className="zc-c-bar" style={{ height: `${Math.max(8, (value / max) * 100)}%`, ["--i" as string]: index }} />
      ))}
    </span>
  );
}

export function SummaryPanel({
  cells,
  storageKey,
  defaultCollapsed = false,
  variant = "panel",
  isLoading = false,
  className,
  ...rest
}: SummaryPanelProps) {
  const lite = variant === "lite";
  const isPhone = useIsPhone();
  const [savedCollapsed, setCollapsed] = useState(() => !lite && readCollapsed(storageKey, defaultCollapsed));
  const [phoneOpen, setPhoneOpen] = useState(false);
  const collapsed = !lite && (isPhone ? !phoneOpen : savedCollapsed);
  const regionId = useId();

  const toggle = useCallback(() => {
    if (isPhone) {
      setPhoneOpen((open) => !open);
      return;
    }
    setCollapsed((current) => {
      const next = !current;
      if (storageKey) {
        try {
          window.localStorage.setItem(STORAGE_PREFIX + storageKey, next ? "1" : "0");
        } catch {
          /* storage blocked: the choice lasts for this visit */
        }
      }
      return next;
    });
  }, [isPhone, storageKey]);

  const shown = cells.slice(0, 4);

  return (
    <section
      id={regionId}
      aria-label={rest["aria-label"] ?? "Summary"}
      className={cx("zc-summary", lite && "zc-summary--lite", collapsed && "zc-summary--collapsed", className)}
    >
      {!lite ? (
        <button
          type="button"
          className="zc-summary__toggle"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls={regionId}
          aria-label={collapsed ? "Show summary details" : "Hide summary details"}
        >
          <IconCaret aria-hidden style={{ transform: collapsed ? undefined : "rotate(180deg)" }} />
        </button>
      ) : null}
      {shown.map((cell) => (
        <div key={cell.key} className="zc-summary__cell" data-tone={cell.tone && cell.tone !== "default" ? cell.tone : undefined}>
          <span className="zc-summary__label">
            <span aria-hidden className="zc-summary__dot" />
            <span className="truncate">{cell.label}</span>
            {cell.info ? (
              <Tooltip content={cell.info}>
                <button type="button" className="zc-summary__info" aria-label={`What this means: ${typeof cell.label === "string" ? cell.label : "this number"}`}>
                  <IconInfo aria-hidden />
                </button>
              </Tooltip>
            ) : null}
          </span>
          {isLoading ? (
            <Skeleton className={cx("mt-2 h-6 w-24 rounded-md", !lite && "opacity-40")} />
          ) : (
            <span className="zc-summary__value">{cell.value}</span>
          )}
          {cell.note != null && !isLoading ? (
            <span className="zc-summary__note" title={typeof cell.note === "string" ? cell.note : undefined}>
              {cell.note}
            </span>
          ) : null}
          {cell.chart && !isLoading ? (
            <span aria-hidden className="zc-summary__chart">
              <MiniChart chart={cell.chart} />
            </span>
          ) : null}
        </div>
      ))}
    </section>
  );
}
