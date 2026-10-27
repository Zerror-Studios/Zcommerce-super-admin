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

/** PRD-017 FR-1.1: a plan version's lifecycle; only ACTIVE is sellable. */
export const platformPlanStatusEnum = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  LEGACY: "LEGACY",
  ARCHIVED: "ARCHIVED",
} as const;

export type PlatformPlanStatus =
  (typeof platformPlanStatusEnum)[keyof typeof platformPlanStatusEnum];

/** PRD-016 FR-15: ORDERS_PAUSED = the store takes no new shopper orders. */
export type PlatformBillingState = "OK" | "ORDERS_PAUSED";

/** PRD-016 FR-14: how plan limits act. */
export const entitlementsModeEnum = {
  OFF: "OFF",
  LOG: "LOG",
  ENFORCE: "ENFORCE",
} as const;

export type EntitlementsMode =
  (typeof entitlementsModeEnum)[keyof typeof entitlementsModeEnum];

/** PRD-016 FR-19: how staff end a flagged payment. */
export const flaggedPaymentActionEnum = {
  APPLY: "APPLY",
  REFUNDED_OUTSIDE: "REFUNDED_OUTSIDE",
  DISMISS: "DISMISS",
} as const;

export type FlaggedPaymentAction =
  (typeof flaggedPaymentActionEnum)[keyof typeof flaggedPaymentActionEnum];

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
  /** Sent as `x-zcom-csrf` on every mutation (PRD-014 FR-1.11). */
  csrfToken: string;
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
    /**
     * PRD-021: 0 = none; changes in place (PRD-017 D14). Only the plan
     * screens ask for the AI fields (`PLATFORM_PLAN_AI_FIELDS`).
     */
    aiQuestionsPerWeek?: number;
    /** -1 = fair use */
    aiConnectorCallsPerWeek?: number;
    aiMonthlyTokenBudget?: number;
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
    /** PRD-021: Ask ZCOM and the AI limits apply only when true (plan screens only) */
    aiEnabled?: boolean;
    aiDailySummary?: boolean;
  };
  isActive: boolean;
  createdAt: string | null;
  /** Stores on this plan, counted on the server; only `platformPlans` asks for it. */
  tenantCount?: number;
  // ── PRD-017 FR-1.1 (optional so older cached rows still type-check) ──
  version?: number;
  status?: PlatformPlanStatus;
  isPublic?: boolean;
  displayName?: string;
  description?: string | null;
  sortOrder?: number;
  supersedesPlanId?: string | null;
  supersededByPlanId?: string | null;
  /** Non-cancelled subscriptions on the plan (FR-1.7). */
  subscriberCount?: number;
  /** Subscriptions with this plan pending (FR-1.7). */
  pendingCount?: number;
  /** The version chain, oldest first; only `platformPlan(id)`. */
  versions?: PlatformPlan[];
}

export type PlatformPlanLimits = PlatformPlan["limits"];

export type PlatformPlanFeatures = PlatformPlan["features"];

/** `createPlan` input (PRD-017 §5.1); 0 in a limit = unlimited (PRD-016 D12). */
export interface PlatformPlanInput {
  tenantId?: string | null;
  name: PlanName;
  displayName: string;
  description?: string | null;
  status: "DRAFT" | "ACTIVE";
  isPublic?: boolean;
  sortOrder?: number;
  price: { monthly: number; yearly: number };
  limits: PlatformPlanLimits;
  features: PlatformPlanFeatures;
}

/**
 * `updatePlan` input: every field optional; a missing limit or feature
 * keeps its saved value (an AI-only edit sends just the AI keys, D14).
 */
export type PlatformPlanUpdateInput = Partial<
  Omit<PlatformPlanInput, "tenantId" | "name" | "limits" | "features">
> & {
  limits?: Partial<PlatformPlanLimits>;
  features?: Partial<PlatformPlanFeatures>;
};

export interface PlatformPlanUpdateResult {
  plan: PlatformPlan;
  versioned: boolean;
  previousPlan: PlatformPlan | null;
}

