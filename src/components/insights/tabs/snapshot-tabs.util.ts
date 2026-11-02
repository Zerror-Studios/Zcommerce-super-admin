/**
 * Snapshot tabs (backend PRD-026 FR-7.3, guide §4): which sections, extra
 * metrics and store lists each tab reads, when a tab is available (its
 * section came back for this viewer, guide §2), and the shapes of the
 * special breakdowns (the MRR movement, retention bands, cohorts, churn
 * reasons). Pure, so the rules are testable; the server computes every
 * number and nothing here turns a count into a rate.
 */

import { formatMetricValue } from "../../../lib/platform-insights.util";
import type {
  PlatformMetric,
  PlatformMetricItem,
  PlatformMetricsLists,
  PlatformMetricsSnapshot,
} from "../../../types/platform-insights";

// ─── Tabs ─────────────────────────────────────────────────────────────────

export const snapshotTabEnum = {
  MONEY: "money",
  RETENTION: "retention",
  HEALTH: "health",
  USAGE: "usage",
  MERCHANT_SALES: "merchant-sales",
  AI_COST: "ai-cost",
} as const;

export type SnapshotTab = (typeof snapshotTabEnum)[keyof typeof snapshotTabEnum];

export type SnapshotListKey = keyof PlatformMetricsLists;

/** How a list's `value` reads. */
export type ListValueKind = "currency" | "percent-change" | "none";

export interface SnapshotListConfig {
  key: SnapshotListKey;
  title: string;
  description?: string;
  value: ListValueKind;
  /** The `days` column's heading, when the list carries days. */
  daysLabel?: string;
  /** Show the risk score and reasons. */
  risk?: boolean;
  /** Show `detail` (planned go-live, cancel note). */
  detail?: boolean;
}

export interface SnapshotTabConfig {
  key: SnapshotTab;
  label: string;
  /** The section whose presence makes the tab available (guide §2). */
  gate: string;
  /** Sections read whole, in order. */
  sections: string[];
  /** Metrics taken from other sections, by key (Retention's portfolio pair). */
  extraMetrics?: { section: string; keys: string[] };
  lists: SnapshotListConfig[];
  description: string;
}

export const SNAPSHOT_TABS: readonly SnapshotTabConfig[] = [
  {
    key: snapshotTabEnum.MONEY,
    label: "Money",
    gate: "MONEY",
    sections: ["MONEY"],
    lists: [
      { key: "overdue", title: "Overdue", description: "Stores with an overdue invoice", value: "currency", daysLabel: "Days overdue" },
      { key: "inGrace", title: "In grace", description: "Overdue, past due or orders paused", value: "none" },
    ],
    description: "MRR, collections, fees and credits.",
  },
  {
    key: snapshotTabEnum.RETENTION,
    label: "Retention",
    gate: "RETENTION",
    sections: ["RETENTION"],
    extraMetrics: { section: "PORTFOLIO", keys: ["newStoresLive", "developmentPipeline"] },
    lists: [
      { key: "atRisk", title: "At risk", value: "none", risk: true },
      { key: "churned", title: "Churned", value: "none", daysLabel: "Tenure (days)", detail: true },
      { key: "newLive", title: "New and live", value: "none" },
      { key: "development", title: "In development", value: "none", daysLabel: "Days since creation", detail: true },
    ],
    description: "Who stays, who leaves and why.",
  },
  {
    key: snapshotTabEnum.HEALTH,
    label: "Platform health",
    gate: "HEALTH",
    sections: ["HEALTH"],
    lists: [],
    description: "Failures, stuck events, webhooks and payment gateways.",
  },
  {
    key: snapshotTabEnum.USAGE,
    label: "Usage",
    gate: "USAGE",
    sections: ["USAGE", "PORTFOLIO"],
    lists: [{ key: "dormant", title: "Dormant", description: "No dashboard login for 30 days", value: "none", daysLabel: "Days since login" }],
    description: "Who uses ZCOM, the portfolio and adoption.",
  },
  {
    key: snapshotTabEnum.MERCHANT_SALES,
    label: "Merchant sales",
    gate: "GMV",
    sections: ["GMV"],
    lists: [
      { key: "topGmv", title: "Top stores by sales", value: "currency" },
      { key: "bottomGmv", title: "Lowest sales", value: "currency" },
      { key: "growing", title: "Growing", description: "Sales up more than 20%", value: "percent-change" },
      { key: "shrinking", title: "Shrinking", description: "Sales down more than 20%", value: "percent-change" },
    ],
    description: "What the stores sell (GMV), across the platform.",
  },
  {
    key: snapshotTabEnum.AI_COST,
    label: "AI cost",
    gate: "AI_COST",
    sections: ["AI_COST"],
    lists: [],
    description: "What ZCOM AI costs, by store and in total.",
  },
];

export const SNAPSHOT_TAB_KEYS: readonly string[] = SNAPSHOT_TABS.map((tab) => tab.key);

export function isSnapshotTab(value: string | null | undefined): value is SnapshotTab {
  return SNAPSHOT_TAB_KEYS.includes(String(value));
}

