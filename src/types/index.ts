// PRD-002 SA-7: plan, subscription-status and gateway values mirror the
// backend enums (plan.model.ts, subscription.model.ts, billing.model.ts).
// Human-readable strings live in lib/display-labels.util.ts.
import type { TenantDomainStatus, TenantSuspendCategory } from "./platform-api";

export const planNameEnum = {
  STARTER: "STARTER",
  PREMIUM: "PREMIUM",
  PLUS: "PLUS",
  ENTERPRISE: "ENTERPRISE",
} as const;

export type PlanName = (typeof planNameEnum)[keyof typeof planNameEnum];

export type ClientStatus = "active" | "trial" | "suspended";

export type UserRole =
  | "Super Admin"
  | "Support Agent"
  | "Billing Manager"
  | "Read-only";

export type UserStatus = "active" | "invited" | "disabled";

export type TransactionStatus = "success" | "failed" | "refunded" | "pending";

export const paymentGatewayEnum = {
  NIMBBL: "NIMBBL",
  RAZORPAY: "RAZORPAY",
  STRIPE: "STRIPE",
  MANUAL: "MANUAL",
} as const;

export type PlatformPaymentProvider = "MANUAL" | "NIMBBL" | "RAZORPAY" | "STRIPE";

export type PaymentGateway =
  (typeof paymentGatewayEnum)[keyof typeof paymentGatewayEnum];

export const subscriptionStatusEnum = {
  ACTIVE: "ACTIVE",
  TRIAL: "TRIAL",
  PAST_DUE: "PAST_DUE",
  CANCELLED: "CANCELLED",
  SUSPENDED: "SUSPENDED",
} as const;

export type SubscriptionStatus =
  (typeof subscriptionStatusEnum)[keyof typeof subscriptionStatusEnum];

export type SubscriptionHealthBucket = "healthy" | "at_risk" | "unhealthy";

export interface Plan {
  id: string;
  name: PlanName;
  priceMonthly: number;
  features: string[];
  clientCount: number;
  /** `null` = the plan sets no limit (or the backend plan has no such field). */
  limits: {
    products: number | null;
    storageGb: number | null;
    bandwidthGb: number | null;
  };
  // ── PRD-017 FR-1.1 ──
  priceYearly?: number;
  version?: number;
  status?: "DRAFT" | "ACTIVE" | "LEGACY" | "ARCHIVED";
  displayName?: string;
  /** Set for a custom plan that belongs to one store. */
  tenantId?: string | null;
}

