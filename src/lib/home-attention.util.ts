/**
 * Home page rules (backend PRD-026 FR-7.1, guide §3)
 *
 * Pure helpers for the Home blocks: the at-risk list in score order with
 * "+ N more", which "this month" metrics the viewer may see, the store
 * names a summary bullet links to, and the summary card's state (none
 * yet, nothing today, bullets, written on an earlier day).
 */

import { istToday } from "./platform-insights.util";
import type {
  PlatformAttention,
  PlatformAttentionSummary,
  PlatformMetric,
  PlatformMetricsStoreRow,
} from "../types/platform-insights";

// ─── Types ────────────────────────────────────────────────────────────────

export type SummaryState =
  | { kind: "none" }
  | { kind: "empty"; fromDate: string | null }
  | {
      kind: "bullets";
      fromDate: string | null;
      items: { text: string; storeIds: string[]; metricKeys: string[] }[];
    };

export interface ThisMonthCell {
  key: keyof PlatformAttention["thisMonth"];
  label: string;
  metric: PlatformMetric;
}

// ─── At risk ──────────────────────────────────────────────────────────────

/** Highest score first; ties by name. */
export function sortAtRisk(rows: PlatformMetricsStoreRow[]): PlatformMetricsStoreRow[] {
  return [...rows].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0) || a.name.localeCompare(b.name),
  );
}

/** "+ N more" past the rows the server sent; 0 when it sent them all. */
export function moreCount(totalCount: number, shown: number): number {
  return Math.max(0, totalCount - shown);
}

// ─── This month (guide §3 block 3) ────────────────────────────────────────

const THIS_MONTH_ORDER: { key: ThisMonthCell["key"]; label: string }[] = [
  { key: "mrr", label: "MRR" },
  { key: "collected", label: "Collected" },
  { key: "outstanding", label: "Outstanding" },
  { key: "newStoresLive", label: "New stores live" },
  { key: "churned", label: "Stores lost" },
  { key: "aiCostUsd", label: "AI cost" },
];

/** The cells the viewer may see: a null metric (permissions) is left out. */
export function thisMonthCells(thisMonth: PlatformAttention["thisMonth"] | null | undefined): ThisMonthCell[] {
  if (!thisMonth) return [];
  return THIS_MONTH_ORDER.flatMap(({ key, label }) => {
    const metric = thisMonth[key];
    return metric ? [{ key, label, metric }] : [];
  });
}

// ─── What needs attention (guide §3 block 5) ──────────────────────────────

/**
 * The summary card's state. `fromDate` is set when the summary was written
 * for an earlier IST day (shown "from <date>" in amber).
 */
export function summaryState(
  summary: PlatformAttentionSummary | null | undefined,
  now: Date = new Date(),
): SummaryState {
  if (!summary) return { kind: "none" };
  const fromDate = summary.date && summary.date !== istToday(now) ? summary.date : null;
  const items = summary.items?.length
    ? summary.items
    : (summary.bullets ?? []).map((text) => ({ text, storeIds: [], metricKeys: [] }));
  if (items.length === 0) return { kind: "empty", fromDate };
  return { kind: "bullets", fromDate, items };
}

/** Store names Home already knows, by id (lists and money due). */
export function knownStoreNames(attention: PlatformAttention | null | undefined): Map<string, string> {
  const names = new Map<string, string>();
  if (!attention) return names;
  for (const row of attention.moneyDue?.items ?? []) names.set(row.tenantId, row.name);
  for (const row of attention.atRisk?.items ?? []) names.set(row.tenantId, row.name);
  for (const row of attention.development?.items ?? []) names.set(row.tenantId, row.name);
  return names;
}

/** The links under a bullet: one per store id, named when Home knows it. */
export function bulletStoreLinks(
  storeIds: string[],
  names: Map<string, string>,
): { tenantId: string; name: string }[] {
  return Array.from(new Set(storeIds)).map((tenantId) => ({
    tenantId,
    name: names.get(tenantId) ?? "Open store",
  }));
}

/** "Planned go-live 2026-11-15" as the server wrote it, else "—". */
export function developmentDetail(row: PlatformMetricsStoreRow): string {
  return row.detail?.trim() || "No go-live date planned";
}
