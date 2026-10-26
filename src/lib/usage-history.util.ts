/**
 * Store usage history (PRD-014 PLT-13)
 *
 * `platformUsage` returns one snapshot per day, newest first. The store page
 * shows the last snapshot of each calendar month (UTC), newest first, so a
 * year fits in a dozen rows. Values are shown as the server sent them.
 */

// ─── Types ────────────────────────────────────────────────────────────────

export interface UsageSnapshot {
  date: string;
  products: number;
  orders30d: number;
  revenue30d: number;
  storageMb: number;
  staffCount: number;
  sessions30d: number;
}

export interface MonthlyUsageRow extends UsageSnapshot {
  /** `YYYY-MM` (UTC). */
  month: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** The latest snapshot in each month, newest month first. */
export function monthlyUsage(snapshots: readonly UsageSnapshot[]): MonthlyUsageRow[] {
  const latest = new Map<string, UsageSnapshot>();
  for (const snapshot of snapshots) {
    const time = Date.parse(snapshot.date);
    if (Number.isNaN(time)) continue;
    const month = new Date(time).toISOString().slice(0, 7);
    const current = latest.get(month);
    if (!current || Date.parse(current.date) < time) latest.set(month, snapshot);
  }
  return [...latest.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([month, snapshot]) => ({ ...snapshot, month }));
}

// ─── Performance card (PRD-024 FR-1.12, P-03) ─────────────────────────────

/** Months of snapshots the store page reads (Usage history and Performance share the query). */
export const USAGE_HISTORY_MONTHS = 6;

export interface PerformancePoint {
  /** `YYYY-MM` (UTC). */
  month: string;
  /** Net sales in the 30 days before the month's last snapshot. */
  revenue30d: number;
  orders30d: number;
  /** The snapshot the point comes from. */
  date: string;
}

/**
 * The Performance chart: each month's last snapshot, oldest first. The
 * values are the snapshot's rolling 30-day totals, labelled as such.
 */
export function performanceSeries(snapshots: readonly UsageSnapshot[]): PerformancePoint[] {
  return monthlyUsage(snapshots)
    .reverse()
    .map((row) => ({
      month: row.month,
      revenue30d: row.revenue30d,
      orders30d: row.orders30d,
      date: row.date,
    }));
}
