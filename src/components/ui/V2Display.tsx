/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Design v2 display pieces (docs/design-v2/README.md §4.7, §4.8; styles `.zc-seo`, `.zc-video`, `.zc-wallet` in
 * src/styles/components.css): the SEO score ring, the video thumbnail, and the Shiprocket wallet capsule.
 */
import { Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { cx } from "./cx";
import { IconAdd, IconPlayGlyph, IconRocket } from "./icons";
import { formatMoney } from "./money";
import { Switch } from "./Switch";

// ─── SEO score ─────────────────────────────────────────────────────────────────

export type SeoBand = "great" | "good" | "poor";

/** Green 80+, amber 60–79, red under 60 (§4.8). */
export function seoBand(score: number): SeoBand {
  if (score >= 80) return "great";
  if (score >= 60) return "good";
  return "poor";
}

const SEO_WORD: Record<SeoBand, string> = { great: "Great", good: "Good", poor: "Needs work" };

export interface SeoScoreProps {
  /** 0–100. */
  score: number;
  /** Hide the Great / Good / Needs work word (dense cells). */
  hideWord?: boolean;
  /** One hint under or after the score ("Add 2 keywords"). */
  hint?: ReactNode;
  className?: string;
}

/** SEO score (§4.8): a 26px ring coloured by score, the number, and Great, Good or Needs work. */
export function SeoScore({ score, hideWord = false, hint, className }: SeoScoreProps) {
  const value = Math.round(Math.max(0, Math.min(100, score)));
  const band = seoBand(value);
  return (
    <span className={cx("zc-seo", className)} data-band={band} aria-label={`SEO score ${value} of 100, ${SEO_WORD[band]}`}>
      {/* Round 2 §5.10: a 0 shows a short red stub, never an empty ring. */}
      <span aria-hidden className="zc-seo__ring" data-zero={value === 0 || undefined} style={{ ["--_p" as string]: value }} />
      <span aria-hidden className="flex flex-col leading-tight">
        <span>
          {value}
          {!hideWord ? <span className="zc-seo__word ml-1.5">{SEO_WORD[band]}</span> : null}
        </span>
        {hint ? <span className="zc-seo__word">{hint}</span> : null}
      </span>
    </span>
  );
}

// ─── Video thumbnail ───────────────────────────────────────────────────────────

/** The four looks rotate so a row never repeats (§4.8). */
export type VideoLook = "tilt" | "zoom" | "phone" | "dark";
export const VIDEO_LOOKS: VideoLook[] = ["tilt", "zoom", "phone", "dark"];
/** The look for the n-th thumbnail in a row. */
export const videoLookAt = (index: number): VideoLook => VIDEO_LOOKS[index % VIDEO_LOOKS.length];

export interface VideoThumbProps {
  title: string;
  /** "2:14" */
  duration?: string;
  /** A real screenshot of the screen the video is about. */
  screenshot?: string;
  look?: VideoLook;
  onPlay?: () => void;
  className?: string;
}

/** Video thumbnail (§4.8): 16:9, radius 20, the title top left, a screenshot, play + length bottom left, nothing else. */
export function VideoThumb({ title, duration, screenshot, look = "tilt", onPlay, className }: VideoThumbProps) {
  return (
    <button type="button" className={cx("zc-video zc-press", className)} data-look={look} onClick={onPlay} aria-label={`Play ${title}${duration ? `, ${duration}` : ""}`}>
      <span className="zc-video__title">{title}</span>
      {screenshot ? (
        <span aria-hidden className="zc-video__shot">
          <img src={screenshot} alt="" loading="lazy" />
        </span>
      ) : null}
      <span aria-hidden className="zc-video__play">
        <i>
          <IconPlayGlyph />
        </i>
        {duration ?? "Play"}
      </span>
    </button>
  );
}

// ─── Shiprocket wallet ─────────────────────────────────────────────────────────

export type WalletHealth = "good" | "low" | "critical";

/** Below this balance the capsule is red whatever the spend (§4.7). */
export const WALLET_CRITICAL_BALANCE = 2000;

/**
 * Health (§4.7, §9): red below ₹2,000 (or under 3 days left), orange for 3 to 7 days, green for 7 or more days.
 * Without a daily spend the balance alone decides (red below ₹2,000, else green).
 */
export function walletHealth(balance: number, dailySpend?: number | null): WalletHealth {
  if (balance < WALLET_CRITICAL_BALANCE) return "critical";
  if (!dailySpend || dailySpend <= 0) return "good";
  const days = balance / dailySpend;
  if (days < 3) return "critical";
  if (days < 7) return "low";
  return "good";
}

export interface WalletCapsuleProps {
  /** Rupees. */
  balance: number;
  /** Average daily shipping spend over the last 14 days, in rupees (needs the §9 backend work; optional). */
  dailySpend?: number | null;
  /** The official Shiprocket logo (32px circle). Falls back to a neutral rocket glyph. */
  logo?: ReactNode;
  onAddMoney?: () => void;
  onShippingCosts?: () => void;
  /** Auto-recharge (NEW, §9): "Add ₹5,000 when it drops below ₹2,000". Hidden when not given. */
  autoRecharge?: { enabled: boolean; amount: number; threshold: number; onChange: (enabled: boolean) => void };
  /** Formats the run-out date ("12 Nov"). */
  formatDate?: (date: Date) => string;
  className?: string;
}

const defaultDate = (date: Date) => date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/**
 * Wallet capsule (§4.7): a 40px pill with the Shiprocket logo, the balance and a +, the whole capsule coloured by
 * health. Click opens a 380px card with the balance, the spend line, a progress bar to the run-out date, the
 * auto-recharge switch, Add money and Shipping costs, and a key to the three colours.
 */
export function WalletCapsule({
  balance,
  dailySpend,
  logo,
  onAddMoney,
  onShippingCosts,
  autoRecharge,
  formatDate = defaultDate,
  className,
}: WalletCapsuleProps) {
  const health = walletHealth(balance, dailySpend);
  const days = dailySpend && dailySpend > 0 ? Math.floor(balance / dailySpend) : null;
  const runOut = days != null ? new Date(Date.now() + days * 86_400_000) : null;
  const money = (value: number) => formatMoney(value, { whole: true });
  const healthWord = health === "good" ? "Healthy" : health === "low" ? "Running low" : "Top up now";

  return (
    <Popover placement="bottom-end" offset={8}>
      <PopoverTrigger>
        <button
          type="button"
          className={cx("zc-wallet", className)}
          data-health={health}
          aria-label={`Shiprocket wallet ${money(balance)}, ${healthWord}`}
        >
          <span aria-hidden className="zc-wallet__logo">{logo ?? <IconRocket />}</span>
          <span className="num">{money(balance)}</span>
          <span aria-hidden className="zc-wallet__add">
            <IconAdd />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="rounded-card border border-line bg-surface p-0 shadow-float">
        <div className="zc-wallet-card flex flex-col gap-4 p-5 text-fg" data-health={health}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-label text-fg-muted">Shiprocket wallet</p>
              <p className="text-kpi-panel text-fg num">{money(balance)}</p>
            </div>
            <span className="zc-wallet-key text-caption text-fg-muted" style={{ ["--_c" as string]: `var(--zc-${health === "good" ? "green" : health === "low" ? "amber" : "red"})` }}>
              {healthWord}
            </span>
          </div>
          {days != null && dailySpend ? (
            <div className="flex flex-col gap-2">
              <p className="text-label text-fg-muted">
                You spend about {money(dailySpend)} a day. It lasts about {days} {days === 1 ? "day" : "days"}
                {runOut ? `, add money before ${formatDate(runOut)}.` : "."}
              </p>
              <div className="zc-wallet-bar">
                <i style={{ transform: `scaleX(${Math.min(1, days / 14)})` }} />
              </div>
              {runOut ? <p className="text-caption text-fg-subtle">Runs out around {formatDate(runOut)}</p> : null}
            </div>
          ) : null}
          {autoRecharge ? (
            <Switch isSelected={autoRecharge.enabled} onValueChange={autoRecharge.onChange}>
              Add {money(autoRecharge.amount)} when it drops below {money(autoRecharge.threshold)}
            </Switch>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {onAddMoney ? (
              <Button variant="primary" size="sm" onPress={onAddMoney}>
                Add money
              </Button>
            ) : null}
            {onShippingCosts ? (
              <Button variant="secondary" size="sm" onPress={onShippingCosts}>
                Shipping costs
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line-subtle pt-3 text-caption text-fg-muted">
            <span className="zc-wallet-key" style={{ ["--_c" as string]: "var(--zc-green)" }}>7+ days</span>
            <span className="zc-wallet-key" style={{ ["--_c" as string]: "var(--zc-amber)" }}>3–7 days</span>
            <span className="zc-wallet-key" style={{ ["--_c" as string]: "var(--zc-red)" }}>Under {money(WALLET_CRITICAL_BALANCE)}</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
