/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Round 3 B4 (docs/review-r3/ROUND-3-FIXES.md): the one Zcom AI quota row, in both apps. Label on the left, reset
 * date on the right, a 3px bar under them. Numbers in full Indian grouping, never "30L".
 * - Merchant: "1,962 of 2,000 questions left" · "resets Mon"
 * - Super Admin: "11% of this month's AI budget used" · "resets 1 Dec"
 * `AiQuotaSkeleton` holds the same height while the number is unknown (B2: nothing moves when it arrives).
 */
import { cx } from "./cx";
import { Skeleton } from "./Skeleton";

export interface AiQuotaProps {
  label: string;
  /** "resets Mon". */
  resets?: string;
  /** 0–100, how much is used (the bar fills with use). */
  percentUsed: number;
  /** warning when nearly used up. */
  tone?: "default" | "warning";
  /** Names the bar for screen readers ("AI questions used this week"). */
  barLabel: string;
  className?: string;
}

export function AiQuota({ label, resets, percentUsed, tone = "default", barLabel, className }: AiQuotaProps) {
  const percent = Math.max(0, Math.min(100, Math.round(percentUsed)));
  return (
    <div className={cx("zc-ai-quota", className)}>
      <div className="zc-ai-quota__row">
        <span className="zc-ai-quota__label">{label}</span>
        {resets ? <span className="zc-ai-quota__resets">{resets}</span> : null}
      </div>
      <div className="zc-ai-quota__track" role="progressbar" aria-label={barLabel} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className={cx("zc-ai-quota__fill", tone === "warning" && "zc-ai-quota__fill--warning")} style={{ transform: `scaleX(${percent / 100})` }} />
      </div>
    </div>
  );
}

export function AiQuotaSkeleton({ className }: { className?: string }) {
  return (
    <div className={cx("zc-ai-quota", className)} aria-hidden>
      <div className="zc-ai-quota__row">
        <span className="zc-ai-quota__label relative">
          <span className="invisible">2,000 of 2,000 questions left</span>
          <Skeleton className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-md" />
        </span>
        <span className="zc-ai-quota__resets relative">
          <span className="invisible">resets Mon</span>
          <Skeleton className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-md" />
        </span>
      </div>
      <div className="zc-ai-quota__track" />
    </div>
  );
}

/** "Mon" (within a week) or "1 Dec", for "resets …". */
export function quotaResetLabel(iso: string | null | undefined, now = new Date()): string | undefined {
  if (!iso) return undefined;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return undefined;
  const days = (at.getTime() - now.getTime()) / 86_400_000;
  const text =
    days >= 0 && days < 7
      ? at.toLocaleDateString("en-IN", { weekday: "short" })
      : at.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `resets ${text}`;
}

export default AiQuota;
