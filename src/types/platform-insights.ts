/**
 * Super Admin AI shapes (backend PRD-026), as `src/graphql/platform-insights.ts`
 * selects them. The server computes every number; the console only reads.
 */

// ─── Enums ────────────────────────────────────────────────────────────────

export const platformMetricsPeriodEnum = {
  TODAY: "TODAY",
  LAST_7D: "LAST_7D",
  LAST_30D: "LAST_30D",
  MTD: "MTD",
  LAST_MONTH: "LAST_MONTH",
  LAST_12M: "LAST_12M",
  ALL_TIME: "ALL_TIME",
} as const;

export type PlatformMetricsPeriod =
  (typeof platformMetricsPeriodEnum)[keyof typeof platformMetricsPeriodEnum];

export const platformMetricStatusEnum = {
  OK: "OK",
  SMALL_SAMPLE: "SMALL_SAMPLE",
  UNAVAILABLE: "UNAVAILABLE",
} as const;

export type PlatformMetricStatus =
  (typeof platformMetricStatusEnum)[keyof typeof platformMetricStatusEnum];

export const platformMetricUnitEnum = {
  COUNT: "COUNT",
  CURRENCY: "CURRENCY",
  PERCENT: "PERCENT",
  DAYS: "DAYS",
  MONTHS: "MONTHS",
  USD: "USD",
  RATIO: "RATIO",
} as const;

export type PlatformMetricUnit =
  (typeof platformMetricUnitEnum)[keyof typeof platformMetricUnitEnum];

/** The snapshot sections (guide §4). */
export const platformMetricSectionEnum = {
  PORTFOLIO: "PORTFOLIO",
  MONEY: "MONEY",
  RETENTION: "RETENTION",
  GMV: "GMV",
  HEALTH: "HEALTH",
  USAGE: "USAGE",
  AI_COST: "AI_COST",
  SUPPORT: "SUPPORT",
} as const;

export type PlatformMetricSection =
  (typeof platformMetricSectionEnum)[keyof typeof platformMetricSectionEnum];

export const platformStoreLifecycleStatusEnum = {
  DEVELOPMENT: "DEVELOPMENT",
  LIVE: "LIVE",
  GRACE: "GRACE",
  SUSPENDED: "SUSPENDED",
  CHURNED: "CHURNED",
  DELETED: "DELETED",
} as const;

export type PlatformStoreLifecycleStatus =
  (typeof platformStoreLifecycleStatusEnum)[keyof typeof platformStoreLifecycleStatusEnum];

export const platformStoreAgeBandEnum = {
  UNDER_3M: "UNDER_3M",
  M3_TO_6: "M3_TO_6",
  M6_TO_12: "M6_TO_12",
  M12_TO_24: "M12_TO_24",
  OVER_24M: "OVER_24M",
} as const;

export type PlatformStoreAgeBand =
  (typeof platformStoreAgeBandEnum)[keyof typeof platformStoreAgeBandEnum];

// ─── Metrics ──────────────────────────────────────────────────────────────

export interface PlatformMetricNamedValue {
  key: string;
  value: number | null;
}

export interface PlatformMetricItem {
  label: string;
  value: number | null;
  total: number | null;
  tenantId: string | null;
  values: PlatformMetricNamedValue[] | null;
}

export interface PlatformMetric {
  key: string;
  label: string;
  section?: string;
  unit: PlatformMetricUnit | string;
  value: number | null;
  previousValue: number | null;
  changePercent: number | null;
  status: PlatformMetricStatus;
  count: number | null;
  names: string[] | null;
  reason: string | null;
  fix: string | null;
  definition: string;
  formula: string;
  items?: PlatformMetricItem[] | null;
  coverage?: { covered: number; total: number } | null;
}

export interface PlatformMetricsStoreRow {
  tenantId: string;
  name: string;
  slug: string;
  /** The derived lifecycle status, lower case in snapshot lists. */
  status?: string;
  value?: number | null;
  days?: number | null;
  score?: number | null;
  reasons?: string[] | null;
  detail?: string | null;
}

