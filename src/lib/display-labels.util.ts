/**
 * zcom-super-admin — Display labels
 *
 * Types and mock data carry the backend enum values (PRD-002 SA-7):
 * plans `STARTER|PREMIUM|PLUS|ENTERPRISE`, subscription statuses
 * `ACTIVE|TRIAL|PAST_DUE|CANCELLED|SUSPENDED` and gateways
 * `NIMBBL|RAZORPAY|STRIPE|MANUAL`. The UI never renders those raw values;
 * it goes through the label maps below so screens stay human-readable.
 *
 * Usage: `getPlanLabel(client.plan)` → "Premium".
 */
import {
  paymentGatewayEnum,
  planNameEnum,
  subscriptionStatusEnum,
  type PaymentGateway,
  type PlanName,
  type SubscriptionHealthBucket,
  type SubscriptionStatus,
} from "../types";

// ─── Ordered value lists ──────────────────────────────────────────────────

/** Plans in tier order (lowest first). */
export const PLAN_NAMES: PlanName[] = Object.values(planNameEnum);

/** Gateways in display order. */
export const PAYMENT_GATEWAYS: PaymentGateway[] =
  Object.values(paymentGatewayEnum);

/** Subscription statuses in display order. */
export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = Object.values(
  subscriptionStatusEnum,
);

// ─── Label maps ───────────────────────────────────────────────────────────

export const PLAN_LABELS: Record<PlanName, string> = {
  STARTER: "Starter",
  PREMIUM: "Premium",
  PLUS: "Plus",
  ENTERPRISE: "Enterprise",
};

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  ACTIVE: "Active",
  TRIAL: "Trial",
  PAST_DUE: "Past due",
  CANCELLED: "Cancelled",
  SUSPENDED: "Suspended",
};

export const PAYMENT_GATEWAY_LABELS: Record<PaymentGateway, string> = {
  NIMBBL: "Nimbbl",
  RAZORPAY: "Razorpay",
  STRIPE: "Stripe",
  MANUAL: "Manual",
};

export const HEALTH_BUCKET_LABELS: Record<SubscriptionHealthBucket, string> = {
  healthy: "Healthy",
  at_risk: "At risk",
  unhealthy: "Unhealthy",
};

// ─── Lookups ──────────────────────────────────────────────────────────────

function lookupLabel<T extends string>(
  labels: Record<T, string>,
  value: string,
): string {
  return labels[value as T] ?? value;
}

/** Human-readable plan name; unknown values are returned unchanged. */
export function getPlanLabel(plan: string): string {
  return lookupLabel(PLAN_LABELS, plan);
}

/** Human-readable subscription status; unknown values pass through. */
export function getSubscriptionStatusLabel(status: string): string {
  return lookupLabel(SUBSCRIPTION_STATUS_LABELS, status);
}

/** Human-readable gateway name; unknown values (e.g. "—") pass through. */
export function getPaymentGatewayLabel(gateway: string): string {
  return lookupLabel(PAYMENT_GATEWAY_LABELS, gateway);
}
