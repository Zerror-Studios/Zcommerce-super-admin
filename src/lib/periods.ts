/**
 * Calendar periods for the date pickers and KPI labels (one definition,
 * docs/design/04-super-admin.md §2). Money itself comes from the server
 * rollups (PRD-005 FR-5.3); these helpers only decide which range to ask for.
 */

export type YearKind = "calendar" | "financial";

export interface Period {
  start: Date;
  /** Exclusive. */
  end: Date;
}

export function monthPeriod(now: Date = new Date()): Period {
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

/** Calendar year (1 Jan) or Indian financial year (1 Apr – 31 Mar) containing `now`. */
export function yearPeriod(now: Date = new Date(), kind: YearKind = "calendar"): Period {
  if (kind === "calendar") {
    return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear() + 1, 0, 1) };
  }
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { start: new Date(startYear, 3, 1), end: new Date(startYear + 1, 3, 1) };
}

/** Collected as a share of everything billed (collected + open); null when nothing was billed. */
export function collectionRate(collected: number, open: number): number | null {
  const billed = collected + open;
  return billed > 0 ? (collected / billed) * 100 : null;
}