export function snapshotTabConfig(tab: SnapshotTab): SnapshotTabConfig {
  return SNAPSHOT_TABS.find((config) => config.key === tab)!;
}

/**
 * Guide §2: a tab shows only when its section came back. Before the
 * first snapshot (or while loading) every tab shows, so the page can say
 * when the first one runs.
 */
export function isTabAvailable(
  snapshot: Pick<PlatformMetricsSnapshot, "sections"> | null | undefined,
  tab: SnapshotTab,
): boolean {
  if (!snapshot) return true;
  const gate = snapshotTabConfig(tab).gate;
  return snapshot.sections.some((section) => section.key === gate);
}

/** The metrics a tab shows, in the server's order. */
export function tabMetrics(
  snapshot: Pick<PlatformMetricsSnapshot, "sections">,
  tab: SnapshotTab,
): PlatformMetric[] {
  const config = snapshotTabConfig(tab);
  const metrics: PlatformMetric[] = [];
  for (const key of config.sections) {
    metrics.push(...(snapshot.sections.find((section) => section.key === key)?.metrics ?? []));
  }
  if (config.extraMetrics) {
    const source = snapshot.sections.find((section) => section.key === config.extraMetrics!.section);
    for (const key of config.extraMetrics.keys) {
      const found = source?.metrics.find((metric) => metric.key === key);
      if (found && !metrics.some((metric) => metric.key === key)) metrics.push(found);
    }
  }
  return metrics;
}

// ─── Layout ───────────────────────────────────────────────────────────────

/** Breakdowns drawn with their own component, never as plain bars. */
export const SPECIAL_BREAKDOWNS = new Set(["netNewMrr", "retentionBands", "tenureCohorts", "churnReasons"]);

/**
 * Splits a tab's metrics into KPI cells and breakdown cards. A metric
 * with items gets a breakdown card; it also keeps a KPI cell when it has
 * its own figure or isn't OK (so a small sample's names or an
 * unavailable reason still show).
 */
export function splitMetrics(metrics: PlatformMetric[]): {
  cells: PlatformMetric[];
  breakdowns: PlatformMetric[];
} {
  const cells: PlatformMetric[] = [];
  const breakdowns: PlatformMetric[] = [];
  for (const metric of metrics) {
    const hasItems = metric.status !== "UNAVAILABLE" && (metric.items?.length ?? 0) > 0;
    if (hasItems) breakdowns.push(metric);
    if (!hasItems || metric.value != null || metric.status !== "OK") cells.push(metric);
  }
  return { cells, breakdowns };
}

/** KPI strips hold 4–6 cells; longer runs are cut into strips of up to 5. */
export function chunkCells<T>(cells: T[], size = 5): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < cells.length; index += size) {
    rows.push(cells.slice(index, index + size));
  }
  return rows;
}

// ─── Breakdowns ───────────────────────────────────────────────────────────

/** "5 of 7" for an item with a base; the value in the unit otherwise. */
export function itemDisplay(item: PlatformMetricItem, unit: string): string {
  if (item.total != null && Number.isFinite(item.total)) {
    return `${formatMetricValue(item.value, "COUNT")} of ${formatMetricValue(item.total, "COUNT")}`;
  }
  return formatMetricValue(item.value, unit);
}

/** The MRR movement, signed: New and Expansion up, Contraction and Churned down. */
export function mrrMovementRows(metric: PlatformMetric): {
  label: string;
  value: number;
  direction: "up" | "down" | "flat";
}[] {
  return (metric.items ?? []).map((item) => {
    const value = Number(item.value ?? 0);
    return {
      label: item.label,
      value,
      direction: value > 0 ? "up" : value < 0 ? "down" : "flat",
    };
  });
}

/** The cohort columns, in order (m1, m3, m6, m12). */
export const COHORT_KEYS: readonly string[] = ["m1", "m3", "m6", "m12"];

/** One cohort row: the go-live month, its stores, and still-active per column (null = not reached yet). */
export function cohortRows(metric: PlatformMetric): {
  label: string;
  stores: number | null;
  cells: (number | null)[];
}[] {
  return (metric.items ?? []).map((item) => ({
    label: item.label,
    stores: item.value,
    cells: COHORT_KEYS.map((key) => item.values?.find((entry) => entry.key === key)?.value ?? null),
  }));
}

/** A go-live month label ("2026-03" → "Mar 2026"); other labels unchanged. */
export function cohortMonthLabel(label: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(label);
  if (!match) return label;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

/** Days with "day"/"days"; "—" when unknown. */
export function daysText(days: number | null | undefined): string {
  if (days == null || !Number.isFinite(days)) return "—";
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** A list row's `value` as its list reads it. */
export function listValueText(value: number | null | undefined, kind: ListValueKind): string {
  if (kind === "currency") return formatMetricValue(value, "CURRENCY");
  if (kind === "percent-change") {
    if (value == null || !Number.isFinite(value)) return "—";
    const sign = value > 0 ? "+" : value < 0 ? "−" : "";
    return `${sign}${formatMetricValue(Math.abs(value), "PERCENT")}`;
  }
  return "—";
}
