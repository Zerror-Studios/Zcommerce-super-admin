/**
 * Platform admin API shapes (PRD-005 §5.1, Phases 1–2)
 *
 * Hand-written from `zcom-backend/services/platform-admin/src/graphql/schemas`.
 * Enums carry the backend values; labels come from `display-labels.util.ts`.
 * Codegen replaces this file once the schema is published (pointer PRD).
 */

import type { PlanName, SubscriptionStatus } from "./index";

// ─── Enums ────────────────────────────────────────────────────────────────

export const platformRoleEnum = {
  PLATFORM_OWNER: "PLATFORM_OWNER",
  PLATFORM_ADMIN: "PLATFORM_ADMIN",
  BILLING_MANAGER: "BILLING_MANAGER",
  SUPPORT_AGENT: "SUPPORT_AGENT",
  READ_ONLY: "READ_ONLY",
} as const;

export type PlatformRole =
  (typeof platformRoleEnum)[keyof typeof platformRoleEnum];

export type PlatformUserStatus = "ACTIVE" | "INVITED" | "DISABLED";

export type PlatformTenantStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

export type PlatformBillingCycle = "MONTHLY" | "YEARLY";

export type PlanChangeEffective = "NOW" | "PERIOD_END";

export type TenantOnboardingStatus = "PROVISIONING" | "READY" | "FAILED";

/** `PlatformTenantRegion` enum keys; the API maps them to AWS region ids. */
export type TenantRegion = "ap_south_1" | "us_east_1" | "eu_west_1";

export type HealthTone = "success" | "warning" | "danger" | "info" | "neutral";

// ─── Identity ─────────────────────────────────────────────────────────────

