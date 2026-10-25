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