export interface Client {
  id: string;
  storeName: string;
  ownerName: string;
  ownerEmail: string;
  plan: PlanName;
  status: ClientStatus;
  mrr: number;
  orders30d: number;
  /** Net store sales in the last 30 days (PRD-012 FR-8.2). */
  revenue: number;
  /** PRD-024 FR-2.1: change vs the previous 30 days; null when nothing sold then (or no snapshot). */
  growthPercent: number | null;
  /** GA4 traffic in the last 30 days; 0 without an analytics app (PRD-012 FR-8.2). */
  sessions30d: number;
  pageViews30d: number;
  /** Paid orders ÷ sessions, percent, computed by the server. */
  conversionRate30d: number;
  lastActive: string;
  joinedDate: string;
  usage: {
    products: number;
    storageGb: number;
    /** `null` = not measured (no bandwidth metering yet). */
    bandwidthGb: number | null;
  };
  notes: string;
  /** Per-store override; falls back to platform default when unset. */
  gracePeriodDays?: number;
  // ── Server-side fields (PRD-005 Phase 2) ──
  slug?: string;
  domain?: string;
  ownerPhone?: string;
  onboarding?: {
    status: "PROVISIONING" | "READY" | "FAILED";
    error: string | null;
    steps: { key: string; status: "PENDING" | "DONE" | "FAILED"; error: string | null }[];
  };
  /** Server-computed store health; `lib/storeHealth` prefers it when present. */
  health?: { score: number; factors: string[] };
  /** Server-computed payment badge; `lib/storeStatus` prefers it when present. */
  paymentState?: { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral"; detail: string | null };
  // ── Store details (PRD-017 FR-4.5) ──
  billingContactEmail?: string;
  gstin?: string;
  timezone?: string;
  currency?: string;
  // ── Data lifecycle (PRD-018) ──
  /** The server's tenant status; `status` above folds DELETED into the list's states. */
  tenantStatus?: "ACTIVE" | "SUSPENDED" | "DELETED";
  suspendCategory?: TenantSuspendCategory;
  suspendReason?: string;
  suspendedAt?: string;
  /** When a DELETED store may be purged (restore before it). */
  purgeAfter?: string;
  domainStatus?: TenantDomainStatus;
  pendingDomain?: string;
  liveAt?: string;
  // ── PRD-024 FR-1.3, FR-1.7, FR-1.9 ──
  /** The subscription's status; the lifecycle badge reads it with `liveAt`. */
  subscriptionStatus?: SubscriptionStatus;
  /** False when the server has no usage snapshot yet: the usage figures are not measured (show "—"). */
  hasUsage?: boolean;
  /** The snapshot's date ("as of"), when there is one. */
  usageAsOf?: string;
  /** Staff accounts in the latest snapshot; `null` without one. */
  staffCount?: number | null;
  /** PRD-024 FR-3.7: messages sent this month (every channel); `null` until counted. */
  messagesThisMonth?: number | null;
  /** PRD-024 FR-2.7: some snapshot figures were carried from the previous snapshot. */
  usagePartial?: boolean;
  region?: string;
  /** The store's own plan version (id, version, limits), never matched by tier name. */
  planRef?: ClientPlanRef;
}

/** PRD-024 FR-1.3 (D-03): the plan a store is on, by identity. */
export interface ClientPlanRef {
  id: string;
  version: number | null;
  displayName: string | null;
  /** True for a custom plan that belongs to this store. */
  custom: boolean;
  limits: {
    products: number | null;
    staff: number | null;
  };
}

export interface Subscription {
  id: string;
  clientId: string;
  clientName: string;
  plan: PlanName;
  status: SubscriptionStatus;
  renewalDate: string;
  /** Monthly-normalised price (yearly plans ÷ 12); the input to MRR. */
  mrr: number;
  amountDue: number;
  startedAt?: string;
  canceledAt?: string;
  billingCycle?: "MONTHLY" | "YEARLY";
  /** PRD-014 D6: a plan change scheduled for `renewalDate`. */
  pendingPlanId?: string;
  pendingBillingCycle?: "MONTHLY" | "YEARLY";
  // ── PRD-016 (server fields) ──
  /** The plan version's id and number (PRD-017 FR-4.2). */
  planId?: string;
  planVersion?: number;
  planDisplayName?: string;
  /** Unspent platform credit (FR-5). */
  creditBalance?: number;
  /** FR-15: ORDERS_PAUSED = the store takes no new shopper orders. */
  billingState?: "OK" | "ORDERS_PAUSED";
  /** FR-16 dunning dates; absent while dunning is off. */
  ordersPauseAt?: string;
  suspendsAt?: string;
  /** Server-computed payment badge; `lib/storeStatus` shows it. */
  paymentState?: { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral"; detail: string | null };
  /** PRD-024 FR-1.7 (B-05): days past due, from the server (0 when not overdue). */
  daysOverdue?: number;
}

export interface Transaction {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  currency: string;
  gateway: PaymentGateway;
  status: TransactionStatus;
  date: string;
  dueDate?: string;
  transactionId: string;
  /** The plan the payment was for (`PlatformPayment.planName`). */
  planName?: string;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  appliesTo: PlanName | "All";
  /** PRD-017 FR-4.4: plan versions by id; wins over `appliesTo` when not empty. */
  appliesToPlanIds: string[];
  redemptions: number;
  maxRedemptions: number;
  expiresAt: string;
  active: boolean;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLogin: string;
  avatarInitials: string;
}

export interface RevenuePoint {
  month: string;
  revenue: number;
  mrr: number;
}

export interface PlanDistribution {
  name: PlanName;
  value: number;
  color: string;
}

export interface DashboardStats {
  totalRevenue: number;
  totalRevenueChange: number;
  activeClients: number;
  activeClientsChange: number;
  mrr: number;
  mrrChange: number;
  totalOrders: number;
  totalOrdersChange: number;
}

export interface PlatformSettings {
  health: {
    expiringWithinDays: number;
    inactiveAfterDays: number;
  };
  gracePeriodDays: number;
  /** ADR-002 amendment: the platform payment provider is a setting (Razorpay next). */
  /** `checkoutAvailable` (PRD-014 FR-2.4): stores can pay the saved provider online here. */
  billing?: {
    provider: PlatformPaymentProvider;
    configured: boolean;
    checkoutAvailable: boolean;
    /** PRD-017 FR-3.2: shown on the store's Billing page. */
    bankTransferInstructions?: string;
    supportContact?: string;
  };
  reminders: {
    daysBeforeDue: number[];
    daysAfterDue: number[];
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    /** Renewal reminder text with {{ownerName}}, {{storeName}}, {{plan}}, {{renewalDate}}, {{days}}. */
    template?: string;
  };
  yearKind?: "CALENDAR" | "FINANCIAL";
  /** PRD-016 FR-16: read here, saved on its own (never by the full save). */
  dunning?: {
    enabled: boolean;
    pauseOrdersAfterDays: number;
    suspendAfterDays: number;
    trialSuspendAfterDays: number;
  };
  /** PRD-016 FR-14: read here, saved on its own. */
  entitlementsMode?: "OFF" | "LOG" | "ENFORCE";
}
