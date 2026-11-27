/**
 * Console › Messaging › Usage check (backend PRD-050 D20, FR-1.11): the
 * monthly comparison of the emails ZCOM sent through each store's MSG91
 * account (and Zerror's parent account) with MSG91's mail log. Types,
 * labels, tones, filter tabs, the difference text and the server's
 * reasons. Pure: no React.
 *
 * The server decides the status: within max(5 emails, 2 %) is MATCHED.
 */

import { errorReasonOf } from "./apollo-client";
import { mutationFailureCopy } from "./mutation-errors";
import type { Tone } from "./platform-messaging.util";

// ─── Enums ────────────────────────────────────────────────────────────────

export const reconciliationStatusEnum = {
  MATCHED: "MATCHED",
  MISMATCH: "MISMATCH",
  PROVIDER_ERROR: "PROVIDER_ERROR",
  NO_PROVIDER_DATA: "NO_PROVIDER_DATA",
} as const;

export type ReconciliationStatus =
  (typeof reconciliationStatusEnum)[keyof typeof reconciliationStatusEnum];

export type ReconciliationStatusTab = ReconciliationStatus | "ALL";

// ─── Types ────────────────────────────────────────────────────────────────

export interface PurposeCounts {
  MARKETING: number;
  TRANSACTIONAL: number;
  SERVICE: number;
}

export interface UsageCount {
  total: number;
  byPurpose: PurposeCounts;
}

export interface MessagingReconciliation {
  id: string;
  tenantId: string;
  scope: "STORE" | "PARENT";
  slug: string | null;
  storeName: string | null;
  month: string;
  status: ReconciliationStatus;
  ours: UsageCount;
  usageCounter: UsageCount | null;
  storeSmtp: number;
  provider: { total: number; rows: number; days: number } | null;
  difference: number | null;
  differencePct: number | null;
  tolerance: number | null;
  error: string | null;
  attempts: number;
  checkedAt: string;
  /** Backend PRD-050 D22, PARENT rows: what the count is made of. */
  parentSources?: { storeShared: number; platformMail: number; stores: number } | null;
}

export interface ReconciliationTotals {
  stores: number;
  matched: number;
  mismatched: number;
  providerErrors: number;
  noProviderData: number;
  ours: number;
  provider: number;
}

export interface ReconciliationList {
  month: string | null;
  months: string[];
  items: MessagingReconciliation[];
  total: number;
  totals: ReconciliationTotals;
}

// ─── Labels ───────────────────────────────────────────────────────────────

export const RECONCILIATION_STATUS_LABEL: Readonly<Record<ReconciliationStatus, string>> = {
  MATCHED: "Matches",
  MISMATCH: "Differs",
  PROVIDER_ERROR: "MSG91 error",
  NO_PROVIDER_DATA: "No MSG91 data",
};

export const RECONCILIATION_STATUS_TONE: Readonly<Record<ReconciliationStatus, Tone>> = {
  MATCHED: "success",
  MISMATCH: "danger",
  PROVIDER_ERROR: "warning",
  NO_PROVIDER_DATA: "neutral",
};

/** Differences first: the tab the alert links to. */
export const RECONCILIATION_STATUS_TABS: ReadonlyArray<{ value: ReconciliationStatusTab; label: string }> = [
  { value: "ALL", label: "All" },
  { value: reconciliationStatusEnum.MISMATCH, label: "Differs" },
  { value: reconciliationStatusEnum.PROVIDER_ERROR, label: "MSG91 error" },
  { value: reconciliationStatusEnum.MATCHED, label: "Matches" },
  { value: reconciliationStatusEnum.NO_PROVIDER_DATA, label: "No data" },
];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ─── Helpers ──────────────────────────────────────────────────────────────

export function isReconciliationStatusTab(value: string | null): value is ReconciliationStatusTab {
  return RECONCILIATION_STATUS_TABS.some((tab) => tab.value === value);
}

/** "2026-10" → "Oct 2026" (the IST month). */
export function formatReconcileMonth(month: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month ?? ""));
  if (!match) return "—";
  const index = Number(match[2]) - 1;
  return index >= 0 && index < 12 ? `${MONTH_NAMES[index]} ${match[1]}` : "—";
}

export function reconciliationVariables(
  month: string | null,
  status: ReconciliationStatusTab,
  limit: number,
  offset: number,
) {
  return { month, status: status === "ALL" ? null : status, limit, offset };
}

/** "+12 (4.5 %)" / "−3 (1 %)" / "—" without MSG91 data. */
export function differenceText(row: Pick<MessagingReconciliation, "difference" | "differencePct">): string {
  if (row.difference === null || row.difference === undefined) return "—";
  const count = row.difference;
  const sign = count > 0 ? "+" : count < 0 ? "−" : "";
  const pct = typeof row.differencePct === "number" ? ` (${row.differencePct} %)` : "";
  return `${sign}${Math.abs(count).toLocaleString("en-IN")}${pct}`;
}

/** "Transactional 60 · Marketing 30" (zero purposes left out). */
export function purposeSummary(counts: PurposeCounts | null | undefined): string {
  if (!counts) return "";
  const parts: string[] = [];
  if (counts.TRANSACTIONAL) parts.push(`Transactional ${counts.TRANSACTIONAL.toLocaleString("en-IN")}`);
  if (counts.MARKETING) parts.push(`Marketing ${counts.MARKETING.toLocaleString("en-IN")}`);
  if (counts.SERVICE) parts.push(`Service ${counts.SERVICE.toLocaleString("en-IN")}`);
  return parts.join(" · ");
}

/**
 * Backend PRD-050 D22: the parent row's second line, e.g. "Shared address
 * from 3 stores 1,200 · Zerror's own mail 80".
 */
export function parentSourcesText(row: Pick<MessagingReconciliation, "scope" | "parentSources">): string {
  if (row.scope !== "PARENT") return "";
  const sources = row.parentSources;
  if (!sources) return "Shared-address mail sent through Zerror's account";
  const stores = sources.stores === 1 ? "1 store" : `${sources.stores.toLocaleString("en-IN")} stores`;
  return `Shared address from ${stores} ${sources.storeShared.toLocaleString("en-IN")} · Zerror's own mail ${sources.platformMail.toLocaleString("en-IN")}`;
}

// ─── Server errors ────────────────────────────────────────────────────────

export const RECONCILIATION_REASON_COPY: Readonly<Record<string, string>> = {
  INVALID_MONTH: "Choose a month as YYYY-MM.",
  INVALID_STATUS: "That status filter isn't known. The list is reset.",
};

export function reconciliationFailureCopy(error: unknown): string | null {
  const reason = errorReasonOf(error);
  if (reason && RECONCILIATION_REASON_COPY[reason]) return RECONCILIATION_REASON_COPY[reason];
  return mutationFailureCopy(error) ?? null;
}
