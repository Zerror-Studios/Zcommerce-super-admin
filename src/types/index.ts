// PRD-002 SA-7: plan, subscription-status and gateway values mirror the
// backend enums (plan.model.ts, subscription.model.ts, billing.model.ts).
// Human-readable strings live in lib/display-labels.util.ts.
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
  growthPercent: number;
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
  /** Server-computed payment badge; `lib/storeStatus` shows it. */
  paymentState?: { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral"; detail: string | null };
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
}

export interface Coupon {
  id: string;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  appliesTo: PlanName | "All";
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
  billing?: { provider: PlatformPaymentProvider; configured: boolean; checkoutAvailable: boolean };
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
}