export interface PlatformMetricsLists {
  atRisk: PlatformMetricsStoreRow[];
  overdue: PlatformMetricsStoreRow[];
  inGrace: PlatformMetricsStoreRow[];
  churned: PlatformMetricsStoreRow[];
  development: PlatformMetricsStoreRow[];
  newLive: PlatformMetricsStoreRow[];
  topGmv: PlatformMetricsStoreRow[];
  bottomGmv: PlatformMetricsStoreRow[];
  growing: PlatformMetricsStoreRow[];
  shrinking: PlatformMetricsStoreRow[];
  dormant: PlatformMetricsStoreRow[];
}

export interface PlatformMetricsSnapshot {
  period: PlatformMetricsPeriod;
  from: string;
  to: string;
  computedAt: string;
  dataThrough: string | null;
  stale: boolean;
  activeStores: number;
  smallSampleThreshold: number;
  smallSample: boolean;
  sections: { key: string; metrics: PlatformMetric[] }[];
  lists: PlatformMetricsLists;
}

// ─── Home ─────────────────────────────────────────────────────────────────

export interface PlatformAttentionMoneyRow {
  tenantId: string;
  name: string;
  slug: string;
  amount: number;
  dueAt: string;
  daysOverdue: number;
  invoiceCount: number;
  overdue: boolean;
}

export interface PlatformAttentionSummary {
  date: string | null;
  generatedAt: string | null;
  bullets: string[];
  items: { text: string; storeIds: string[]; metricKeys: string[] }[];
}

export interface PlatformAttention {
  computedAt: string | null;
  stale: boolean;
  activeStores: number;
  smallSample: boolean;
  smallSampleThreshold: number | null;
  moneyDue: {
    total: number;
    storeCount: number;
    items: PlatformAttentionMoneyRow[];
  } | null;
  atRisk: { totalCount: number; items: PlatformMetricsStoreRow[] };
  development: { totalCount: number; items: PlatformMetricsStoreRow[] };
  thisMonth: {
    mrr: PlatformMetric | null;
    collected: PlatformMetric | null;
    outstanding: PlatformMetric | null;
    newStoresLive: PlatformMetric | null;
    churned: PlatformMetric | null;
    aiCostUsd: PlatformMetric | null;
  };
  whatNeedsAttention: PlatformAttentionSummary | null;
}

export interface PlatformMetricsRefresh {
  computedAt: string;
  refreshAvailableAt: string;
}

// ─── Ask ZCOM for staff ───────────────────────────────────────────────────

export type PlatformAssistantRunStatus =
  | "RUNNING"
  | "COMPLETED"
  | "COMPLETED_PARTIAL"
  | "CANCELLED"
  | "FAILED";

export type PlatformAssistantRating = "UP" | "DOWN";

export interface PlatformAssistantToolActivity {
  tool: string;
  label: string;
  /** RUNNING, DONE or ERROR */
  status: string;
  ms: number | null;
}

export interface PlatformAssistantMessage {
  id: string;
  role?: string;
  text: string;
  status?: PlatformAssistantRunStatus | null;
  sources: string[];
  rating: PlatformAssistantRating | null;
  createdAt: string;
}

export interface PlatformAssistantRun {
  id: string;
  conversationId: string;
  status: PlatformAssistantRunStatus;
  seq: number;
  delta: string;
  toolActivity: PlatformAssistantToolActivity[];
  message?: PlatformAssistantMessage | null;
  error?: { code: string; reason: string; message: string } | null;
}

export interface PlatformAssistantUsage {
  available: boolean;
  reason: string | null;
  tokensUsedThisMonth: number;
  monthlyTokenBudget: number;
  budgetUsedPercent: number;
  monthResetsAt: string;
}

export interface PlatformAssistantConversationSummary {
  id: string;
  title: string;
  turnCount: number;
  lastMessageAt: string;
}

export interface PlatformAssistantConversation {
  id: string;
  title: string;
  messages: PlatformAssistantMessage[];
}
