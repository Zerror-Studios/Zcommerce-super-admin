/**
 * zcom-super-admin — Analytics health display logic (PRD-012 FR-8.3)
 *
 * Pure helpers behind the Performance, Integration health and Sync monitor
 * screens: the chip (label + tone) for an analytics health or integration
 * status value, the N-day range the Performance page asks the server for,
 * the period-over-period change shown next to a KPI, and small formatting
 * rules for errors and backfills. No React, no money maths: every figure
 * comes from the server and is only arranged here.
 */

import type { Tone } from "../components/ui/tones";

// ─── Types ────────────────────────────────────────────────────────────────

export interface ChipInfo {
  label: string;
  tone: Tone;
}

export interface DayRange {
  startDate: Date;
  endDate: Date;
}

// ─── Constants ────────────────────────────────────────────────────────────

/** Range options on Analytics › Performance (PRD-012 FR-8.3: 7/30/90 days). */
export const PERFORMANCE_RANGE_DAYS = [7, 30, 90] as const;

export type PerformanceRangeDays = (typeof PERFORMANCE_RANGE_DAYS)[number];

export const DEFAULT_PERFORMANCE_RANGE_DAYS: PerformanceRangeDays = 30;

/** Characters of `lastError` shown in a table cell before the tooltip takes over. */
export const ERROR_PREVIEW_CHARS = 60;

const ANALYTICS_HEALTH_CHIPS: Record<string, ChipInfo> = {
  OK: { label: "Synced", tone: "success" },
  ERROR: { label: "Error", tone: "danger" },
  QUOTA_PAUSED: { label: "Quota paused", tone: "warning" },
  BACKFILLING: { label: "Importing history", tone: "info" },
  NOT_CONNECTED: { label: "Not connected", tone: "neutral" },
};

const INTEGRATION_STATUS_CHIPS: Record<string, ChipInfo> = {
  ACTIVE: { label: "Active", tone: "success" },
  INACTIVE: { label: "Inactive", tone: "neutral" },
  ERROR: { label: "Error", tone: "danger" },
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ─── Chips ────────────────────────────────────────────────────────────────

/** "OK" → Synced (green); null (no analytics app) → "No analytics" (neutral). */
export function analyticsHealthChip(
  health: string | null | undefined,
): ChipInfo {
  if (!health) return { label: "No analytics", tone: "neutral" };
  return ANALYTICS_HEALTH_CHIPS[health] ?? { label: humanize(health), tone: "neutral" };
}

/** Connection status of any installed app (`ACTIVE | INACTIVE | ERROR`). */
export function integrationStatusChip(
  status: string | null | undefined,
): ChipInfo {
  if (!status) return { label: "Unknown", tone: "neutral" };
  return INTEGRATION_STATUS_CHIPS[status] ?? { label: humanize(status), tone: "neutral" };
}

/** Backend enum value → sentence case: "QUOTA_PAUSED" → "Quota paused". */
export function humanize(value: string): string {
  const words = value.toLowerCase().split(/[_\s]+/).filter(Boolean);
  if (words.length === 0) return value;
  return words[0].charAt(0).toUpperCase() + words[0].slice(1) + (words.length > 1 ? ` ${words.slice(1).join(" ")}` : "");
}

// ─── Ranges and deltas ────────────────────────────────────────────────────

/** The last `days` calendar days ending today (inclusive), from local calendar fields. */
export function lastDaysRange(days: number, now: Date = new Date()): DayRange {
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(endDate.getTime() - (days - 1) * MS_PER_DAY);
  return { startDate, endDate };
}

/**
 * Percent change between two server figures, for the KPI arrow; null when
 * the previous period is zero (there is no change to show, never "+Infinity").
 */
export function changePercent(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Difference in percentage points, for conversion-rate KPIs (deltaUnit "pts"). */
export function changePoints(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  return current - previous;
}

// ─── Formatting ───────────────────────────────────────────────────────────

/** First `max` characters of an error with an ellipsis; null stays null. */
export function errorPreview(
  error: string | null | undefined,
  max = ERROR_PREVIEW_CHARS,
): string | null {
  if (!error) return null;
  const single = error.replace(/\s+/g, " ").trim();
  return single.length > max ? `${single.slice(0, max - 1).trimEnd()}…` : single;
}

/** "7 / 13 months" progress as a percent; null when nothing is planned. */
export function backfillPercent(done: number, total: number): number | null {
  if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return null;
  return Math.min(100, Math.max(0, (done / total) * 100));
}
