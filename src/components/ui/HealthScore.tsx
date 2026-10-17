/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ReactNode } from "react";
import { Chip } from "./Chip";
import { cx } from "./cx";
import { getHealthBand } from "./status-map";
import type { Tone } from "./tones";
import { Tooltip } from "./Tooltip";

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
    // Ring: r = 18 in a 40×40 box, stroke 4. Circumference ≈ 113.1.
    const circumference = 2 * Math.PI * 18;
    const offset = circumference * (1 - (value ?? 0) / 100);
    content = (
      <span className="inline-flex items-center gap-2">
        <span className="relative inline-flex size-10 shrink-0 items-center justify-center">
          <svg viewBox="0 0 40 40" className="absolute inset-0 size-10 -rotate-90" aria-hidden>
            <circle cx="20" cy="20" r="18" fill="none" strokeWidth="4" className="stroke-line" />
            {value != null ? (
              <circle
                cx="20"
                cy="20"
                r="18"
                fill="none"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className={cx("transition-[stroke-dashoffset] duration-slow ease-standard", ringStroke[band.tone])}
              />
            ) : null}
          </svg>
          <span className="relative text-body font-medium text-fg tabular-nums">{value ?? "–"}</span>
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
