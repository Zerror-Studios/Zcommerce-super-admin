/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ReactNode } from "react";
import { Chip } from "./Chip";
import { cx } from "./cx";
import { getHealthBand } from "./status-map";
import type { Tone } from "./tones";
import { Tooltip } from "./Tooltip";
import { useChartEntrance } from "./use-chart-entrance";

export interface HealthScoreProps {
  /** 0–100 from existing data. Never recomputed here. */
  score: number | null | undefined;
  variant?: "compact" | "full";
  /** Extra detail shown in a tooltip (e.g. the factors behind the score). */
  details?: ReactNode;
}

const ringStroke: Record<Tone, string> = {
  neutral: "stroke-tone-neutral",
  info: "stroke-brand",
  success: "stroke-tone-success",
  warning: "stroke-tone-warning",
  danger: "stroke-tone-danger-text",
};

/** Store health (component-specs §22): compact = chip with score + band; full = 40px ring + label. */
export function HealthScore({ score, variant = "full", details }: HealthScoreProps) {
  // Round 3 D2: the ring grows from 0 to the score the first time it is on screen; the number fades in at 60%.
  const { ref, play } = useChartEntrance<HTMLSpanElement>();
  const band = getHealthBand(score);
  const value = score == null || Number.isNaN(score) ? null : Math.max(0, Math.min(100, Math.round(score)));

  let content: ReactNode;
  if (variant === "compact") {
    content = (
      <Chip tone={band.tone}>
        {value == null ? band.label : <><span className="tabular-nums">{value}</span> · {band.label}</>}
      </Chip>
    );
  } else {
    // Ring: r = 18 in a 40×40 box, stroke 4; pathLength 100 so the arc is the score.
    content = (
      <span className="inline-flex items-center gap-2">
        <span ref={ref} data-play={play} className="zc-chart relative inline-flex size-10 shrink-0 items-center justify-center">
          <svg viewBox="0 0 40 40" className="absolute inset-0 size-10 -rotate-90" aria-hidden>
            {/* Round 2 §6.4: no empty ring at 0; a 0 (or no score) reads as a grey full ring. */}
            <circle cx="20" cy="20" r="18" fill="none" strokeWidth="4" className={value ? "stroke-line" : "stroke-ring-zero"} />
            {value != null ? (
              <circle
                cx="20"
                cy="20"
                r="18"
                fill="none"
                strokeWidth="4"
                strokeLinecap="round"
                pathLength={100}
                style={{ ["--v" as string]: Math.max(0, Math.min(100, value)) }}
                className={cx("zc-c-arc", ringStroke[band.tone])}
              />
            ) : null}
          </svg>
          <span className="zc-c-center relative text-body font-medium text-fg tabular-nums">{value ?? "–"}</span>
        </span>
        <span className="text-body text-fg">{band.label}</span>
      </span>
    );
  }

  return details ? (
    <Tooltip content={details}>
      <span className="inline-flex">{content}</span>
    </Tooltip>
  ) : (
    content
  );
}