export interface PlatformUser {
  id: string;
  email: string;
  name: string;
  role: PlatformRole;
  status: PlatformUserStatus;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface PlatformAuthPayload {
  accessToken: string;
  expiresIn: number;
  user: PlatformUser;
  mfaRequired: boolean;
}

export interface PlatformMfaEnrolment {
  otpauthUrl: string;
  secret: string;
}

export interface PlatformMfaConfirmation {
  recoveryCodes: string[];
  accessToken: string;
}

// ─── Plans ────────────────────────────────────────────────────────────────

export interface PlatformPlan {
  id: string;
  tenantId: string | null;
  name: PlanName;
  price: { monthly: number; yearly: number; currency: string };
  limits: {
    maxSkus: number;
    emailsPerMonth: number;
    smsPerMonth: number;
    whatsappPerMonth: number;
    maxStaffAccounts: number;
    internationalMarkets: number;
    developmentHours: number;
  };
  features: {
    onlineStore: boolean;
    blogSystem: string;
    lookCreation: boolean;
    analytics: string;
    salesChannels: boolean;
    prioritySupport: string;
    unlimitedWebHosting: boolean;
    sslCertificate: boolean;
  };
  isActive: boolean;
  createdAt: string | null;
}

// ─── Subscriptions ────────────────────────────────────────────────────────

export interface PlatformSubscription {
  id: string;
  tenantId: string;
  tenantName: string;
  plan: PlatformPlan | null;
  status: SubscriptionStatus;
  billingCycle: PlatformBillingCycle;
  mrr: number;
  amountDue: number;
  renewalDate: string;
  startedAt: string | null;
  trialEndsAt: string | null;
  cancelledAt: string | null;
  cancelAtPeriodEnd: boolean;
  daysOverdue: number;
  /** PRD-014 D6: plan scheduled for `renewalDate`, if any. */
  pendingPlanId: string | null;
  pendingBillingCycle: PlatformBillingCycle | null;
}

// ─── Tenants ──────────────────────────────────────────────────────────────

export interface TenantOnboardingStep {
  key: string;
  status: "PENDING" | "DONE" | "FAILED";
  error: string | null;
}

export interface TenantOnboarding {
  status: TenantOnboardingStatus;
  error: string | null;
  steps: TenantOnboardingStep[];
}

export interface TenantPaymentState {
  label: string;
  tone: HealthTone;
  detail: string | null;
}

export interface TenantSubscriptionHealth {
  bucket: "healthy" | "at_risk" | "unhealthy";
  reason: string;
  daysOverdue: number;
  daysUntilRenewal: number;
  isOverdueInGrace: boolean;
}

export interface TenantUsage {
  date: string;
  products: number;
  orders30d: number;
  /** Net revenue (PRD-012 FR-8.2). */
  revenue30d: number;
  growthPercent: number;
  storageMb: number;
  staffCount: number;
  lastActiveAt: string | null;
  pageViews30d: number;
  sessions30d: number;
  /** Paid orders ÷ GA4 sessions, as a percent. */
  conversionRate30d: number;
}

export interface PlatformTenant {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  region: string | null;
  status: PlatformTenantStatus;
  timezone: string | null;
  currency: string | null;
  owner: { name: string | null; email: string | null; phone: string | null };
  billing: { contactEmail: string | null; gstin: string | null };
  onboarding: TenantOnboarding;
  gracePeriodDaysOverride: number | null;
  notes: string | null;
  plan: PlatformPlan | null;
  subscription: PlatformSubscription | null;
  monthlyFee: number;
  healthScore: number;
  healthFactors: string[];
  paymentState: TenantPaymentState;
  subscriptionHealth: TenantSubscriptionHealth;
  usage: TenantUsage | null;
  suspendedAt: string | null;
  suspendReason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PlatformList<T> {
  items: T[];
  totalCount: number;
}

// ─── Inputs (Phase 2) ─────────────────────────────────────────────────────

export interface CreateTenantInput {
  name: string;
  slug: string;
  domain?: string | null;
  region: TenantRegion;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string | null;
  planId: string;
  billingCycle: PlatformBillingCycle;
  startActive: boolean;
  timezone?: string | null;
  currency?: string | null;
}

export interface UpdateTenantInput {
  name?: string;
  domain?: string | null;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string | null;
  billingContactEmail?: string | null;
  gstin?: string | null;
  gracePeriodDaysOverride?: number | null;
  timezone?: string;
  currency?: string;
}

// ─── Settings ─────────────────────────────────────────────────────────────

export interface PlatformSettingsApi {
  health: { expiringWithinDays: number; inactiveAfterDays: number };
  gracePeriodDays: number;
  billing: { provider: "MANUAL" | "NIMBBL" | "RAZORPAY" | "STRIPE"; configured?: boolean };
  reminders: {
    daysBeforeDue: number[];
    daysAfterDue: number[];
    channels: { email: boolean; sms: boolean; whatsapp: boolean };
    template: string;
  };
  yearKind: "CALENDAR" | "FINANCIAL";
}

// ─── Billing (Phase 3) ────────────────────────────────────────────────────

export type PlatformInvoiceStatus = "ISSUED" | "PAID" | "OVERDUE" | "VOID" | "REFUNDED";

export interface PlatformInvoice {
  id: string;
  tenantId: string;
  tenantName: string;
  subscriptionId: string;
  number: string;
  planName: PlanName;
  billingCycle: PlatformBillingCycle;
  periodStart: string;
  periodEnd: string;
  amount: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  status: PlatformInvoiceStatus;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  couponCode: string | null;
  voidReason: string | null;
}

export type PlatformPaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";

export interface PlatformPayment {
  id: string;
  tenantId: string;
  tenantName: string;
  amount: number;
  currency: string;
  provider: "NIMBBL" | "RAZORPAY" | "STRIPE" | "MANUAL";
  type: string;
  status: PlatformPaymentStatus;
  planName: PlanName | null;
  transactionId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string | null;
}

export interface PlatformCoupon {
  id: string;
  code: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  appliesTo: string;
  maxRedemptions: number;
  redemptions: number;
  expiresAt: string;
  active: boolean;
  createdAt: string;
}

export interface PlatformCouponInput {
  code: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  appliesTo: string;
  maxRedemptions: number;
  expiresAt: string;
  active?: boolean;
}

export interface ReminderPreview {
  tenantId: string;
  recipient: string;
  channel: "EMAIL" | "SMS" | "WHATSAPP";
  subject: string;
  body: string;
  daysUntilDue: number;
}

export interface ReminderBatch {
  queued: number;
  skipped: { tenantId: string; reason: string }[];
}

// ─── Reports (Phase 3) ────────────────────────────────────────────────────

export interface DateRangeInput {
  /** YYYY-MM-DD calendar days from the picker. */
  start: string;
  end: string;
}

export interface ApiMonthlyPlanRevenue {
  key: string;
  label: string;
  year: number;
  month: number;
  STARTER: number;
  PREMIUM: number;
  PLUS: number;
  ENTERPRISE: number;
  total: number;
}

export interface PlatformRevenueOverview {
  rangeStart: string;
  rangeEnd: string;
  kpis: {
    planRevenue: number;
    netCollected: number;
    pendingAmount: number;
    failedAmount: number;
    refundedAmount: number;
    activeMrr: number;
    payingStores: number;
    momChangePercent: number | null;
  };
  monthly: ApiMonthlyPlanRevenue[];
  trend: { month: string; fullLabel: string; revenue: number; mrr: number }[];
  planRows: { plan: PlanName; revenue: number; sharePercent: number; storeCount: number; mrr: number }[];
  gatewayRows: {
    gateway: "NIMBBL" | "RAZORPAY" | "STRIPE" | "MANUAL";
    collected: number;
    failed: number;
    pending: number;
    refunded: number;
    sharePercent: number;
  }[];
  topStores: {
    tenantId: string;
    storeName: string;
    ownerEmail: string;
    plan: PlanName;
    collected: number;
    failed: number;
    txnCount: number;
  }[];
  summary: {
    monthlyBilling: number;
    billableStores: number;
    earnedMonth: number;
    earnedYear: number;
    earnedLastYearToDate: number;
    paidStoresMonth: number;
    projectedYear: number;
    outstandingAmount: number;
    unpaidStores: number;
    overdueStores: number;
    collectionRate: number | null;
  };
}

// ─── Platform analytics (PRD-012 FR-8.3) ──────────────────────────────────

/** Health of a store's analytics sync; `null` when no analytics app is installed. */
export type AnalyticsHealth =
  | "OK"
  | "ERROR"
  | "QUOTA_PAUSED"
  | "BACKFILLING"
  | "NOT_CONNECTED";

export type IntegrationStatus = "ACTIVE" | "INACTIVE" | "ERROR";

export interface StorePerformanceRow {
  tenantId: string;
  slug: string;
  name: string;
  sessions30d: number;
  orders30d: number;
  /** Net revenue in the last 30 days. */
  revenue30d: number;
  growthPercent: number;
  /** Percent. */
  conversionRate30d: number;
  pageViews30d: number;
  analyticsHealth: AnalyticsHealth | string;
}

export interface PlatformAnalyticsTrendPoint {
  /** YYYY-MM-DD. */
  date: string;
  sessions: number;
  orders: number;
  gmv: number;
}

export interface PlatformAnalyticsOverview {
  kpis: {
    sessions: number;
    orders: number;
    gmv: number;
    /** Percent. */
    conversionRate: number;
    storesWithTraffic: number;
    storesTotal: number;
  };
  previous: {
    sessions: number;
    orders: number;
    gmv: number;
    conversionRate: number;
  };
  topStoresByGmv: StorePerformanceRow[];
  topStoresByGrowth: StorePerformanceRow[];
  trend: PlatformAnalyticsTrendPoint[];
}

export interface IntegrationHealthFilter {
  provider?: string | null;
  channelType?: string | null;
  status?: string | null;
  search?: string | null;
}

export interface IntegrationHealthRow {
  tenantId: string;
  slug: string;
  name: string;
  connectionId: string;
  provider: string;
  channelType: string;
  status: IntegrationStatus | string;
  lastTestedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  analyticsHealth: AnalyticsHealth | string | null;
  dataThrough: string | null;
}

export interface PlatformIntegrationHealth {
  rows: IntegrationHealthRow[];
  totalCount: number;
  counts: { status: string; count: number }[];
  byProvider: { provider: string; count: number; errors: number }[];
}

export interface SyncMonitorSummary {
  installations: number;
  healthy: number;
  error: number;
  quotaPaused: number;
  backfilling: number;
  runs24hCompleted: number;
  runs24hFailed: number;
  quotaTokensToday: number;
  durationMsP95: number;
}

export interface SyncMonitorRow {
  tenantId: string;
  slug: string;
  name: string;
  connectionId: string;
  provider: string;
  propertyId: string;
  health: AnalyticsHealth | string;
  lastSuccessAt: string | null;
  lastRunAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  quotaTokensToday: number;
  quotaPausedUntil: string | null;
  backfillDone: number;
  backfillTotal: number;
  sessions7d: number;
  sessions30d: number;
  dataThrough: string | null;
  runs24hCompleted: number;
  runs24hFailed: number;
  /** Set once an operator asked for a re-run; cleared when the scheduler picks it up. */
  rerunRequestedAt: string | null;
}

export interface PlatformSyncMonitor {
  summary: SyncMonitorSummary;
  failing: SyncMonitorRow[];
  backfills: SyncMonitorRow[];
  installations: SyncMonitorRow[];
}

export interface ApiPeriodSnapshot {
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

export interface PlatformCollections {
  rangeStart: string;
  rangeEnd: string;
  overview: {
    totalShops: number;
    healthyCount: number;
    atRiskCount: number;
    unhealthyCount: number;
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
    currentPeriod: ApiPeriodSnapshot;
    previousPeriod: ApiPeriodSnapshot;
  };
  shops: {
    tenantId: string;
    storeName: string;
    ownerName: string;
    ownerEmail: string;
    plan: PlanName;
    clientStatus: "active" | "trial" | "suspended";
    subscriptionStatus: string;
    health: "healthy" | "at_risk" | "unhealthy";
    healthReason: string;
    lastPaymentDate: string | null;
    nextDueDate: string | null;
    amountDue: number;
    daysOverdue: number;
    isOverdueInGrace: boolean;
    mrr: number;
  }[];
  invoices: {
    id: string;
    tenantId: string;
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
  }[];
}