export interface PlanMigrationResult {
  scheduled: number;
  alreadyScheduled: number;
  deferredForNotice: number;
}

/** PRD-016 FR-6: what `changeTenantPlan` would do. */
export interface PlatformPlanChangePreview {
  effective: PlanChangeEffective;
  effectiveAt: string;
  credit: number;
  charge: number;
  amountDueNow: number;
  nextInvoiceAmount: number;
  currency: string;
  /** Limit keys the store is already over on the new plan. */
  overLimits: string[];
  /**
   * Platform credit the change issues (a forced NOW downgrade: credit −
   * charge; monthly → yearly: the unused part); 0 = none. Optional for
   * servers from before the field.
   */
  creditIssued?: number;
}

// ─── Subscriptions ────────────────────────────────────────────────────────

export interface PlatformSubscription {
  id: string;
  tenantId: string;
  tenantName: string;
  /** Absent in the store reads (`PlatformSubscriptionCoreFields`): use the store's `plan`. */
  plan?: PlatformPlan | null;
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
  // ── PRD-016 FR-5, FR-15, FR-16 (optional for older cached rows) ──
  creditBalance?: number;
  billingState?: PlatformBillingState;
  /** Null while dunning is off. */
  ordersPauseAt?: string | null;
  suspendsAt?: string | null;
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
  /** PRD-024 FR-2.1: null when the previous 30 days sold nothing. */
  growthPercent: number | null;
  /** PRD-024 FR-2.1: the previous 30 days' net revenue and paid orders. */
  previousRevenue?: number | null;
  previousOrders?: number | null;
  storageMb: number;
  staffCount: number;
  lastActiveAt: string | null;
  pageViews30d: number;
  sessions30d: number;
  /** Paid orders ÷ GA4 sessions, as a percent. */
  conversionRate30d: number;
  /** PRD-024 FR-2.7: a collector failed; its figures were carried from the previous snapshot. */
  partial?: boolean;
  /** PRD-024 FR-3.7: messages sent this month (IST), every channel; null until counted. */
  messagesThisMonth?: number | null;
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
  /** PRD-018 FR-1.1; null while the store isn't suspended. */
  suspendCategory?: TenantSuspendCategory | null;
  /** PRD-018 FR-2.3: when a DELETED store may be purged. */
  purgeAfter?: string | null;
  /** PRD-018 FR-4.1. */
  domainStatus?: TenantDomainStatus;
  /** PRD-018 FR-4.2: a domain being verified (never resolves). */
  pendingDomain?: string | null;
  liveAt?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// ─── Tenant data lifecycle (PRD-018 §5.1) ─────────────────────────────────

export type TenantSuspendCategory =
  | "BILLING"
  | "POLICY"
  | "OWNER_REQUEST"
  | "MAINTENANCE";

export type TenantDomainStatus =
  | "NONE"
  | "PENDING"
  | "VERIFIED"
  | "LIVE"
  | "FAILED";

export type GoLiveCheckState = "PASS" | "FAIL" | "UNKNOWN" | "WAIVED";

/** FR-1.2: what a suspension or delete would leave open; `partial` = a count timed out. */
export interface TenantMoneyInFlight {
  pendingPayments: number;
  paidUnfulfilledOrders: number;
  refundsInProgress: number;
  needsRefundOrders: number;
  needsAttentionOrders: number;
  openReturns: number;
  activeHolds: number;
  activeMarketplaceListings: number;
  openPlatformInvoices: number;
  partial: boolean;
}

/** FR-4.2: publish `recordName` TXT = `recordValue`, then check. */
export interface TenantDomainVerification {
  domain: string;
  recordName: string;
  recordValue: string;
  status: TenantDomainStatus;
  lastError: string | null;
}

/** FR-4.3: one go-live check. */
export interface GoLiveCheck {
  key: string;
  label: string;
  required: boolean;
  state: GoLiveCheckState;
  detail: string | null;
}

/** FR-2.5: the tombstone of a purged store. */
export interface TenantPurgeRecord {
  tenantId: string;
  slug: string;
  domain: string | null;
  name: string;
  deletedAt: string;
  purgedAt: string;
  reason: string | null;
}

export interface PlatformList<T> {
  items: T[];
  totalCount: number;
}

/** PRD-024 FR-3.5: rows per status under every filter except status. */
export interface PlatformStatusCount {
  status: string;
  count: number;
}

/**
 * `createTenant` / `retryTenantProvisioning`. Since PRD-014 (PLT-07) the
 * owner gets a set-password email and `ownerTemporaryPassword` is null.
 */
export interface CreateTenantResult {
  tenant: PlatformTenant;
  ownerTemporaryPassword: string | null;
  ownerInviteSent: boolean;
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
  /** `configured` and `checkoutAvailable` are always sent by the server; optional because this type is also the update input. */
  billing: {
    provider: "MANUAL" | "NIMBBL" | "RAZORPAY" | "STRIPE";
    configured?: boolean;
    checkoutAvailable?: boolean;
    /** PRD-017 FR-3.2: shown on the store's Billing page; null or "" clears it. */
    bankTransferInstructions?: string | null;
    supportContact?: string | null;
  };
  reminders: {
    daysBeforeDue: number[];
    daysAfterDue: number[];
    channels: { email: boolean; sms: boolean; whatsapp: boolean };
    template: string;
  };
  yearKind: "CALENDAR" | "FINANCIAL";
  /** PRD-016 FR-16; `enabled` stays false until its gate (D6/D7). Read-only in the full update. */
  dunning?: PlatformDunningSettings;
  /** PRD-016 FR-14. */
  entitlementsMode?: EntitlementsMode;
}

export interface PlatformDunningSettings {
  enabled: boolean;
  pauseOrdersAfterDays: number;
  suspendAfterDays: number;
  trialSuspendAfterDays: number;
}

/**
 * A partial `updatePlatformSettings` input: the server merges what is sent
 * (dunning and the entitlement mode are saved on their own, audited).
 */
export interface PlatformSettingsPatch {
  dunning?: Partial<PlatformDunningSettings>;
  entitlementsMode?: EntitlementsMode;
  /** Why this change; kept on the audit row only (max 500). */
  note?: string;
}

// ─── Stale store payments (PRD-018 FR-1.8) ───────────────────────────────

/** A store payment still PENDING 48 h after it was opened; no shopper field. */
export interface StalePendingPayment {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantStatus: string;
  paymentId: string;
  orderId: string | null;
  provider: string | null;
  amount: number;
  currency: string | null;
  createdAt: string;
  lastEnquiryAt: string | null;
}

export interface StalePendingPaymentList {
  items: StalePendingPayment[];
  /** A store DB couldn't be read; its rows are missing. */
  partial: boolean;
}

// ─── Billing (Phase 3) ────────────────────────────────────────────────────

export type PlatformInvoiceStatus = "ISSUED" | "PAID" | "OVERDUE" | "VOID" | "REFUNDED";

export interface PlatformInvoice {
  id: string;
  tenantId: string;
  tenantName: string;
  subscriptionId: string;
  number: string;
  /** Schema `String!` (FE-23): a plan name, not guaranteed to be a known enum value. */
  planName: string;
  /** Schema `String!` (FE-23). */
  billingCycle: string;
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
  // ── PRD-016 §5.4, FR-5, FR-20, FR-27 ──
  billingReason: "PERIOD" | "PRORATION";
  amountPaid: number;
  creditApplied: number;
  /** Still owed; 0 unless ISSUED or OVERDUE. */
  amountDue: number;
  /** The new period of a stopped store (FR-27). */
  restart: boolean;
  /** PRD-024 FR-3.8: oldest first; only the detail read selects it. */
  statusHistory?: PlatformInvoiceStatusChange[];
  /** PRD-024 FR-3.8: linked payment rows, newest first; only the detail read selects it. */
  payments?: PlatformPayment[];
}

export interface PlatformInvoiceStatusChange {
  status: PlatformInvoiceStatus;
  at: string;
  /** A platform user's email, or "system". */
  actor: string;
}

export interface PlatformInvoiceFilter {
  tenantId?: string | null;
  status?: PlatformInvoiceStatus[] | null;
  search?: string | null;
  dueFrom?: string | null;
  dueTo?: string | null;
}

export type PlatformPaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";

export interface PlatformPayment {
  id: string;
  tenantId: string;
  tenantName: string;
  amount: number;
  currency: string;
  /** Schema `String!`; the platform only writes these four (FE-23). */
  provider: "NIMBBL" | "RAZORPAY" | "STRIPE" | "MANUAL";
  type: string;
  status: PlatformPaymentStatus;
  /** Schema `String` (FE-23). */
  planName: string | null;
  transactionId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string | null;
  // ── PRD-016 FR-19 (optional for older cached rows) ──
  /** AMOUNT_MISMATCH, SUBSCRIPTION_NOT_PAYABLE, INVOICE_NOT_OPEN, or a provider failure. */
  failureReason?: string | null;
  invoiceId?: string | null;
  expectedAmount?: number | null;
  flagged?: boolean;
  /** APPLIED | REFUNDED_OUTSIDE | DISMISSED. */
  resolution?: string | null;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
}

/** PRD-016 FR-5: credit Zerror owes a store; spent by its next invoices. */
export interface PlatformCredit {
  id: string;
  tenantId: string;
  number: string;
  amount: number;
  remaining: number;
  /** PRORATION | OVERPAYMENT | MANUAL. */
  reason: string;
  note: string | null;
  sourceInvoiceId: string | null;
  createdBy: string;
  createdAt: string;
}

export interface PlatformCoupon {
  id: string;
  code: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  appliesTo: string;
  /** PRD-016 FR-22: plan versions by id; wins over `appliesTo` when set. */
  appliesToPlanIds?: string[];
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
  /** PRD-016 FR-22 / PRD-017 FR-4.4: `[]` clears the list (the tier applies). */
  appliesToPlanIds?: string[];
  maxRedemptions: number;
  expiresAt: string;
  active?: boolean;
}

/** `updatePlatformCoupon` input: every field optional (PRD-014 PLT-13). */
export type PlatformCouponUpdateInput = Partial<PlatformCouponInput>;

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
    /** PRD-024 FR-2.2: ACTIVE subscriptions only. */
    monthlyBilling: number;
    /** PRD-024 FR-2.2: monthly price of TRIAL subscriptions (not billed yet). */
    trialPipeline: number;
    /** PRD-024 FR-2.2: monthly price of PAST_DUE subscriptions. */
    atRiskMrr: number;
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
  /** PRD-024 FR-3.3: net revenue in the chosen window (the name is kept). */
  revenue30d: number;
  /** PRD-024 FR-2.1: null when the window before sold nothing. */
  growthPercent: number | null;
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
    /** PRD-024 FR-2.6: stores with GA4 sessions in the window (the conversion base). */
    storesWithSessions: number;
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

// ─── ZCOM AI (PRD-021 FR-6, backend guide §9) ─────────────────────────────

export interface PlatformAiUsageRow {
  tenantId: string;
  name: string;
  slug: string;
  planName: string | null;
  aiEnabled: boolean;
  paused: boolean;
  questionsThisWeek: number;
  questionsThisMonth: number;
  questionsPerWeek: number;
  /** 0–100 of this week's limit (0 when the plan has none). */
  percentOfLimit: number;
  tokensThisMonth: number;
  costUsdThisMonth: number;
  costInrThisMonth: number;
  /** 0–1. */
  cacheHitRate: number;
}

export interface PlatformAiUsageList {
  items: PlatformAiUsageRow[];
  totalCount: number;
}

export interface PlatformAiTopQuestion {
  excerpt: string;
  count: number;
  lastAskedAt: string;
}

export interface PlatformAiModelMix {
  model: string;
  calls: number;
  costUsd: number;
}

export interface PlatformAiTotals {
  spendTodayUsd: number;
  dailyCapUsd: number;
  dailyCapReached: boolean;
  spendMonthUsd: number;
  spendMonthInr: number;
  monthlyBudgetUsd: number;
  /** 0–100. */
  budgetUsedPercent: number;
  /** Thresholds already passed, as whole percentages (e.g. [50, 80]). */
  alertsCrossed: number[];
  chatCalls: number;
  /** PRD-024 FR-2.8: answered questions (cached answers included), as on Usage. */
  answeredQuestions: number;
  /** PRD-024 FR-2.8: answered from the answer cache. */
  cachedAnswers: number;
  avgCostPerQuestionUsd: number;
  /** 0–1. */
  cacheHitRate: number;
  refusals: number;
  failures: number;
  modelMix: PlatformAiModelMix[];
}

export interface PlatformAiModelPrice {
  model: string;
  inputPerMTok: number;
  outputPerMTok: number;
  cacheWritePerMTok: number;
  cacheReadPerMTok: number;
  /** 0–1 multiplier for Message Batches. */
  batchDiscount: number;
}

export interface PlatformAiConfig {
  enabled: boolean;
  defaultModel: string;
  reasoningModel: string;
  allowedModels: string[];
  pricing: PlatformAiModelPrice[];
  globalDailySpendCapUsd: number;
  monthlyBudgetUsd: number;
  /** Fractions of the monthly budget, 0–1. */
  alertThresholds: number[];
  usdInrRate: number;
  /** "HH:mm" in each store's own time zone. */
  nightCoolingStart: string;
  nightCoolingEnd: string;
  perQuestionTokenCeiling: number;
  rateLimitPerMinute: number;
  benchmarkMinStores: number;
}

/** Only the fields that change (the server keeps the rest). */
export type PlatformAiConfigInput = Partial<PlatformAiConfig>;

/** Per-store overrides; null = the plan's value. */
export interface PlatformAiTenantSetting {
  tenantId: string;
  paused: boolean;
  pausedReason: string | null;
  questionsPerWeek: number | null;
  /** -1 = fair use. */
  connectorCallsPerWeek: number | null;
  monthlyTokenBudget: number | null;
}

/**
 * Sent whole every time: the server treats an omitted field like null
 * (back to the plan), so a partial input would clear the others.
 */
export interface PlatformAiOverrideInput {
  questionsPerWeek: number | null;
  connectorCallsPerWeek: number | null;
  monthlyTokenBudget: number | null;
}

export interface PlatformAiTopUpGrant {
  id: string;
  tenantId: string;
  questions: number;
  expiresAt: string;
}

export type PlatformAiTopUpRequestStatus = "OPEN" | "GRANTED" | "DISMISSED";

export interface PlatformAiTopUpRequest {
  id: string;
  tenantId: string;
  storeName: string;
  /** The store's week, "yyyy-MM-dd" of its Monday. */
  week: string;
  status: PlatformAiTopUpRequestStatus;
  createdAt: string | null;
  handledAt: string | null;
}

export interface PlatformAiTopUpRequestList {
  items: PlatformAiTopUpRequest[];
  totalCount: number;
}

export interface PlatformAiDataHealthRow {
  tenantId: string;
  storeName: string;
  slug: string | null;
  computedAt: string;
  costCoveragePct: number;
  settingsFilled: boolean;
  spendMonths: number;
  computeStatus: string;
  computeMs: number;
  canSeeProfitability: boolean;
}

export interface PlatformAiDataHealthList {
  items: PlatformAiDataHealthRow[];
  totalCount: number;
}

export type PlatformAiBenchmarkPeriod = "LAST_30D" | "ALL_TIME";

export interface PlatformAiBenchmark {
  period: string;
  metricKey: string;
  category: string;
  unit: string;
  stores: number;
  p25: number;
  median: number;
  p75: number;
  computedFor: string;
}

// ─── PRD-024 Phase C reads ────────────────────────────────────────────────

export interface PlatformMrrPlanRow {
  /** Plan tier name. */
  plan: string;
  mrr: number;
  stores: number;
}

/** One recorded day (FR-3.1); movements are null on the first recorded day. */
export interface PlatformMrrDay {
  /** YYYY-MM-DD. */
  date: string;
  mrr: number;
  payingStores: number;
  newMrr: number | null;
  expansionMrr: number | null;
  contractionMrr: number | null;
  churnedMrr: number | null;
  byPlan: PlatformMrrPlanRow[];
}

export interface PlatformStoreSalesRow {
  tenantId: string;
  slug: string;
  name: string;
  currency: string;
  revenue: number;
  orders: number;
  previousRevenue: number;
  previousOrders: number;
  /** null when the previous window sold nothing. */
  growthPercent: number | null;
  averageOrderValue: number | null;
}

/** Per currency; stores in different currencies are never added together. */
export interface PlatformStoreSalesTotal {
  currency: string;
  revenue: number;
  orders: number;
  previousRevenue: number;
  previousOrders: number;
  growthPercent: number | null;
  stores: number;
}

export interface PlatformStoreSales {
  rangeStart: string;
  rangeEnd: string;
  previousStart: string;
  previousEnd: string;
  totals: PlatformStoreSalesTotal[];
  /** Highest revenue first; one page. */
  stores: PlatformStoreSalesRow[];
  totalCount: number;
}

/** PRD-024 FR-4.2.3 adds FAILED and the two NOT_SENT_* results. */
export type PlatformReminderResult =
  | "SENT"
  | "QUEUED"
  | "FAILED"
  | "NOT_SENT_NO_PHONE"
  | "NOT_SENT_NOT_CONFIGURED"
  | "NOT_SENT_NO_CHANNEL";

export interface PlatformReminderLogEntry {
  id: string;
  tenantId: string;
  tenantName: string;
  channel: "EMAIL" | "SMS" | "WHATSAPP";
  recipient: string;
  subject: string;
  /** Negative = days before the due date. */
  offsetDays: number;
  dueDay: string;
  /** "job", or the platform user id who sent it. */
  requestedBy: string;
  createdAt: string | null;
  sentAt: string | null;
  /** Schema `String!`: one of the results above, or a newer one. */
  result: PlatformReminderResult | string;
}

export interface PlatformJobRun {
  id: string;
  job: string;
  day: string;
  /** RUNNING | DONE | DONE_WITH_ERRORS | FAILED */
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  /** The job's summary counts, as JSON. */
  summary: string | null;
  error: string | null;
}

// ─── Notifications (PRD-024 FR-4.1) ───────────────────────────────────────

/** The console's three notification tabs. */
export const platformNotificationCategoryEnum = {
  PAYMENTS: "PAYMENTS",
  STORES: "STORES",
  HEALTH: "HEALTH",
} as const;

export type PlatformNotificationCategory =
  (typeof platformNotificationCategoryEnum)[keyof typeof platformNotificationCategoryEnum];

export const platformNotificationSeverityEnum = {
  INFO: "INFO",
  WARNING: "WARNING",
  CRITICAL: "CRITICAL",
} as const;

export type PlatformNotificationSeverity =
  (typeof platformNotificationSeverityEnum)[keyof typeof platformNotificationSeverityEnum];

export interface PlatformNotification {
  id: string;
  /** The source, e.g. `invoice.overdue` or `job.failed`. */
  kind: string;
  category: PlatformNotificationCategory;
  severity: PlatformNotificationSeverity | string;
  title: string;
  body: string | null;
  tenantId: string | null;
  tenantName: string | null;
  /** A console route, e.g. `/stores/<id>`. */
  link: string | null;
  createdAt: string;
  /** Read by the signed-in user. */
  read: boolean;
}

export interface PlatformNotificationList {
  items: PlatformNotification[];
  totalCount: number;
  unreadCount: number;
}

// ─── Messaging (PRD-024 FR-4.2.4) ─────────────────────────────────────────

/** Whether the backend has the platform MSG91 names for each channel. */
export interface PlatformMessagingStatus {
  smsConfigured: boolean;
  whatsappConfigured: boolean;
}

// ─── Profile & security (PRD-024 FR-4.3) ──────────────────────────────────

/** One of the signed-in user's own unrevoked sessions. */
export interface PlatformSessionInfo {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  /** The session this browser holds. */
  current: boolean;
}
