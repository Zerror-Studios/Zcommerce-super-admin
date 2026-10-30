/**
 * Stores at risk for the console (PRD-025 FR-5.2, FR-6.5)
 *
 * The Stores page's "At risk" view lists what `platformStoresAtRisk`
 * flagged from the nightly snapshot and the master invoices. These
 * helpers give each reason a label and a tone, the figures a row shows,
 * and the server-paging arithmetic. Thresholds are the server's (PRD-025
 * D8); nothing is judged in the browser.
 */

import { DEFAULT_PAGE_SIZE } from "../components/ui/TablePagination";
import type { Tone } from "../components/ui/tones";
import type { PlatformStoreAtRisk, StoreRiskReason } from "../types/platform-api";
import { humaniseConstant } from "./store-profile.util";

// ─── Constants ────────────────────────────────────────────────────────────

export const RISK_REASON_LABELS: Readonly<Record<StoreRiskReason, string>> = {
  INVOICE_OVERDUE_PAST_GRACE: "Invoice overdue past grace",
  NO_ORDERS_14D: "No orders in 14 days",
  CHECKOUT_FAILURES_7D: "Checkout failures this week",
  DLQ_DEPTH: "Dead-lettered events",
  ORDERS_PAUSED: "Orders paused",
};

export const RISK_REASON_TONES: Readonly<Record<StoreRiskReason, Tone>> = {
  INVOICE_OVERDUE_PAST_GRACE: "danger",
  NO_ORDERS_14D: "warning",
  CHECKOUT_FAILURES_7D: "warning",
  DLQ_DEPTH: "danger",
  ORDERS_PAUSED: "danger",
};

/** One shared page size, like every table (owner, 2026-10-26). */
export const AT_RISK_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export const AT_RISK_EMPTY_COPY = {
  title: "No stores at risk",
  description:
    "Nothing the nightly snapshot flags: no overdue invoices past grace, no stalled orders, no checkout failures, no dead letters.",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────

export interface RiskReasonChip {
  key: string;
  label: string;
  tone: Tone;
}

export interface RiskFigure {
  key: string;
  label: string;
  value: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** The reasons as chips, in the server's order; an unknown value is humanised, neutral. */
export function riskReasonChips(reasons: readonly string[]): RiskReasonChip[] {
  return reasons.map((reason) => ({
    key: reason,
    label: RISK_REASON_LABELS[reason as StoreRiskReason] ?? humaniseConstant(reason),
    tone: RISK_REASON_TONES[reason as StoreRiskReason] ?? "neutral",
  }));
}

/** The counts behind the reasons; a null (not collected) figure is left out. */
export function riskFigures(row: PlatformStoreAtRisk): RiskFigure[] {
  const figures: RiskFigure[] = [];
  if (row.overdueInvoices > 0) {
    figures.push({ key: "overdueInvoices", label: "overdue", value: row.overdueInvoices });
  }
  if (row.checkoutFailures7d != null) {
    figures.push({ key: "checkoutFailures7d", label: "checkout failures", value: row.checkoutFailures7d });
  }
  if (row.dlqDepth != null) {
    figures.push({ key: "dlqDepth", label: "dead letters", value: row.dlqDepth });
  }
  if (row.orders14d != null) {
    figures.push({ key: "orders14d", label: "orders · 14d", value: row.orders14d });
  }
  return figures;
}

/** The 1-based page kept inside the list (a stale URL past the end falls to the last page). */
export function atRiskPage(page: number, totalCount: number, pageSize = AT_RISK_PAGE_SIZE): number {
  const pages = Math.max(1, Math.ceil(totalCount / pageSize));
  return Math.min(Math.max(1, Math.floor(page) || 1), pages);
}

export function atRiskOffset(page: number, pageSize = AT_RISK_PAGE_SIZE): number {
  return (Math.max(1, page) - 1) * pageSize;
}
