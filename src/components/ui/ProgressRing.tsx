/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Progress ring (01 §7.29, `<ProgressRing>`): sizes 24 (inline), 40 and 96px with a 3, 4 or 8px stroke. Track
 * `--zc-surface-sunken`, arc `--zc-primary` (`--zc-success` at 100%), round caps, starting at 12 o'clock. The
 * percentage sits in the centre, tabular: `caption-strong` at 40px, `title-2` at 96px, none at 24px.
 */
import { cx } from "./cx";

export type ProgressRingSize = 24 | 40 | 96;

export interface ProgressRingProps {
  /** 0–100; clamped and rounded. */
  value: number;
  size?: ProgressRingSize;
  /** Names the ring for screen readers ("Store profile"). */
  label: string;
  className?: string;
}

const STROKE: Record<ProgressRingSize, number> = { 24: 3, 40: 4, 96: 8 };
const BOX: Record<ProgressRingSize, string> = { 24: "size-6", 40: "size-10", 96: "size-24" };

export function ProgressRing({ value, size = 40, label, className }: ProgressRingProps) {
  const percent = Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
  const stroke = STROKE[size];
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  const done = percent >= 100;

  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cx("relative inline-flex shrink-0 items-center justify-center", BOX[size], className)}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-surface-sunken" />
        {percent > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cx(
              "transition-[stroke-dashoffset] duration-200 ease-[var(--zc-ease)]",
              done ? "stroke-tone-success" : "stroke-brand",
            )}
          />
        ) : null}
      </svg>
      {size === 24 ? null : (
        <span className={cx("relative num text-fg", size === 96 ? "text-title-2" : "text-caption-strong")}>
          {percent}%
        </span>
      )}
    </span>
  );
}
