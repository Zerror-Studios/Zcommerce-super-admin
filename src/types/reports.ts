/**
 * Report row shapes shown by Platform revenue, Collections and Transactions.
 * The server computes every figure (PRD-005 FR-5.3); `lib/api-report-adapters.ts`
 * maps the API rollups onto these types.
 */

import type { Client, PaymentGateway, PlanName, Subscription, SubscriptionHealthBucket } from "./index";

// ─── Platform revenue ─────────────────────────────────────────────────────

export interface MonthlyPlanRevenue {
  key: string; // YYYY-MM
  label: string;
  year: number;
  month: number; // 1-12
  STARTER: number;
  PREMIUM: number;
  PLUS: number;
  ENTERPRISE: number;
}

export interface RevenueKpis {
  planRevenue: number;
  netCollected: number;
  pendingAmount: number;
  failedAmount: number;
  refundedAmount: number;
  activeMrr: number;
  payingStores: number;
  momChangePercent: number | null;
}

export interface PlanBreakdownRow {
  plan: PlanName;
  revenue: number;
  sharePercent: number;
  storeCount: number;
  mrr: number;
}

export interface GatewayBreakdownRow {
  gateway: PaymentGateway;
  collected: number;
  failed: number;
  pending: number;
  refunded: number;
  sharePercent: number;
}

export interface TopStoreRevenueRow {
  clientId: string;
  storeName: string;
  ownerEmail: string;
  plan: PlanName;
  collected: number;
  failed: number;
  txnCount: number;
}

export interface RevenueTrendPoint {
  month: string;
  fullLabel: string;
  revenue: number;
  mrr: number;
}

// ─── Collections ──────────────────────────────────────────────────────────

export type ReportDrillFilter =
  | "all"
  | "healthy"
  | "at_risk"
  | "unhealthy"
  | "paid_month"
  | "pending"
  | "overdue"
  | "overdue_grace"
  | "renewals_7"
  | "renewals_30"
  | "churned_month"
  | "new_month"
  | "expected";

export interface ShopReportRow {
  clientId: string;
  storeName: string;
  ownerName: string;
  ownerEmail: string;
  plan: PlanName;
  clientStatus: Client["status"];
  subscriptionStatus: Subscription["status"] | "none";
  health: SubscriptionHealthBucket;
  healthReason: string;
  lastPaymentDate: string | null;
  nextDueDate: string | null;
  amountDue: number;
  daysOverdue: number;
  isOverdueInGrace: boolean;
  mrr: number;
}

export interface PaymentReportRow {
  id: string;
  clientId: string;
  shopName: string;
  ownerEmail: string;
  plan: PlanName;
  amount: number;
  currency: string;
  dueDate: string | null;
  paidDate: string | null;
  status: "paid" | "pending" | "overdue" | "failed" | "refunded";
  paymentMethod: string;
  transactionId: string;
}

export interface MonthSnapshot {
  collectedCount: number;
  collectedAmount: number;
  pendingCount: number;
  pendingAmount: number;
  expectedAmount: number;
  collectedPercent: number;
  newSubscriptions: number;
  renewals: number;
  cancellations: number;
}

export interface SubscriptionReportOverview {
  totalShops: number;
  healthyCount: number;
  atRiskCount: number;
  unhealthyCount: number;
  /** At-risk shops whose renewal passed unpaid but are still in grace. */
  overdueInGraceCount: number;
  paidThisMonth: { count: number; amount: number };
  pendingPayments: { count: number; amount: number };
  overduePayments: { count: number; amount: number };
  expectedRevenue: number;
  collectedRevenue: number;
  collectedPercent: number;
  renewals7: number;
  renewals30: number;
  churnedThisMonth: number;
  currentMonth: MonthSnapshot;
  previousMonth: MonthSnapshot;
}
