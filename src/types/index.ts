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

export type NotificationCategory = "All" | "Orders" | "Shipping" | "Analytics" | "Billing";

export interface Plan {
  id: string;
  name: PlanName;
  priceMonthly: number;
  features: string[];
  clientCount: number;
  limits: {
    products: number;
    storageGb: number;
    bandwidthGb: number;
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
  revenue: number;
  growthPercent: number;
  lastActive: string;
  joinedDate: string;
  usage: {
    products: number;
    storageGb: number;
    bandwidthGb: number;
  };
  notes: string;
  /** Per-store override; falls back to platform default when unset. */
  gracePeriodDays?: number;
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

export interface Notification {
  id: string;
  category: Exclude<NotificationCategory, "All">;
  title: string;
  description: string;
  timestamp: string;
  dateGroup: string;
  read: boolean;
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
  reminders: {
    daysBeforeDue: number[];
    daysAfterDue: number[];
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
  };
}
