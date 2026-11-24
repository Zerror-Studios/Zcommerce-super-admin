/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * The summary panel, "the blue bar" (docs/design-v2/README.md §4.2; styles `.zc-summary` in
 * src/styles/components.css), drawn to the "KPI bands · all tabs · chart slots" board (2026-11-20): one per list
 * page, directly under the title row; four numbers (three on Analytics › Inventory) on the navy-to-blue band, split
 * by 1px dividers, each with a label (and ⓘ), a 28px value, a one-line note and a picture on the right (`art`, see
 * SummaryArt.tsx). Colour means something: a cell that needs attention tints its note and picture red or amber, a
 * good one tints the note green; nothing else changes colour. Collapsible to one 48px line; the choice is
 * remembered per user, per page (`storageKey`).
 * `variant="lite"` is the white version for Analytics overview's extra rows.
 *
 * Responsive (v2 §10): four cells in a row down to 900px, 2 × 2 below. On phone it always starts collapsed (the slim
 * line scrolls sideways, the light stands still); the arrow opens it as 2 × 2 for this visit. The phone choice is
 * not saved, so it never overwrites the desktop one.
 */
import { useCallback, useId, useState, type ReactNode } from "react";
import { cx } from "./cx";
import {
  SummaryArtView,
  SummaryChevron,
  SummaryInfoGlyph,
  artPlacement,
  artWidth,
  type SummaryArt,
} from "./SummaryArt";
import { Skeleton } from "./Skeleton";
import { Tooltip } from "./Tooltip";
import { useChartEntrance } from "./use-chart-entrance";
import { useIsPhone } from "./use-media";

export type SummaryTone = "default" | "warning" | "danger" | "good";

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
  /** "warning" amber / "danger" red: only when the number needs attention; "good" tints the note green. */
  tone?: SummaryTone;
  /** The band's picture (board 2026-11-20). */
  art?: SummaryArt;
  /** LEGACY small chart (the lite cards and older callers). Ignored when `art` is set. */
  chart?: SummaryChart;
}

export interface SummaryPanelProps {
  /** Four cells (§4.2), or three (Analytics › Inventory). Extra cells are not shown. */
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
          <i
            key={index}
            data-on={index < chart.filled ? "" : undefined}
            className={index < chart.filled ? "zc-c-seg" : undefined}
            style={{ ["--i" as string]: index }}
          />
        ))}
      </span>
    );
  }
  const max = Math.max(1, ...chart.values);
  return (
    <span ref={ref} data-play={play} className="zc-mini-bars zc-chart">
      {chart.values.slice(-10).map((value, index) => (
        <i
          key={index}
          className="zc-c-bar"
          style={{ height: `${Math.max(8, (value / max) * 100)}%`, ["--i" as string]: index }}
        />
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
      style={{ ["--_cols" as string]: shown.length }}
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
          <span aria-hidden className="inline-flex" style={{ transform: collapsed ? "rotate(180deg)" : undefined }}>
            <SummaryChevron />
          </span>
        </button>
      ) : null}
      {shown.map((cell, index) => {
        const art = !lite && cell.art && !isLoading ? cell.art : undefined;
        const placement = art ? artPlacement(art) : undefined;
        // The value and note stop 12px short of the picture (25px more in the last cell, left of the toggle).
        const artSpace = art ? artWidth(art) + 14 + (placement === "center" && index === shown.length - 1 ? 25 : 0) : 0;
        return (
          <div
            key={cell.key}
            className="zc-summary__cell"
            data-tone={cell.tone && cell.tone !== "default" ? cell.tone : undefined}
            data-art={placement}
            style={art ? { ["--_art-n" as string]: artSpace } : undefined}
          >
            <span className="zc-summary__label">
              <span aria-hidden className="zc-summary__dot" />
              <span className="truncate">{cell.label}</span>
              {cell.info ? (
                <Tooltip content={cell.info}>
                  <button
                    type="button"
                    className="zc-summary__info"
                    aria-label={`What this means: ${typeof cell.label === "string" ? cell.label : "this number"}`}
                  >
                    <SummaryInfoGlyph />
                  </button>
                </Tooltip>
              ) : null}
            </span>
            {isLoading ? (
              <Skeleton className={cx("mt-2 h-6 w-24 rounded-md", !lite && "opacity-40")} />
            ) : (
              <span className="zc-summary__value">{cell.value}</span>
            )}
            {isLoading ? (
              // The note line's place is kept while loading, so the cell doesn't grow when the data comes (2026-11-10).
              <span aria-hidden className="zc-summary__note">
                &nbsp;
              </span>
            ) : cell.note != null ? (
              <span className="zc-summary__note" title={typeof cell.note === "string" ? cell.note : undefined}>
                {cell.note}
              </span>
            ) : null}
            {art ? (
              <span aria-hidden className="zc-summary__art" data-kind={art.kind} data-placement={placement}>
                <SummaryArtView art={art} />
              </span>
            ) : cell.chart && !isLoading && !cell.art ? (
              <span aria-hidden className="zc-summary__chart">
                <MiniChart chart={cell.chart} />
              </span>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
