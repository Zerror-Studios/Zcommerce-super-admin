/**
 * API → console report shapes (PRD-005 FR-5.3, Phase 3)
 *
 * Maps the server rollups onto the report row types in `types/reports.ts`,
 * so the screens render server money unchanged.
 */

import type { Coupon, PlanName, Transaction, TransactionStatus } from "../types";
import type {
  GatewayBreakdownRow,
  MonthlyPlanRevenue,
  PaymentReportRow,
  PlanBreakdownRow,
  RevenueKpis,
  RevenueTrendPoint,
  ShopReportRow,
  SubscriptionReportOverview,
  TopStoreRevenueRow,
} from "../types/reports";

/** Total across plans for one month row. */
export function monthTotal(row: MonthlyPlanRevenue): number {
  return row.STARTER + row.PREMIUM + row.PLUS + row.ENTERPRISE;
}
import type {
  PlatformCollections,
  PlatformCoupon,
  PlatformCouponInput,
  PlatformCouponUpdateInput,
  PlatformPayment,
  PlatformRevenueOverview,
} from "../types/platform-api";

// ─── Payments ─────────────────────────────────────────────────────────────

const PAYMENT_STATUS: Record<PlatformPayment["status"], TransactionStatus> = {
  SUCCESS: "success",
  FAILED: "failed",
  REFUNDED: "refunded",
  PENDING: "pending",
};

export function toTransaction(payment: PlatformPayment): Transaction {
  return {
    id: payment.id,
    clientId: payment.tenantId,
    clientName: payment.tenantName,
    amount: payment.amount,
    currency: payment.currency,
    gateway: payment.provider,
    status: PAYMENT_STATUS[payment.status],
    date: payment.createdAt ?? new Date(0).toISOString(),
    dueDate: payment.periodStart ?? undefined,
    transactionId: payment.transactionId ?? payment.id,
  };
}

// ─── Coupons ──────────────────────────────────────────────────────────────

export function toCoupon(coupon: PlatformCoupon): Coupon {
  return {
    id: coupon.id,
    code: coupon.code,
    discountType: coupon.discountType === "PERCENT" ? "percent" : "fixed",
    discountValue: coupon.discountValue,
    appliesTo: coupon.appliesTo === "ALL" ? "All" : (coupon.appliesTo as PlanName),
    redemptions: coupon.redemptions,
    maxRedemptions: coupon.maxRedemptions,
    expiresAt: coupon.expiresAt.slice(0, 10),
    active: coupon.active,
  };
}

export function toCouponInput(coupon: Coupon): PlatformCouponInput {
  return {
    code: coupon.code,
    discountType: coupon.discountType === "percent" ? "PERCENT" : "FIXED",
    discountValue: coupon.discountValue,
    appliesTo: coupon.appliesTo === "All" ? "ALL" : coupon.appliesTo,
    maxRedemptions: coupon.maxRedemptions,
    expiresAt: coupon.expiresAt,
    active: coupon.active,
  };
}

/** Only the changed fields, for `updatePlatformCoupon` (PRD-014 PLT-13). */
export function toCouponUpdateInput(patch: Partial<Coupon>): PlatformCouponUpdateInput {
  const input: PlatformCouponUpdateInput = {};
  if (patch.code !== undefined) input.code = patch.code;
  if (patch.discountType !== undefined) input.discountType = patch.discountType === "percent" ? "PERCENT" : "FIXED";
  if (patch.discountValue !== undefined) input.discountValue = patch.discountValue;
  if (patch.appliesTo !== undefined) input.appliesTo = patch.appliesTo === "All" ? "ALL" : patch.appliesTo;
  if (patch.maxRedemptions !== undefined) input.maxRedemptions = patch.maxRedemptions;
  if (patch.expiresAt !== undefined) input.expiresAt = patch.expiresAt;
  if (patch.active !== undefined) input.active = patch.active;
  return input;
}

// ─── Revenue ──────────────────────────────────────────────────────────────

export interface RevenueView {
  kpis: RevenueKpis;
  monthly: MonthlyPlanRevenue[];
  trend: RevenueTrendPoint[];
  planRows: PlanBreakdownRow[];
  gatewayRows: GatewayBreakdownRow[];
  topStores: TopStoreRevenueRow[];
  billing: number;
  summary: PlatformRevenueOverview["summary"];
}

export const EMPTY_REVENUE: RevenueView = {
  kpis: {
    planRevenue: 0,
    netCollected: 0,
    pendingAmount: 0,
    failedAmount: 0,
    refundedAmount: 0,
    activeMrr: 0,
    payingStores: 0,
    momChangePercent: null,
  },
  monthly: [],
  trend: [],
  planRows: [],
  gatewayRows: [],
  topStores: [],
  billing: 0,
  summary: {
    monthlyBilling: 0,
    billableStores: 0,
    earnedMonth: 0,
    earnedYear: 0,
    earnedLastYearToDate: 0,
    paidStoresMonth: 0,
    projectedYear: 0,
    outstandingAmount: 0,
    unpaidStores: 0,
    overdueStores: 0,
    collectionRate: null,
  },
};

export function toRevenueView(overview: PlatformRevenueOverview): RevenueView {
  return {
    kpis: overview.kpis,
    monthly: overview.monthly.map(({ total: _total, ...row }) => row),
    trend: overview.trend,
    planRows: overview.planRows,
    gatewayRows: overview.gatewayRows,
    topStores: overview.topStores.map(({ tenantId, ...row }) => ({ clientId: tenantId, ...row })),
    billing: overview.summary.monthlyBilling,
    summary: overview.summary,
  };
}

// ─── Collections ──────────────────────────────────────────────────────────

export interface CollectionsView {
  overview: SubscriptionReportOverview;
  shopRows: ShopReportRow[];
  paymentRows: PaymentReportRow[];
}

export function toCollectionsView(data: PlatformCollections): CollectionsView {
  const { currentPeriod, previousPeriod, ...rest } = data.overview;
  return {
    overview: { ...rest, currentMonth: currentPeriod, previousMonth: previousPeriod },
    shopRows: data.shops.map(({ tenantId, subscriptionStatus, ...row }) => ({
      clientId: tenantId,
      subscriptionStatus: subscriptionStatus as ShopReportRow["subscriptionStatus"],
      ...row,
    })),
    paymentRows: data.invoices.map(({ tenantId, ...row }) => ({ clientId: tenantId, ...row })),
  };
}

/** `YYYY-MM-DD` of a picker date, from its local calendar fields. */
export function toPickerDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
