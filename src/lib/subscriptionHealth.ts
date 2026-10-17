import {
  subscriptionStatusEnum,
  type Client,
  type PlatformSettings,
  type Subscription,
  type SubscriptionHealthBucket,
} from "../types";
import { formatMoney } from "../components/ui/money";
import { daysBetween, daysUntil } from "./utils";
import { DEFAULT_PLATFORM_SETTINGS } from "./platformSettings";

export interface SubscriptionHealthResult {
  bucket: SubscriptionHealthBucket;
  reason: string;
  daysOverdue: number;
  daysUntilRenewal: number;
  daysSinceActive: number;
  /** PRD-002 SA-2: renewal passed with money due, still inside grace. */
  isOverdueInGrace: boolean;
}

export interface HealthInput {
  client: Client;
  subscription?: Subscription;
  asOf?: Date;
  settings?: Pick<PlatformSettings, "health" | "gracePeriodDays">;
}

/**
 * Subscription-ops health for Reports.
 * Priority: Unhealthy > At risk > Healthy.
 * An unpaid renewal inside the grace period is "At risk" (overdue in grace);
 * past the grace period it is "Unhealthy".
 */
export function evaluateSubscriptionHealth({
  client,
  subscription,
  asOf = new Date(),
  settings = DEFAULT_PLATFORM_SETTINGS,
}: HealthInput): SubscriptionHealthResult {
  const { expiringWithinDays, inactiveAfterDays } = settings.health;
  const gracePeriodDays =
    client.gracePeriodDays ?? settings.gracePeriodDays;

  const daysSinceActive = Math.max(
    0,
    daysBetween(new Date(client.lastActive), asOf),
  );

  const renewalDate = subscription?.renewalDate;
  const daysUntilRenewal = renewalDate ? daysUntil(renewalDate, asOf) : Number.POSITIVE_INFINITY;
  const daysOverdue =
    renewalDate && daysUntilRenewal < 0 ? Math.abs(daysUntilRenewal) : 0;

  const subStatus = subscription?.status;
  const amountDue = subscription?.amountDue ?? 0;

  // --- Unhealthy ---
  if (
    client.status === "suspended" ||
    subStatus === subscriptionStatusEnum.SUSPENDED
  ) {
    return {
      bucket: "unhealthy",
      reason:
        client.status === "suspended"
          ? "Account suspended"
          : "Subscription suspended",
      daysOverdue,
      daysUntilRenewal: Number.isFinite(daysUntilRenewal) ? daysUntilRenewal : 0,
      daysSinceActive,
      isOverdueInGrace: false,
    };
  }

  if (subStatus === subscriptionStatusEnum.CANCELLED) {
    return {
      bucket: "unhealthy",
      reason: "Subscription cancelled",
      daysOverdue,
      daysUntilRenewal: Number.isFinite(daysUntilRenewal) ? daysUntilRenewal : 0,
      daysSinceActive,
      isOverdueInGrace: false,
    };
  }

  if (subStatus === subscriptionStatusEnum.PAST_DUE) {
    return {
      bucket: "unhealthy",
      reason:
        daysOverdue > 0
          ? `Payment overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`
          : "Payment past due",
      daysOverdue,
      daysUntilRenewal: Number.isFinite(daysUntilRenewal) ? daysUntilRenewal : 0,
      daysSinceActive,
      isOverdueInGrace: false,
    };
  }

  if (
    renewalDate &&
    daysUntilRenewal < -gracePeriodDays &&
    amountDue > 0
  ) {
    return {
      bucket: "unhealthy",
      reason: `Payment overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`,
      daysOverdue,
      daysUntilRenewal,
      daysSinceActive,
      isOverdueInGrace: false,
    };
  }

  // --- At risk ---
  // PRD-002 SA-2: -grace <= daysUntilRenewal < 0 with money due.
  if (renewalDate && daysUntilRenewal < 0 && amountDue > 0) {
    return {
      bucket: "at_risk",
      reason: `Overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} · in grace period`,
      daysOverdue,
      daysUntilRenewal,
      daysSinceActive,
      isOverdueInGrace: true,
    };
  }

  // Money due on a renewal that hasn't passed yet (backend has no
  // PENDING subscription status; an unpaid ACTIVE renewal is "pending").
  if (amountDue > 0) {
    return {
      bucket: "at_risk",
      reason: `Payment pending (${formatMoney(amountDue, { whole: true })})`,
      daysOverdue,
      daysUntilRenewal: Number.isFinite(daysUntilRenewal) ? daysUntilRenewal : 0,
      daysSinceActive,
      isOverdueInGrace: false,
    };
  }

  if (
    renewalDate &&
    daysUntilRenewal >= 0 &&
    daysUntilRenewal <= expiringWithinDays
  ) {
    return {
      bucket: "at_risk",
      reason:
        daysUntilRenewal === 0
          ? "Renewal due today"
          : `Renewal in ${daysUntilRenewal} day${daysUntilRenewal === 1 ? "" : "s"}`,
      daysOverdue: 0,
      daysUntilRenewal,
      daysSinceActive,
      isOverdueInGrace: false,
    };
  }

  if (
    (client.status === "active" || client.status === "trial") &&
    daysSinceActive > inactiveAfterDays
  ) {
    return {
      bucket: "at_risk",
      reason: `No activity for ${daysSinceActive} days`,
      daysOverdue,
      daysUntilRenewal: Number.isFinite(daysUntilRenewal) ? daysUntilRenewal : 0,
      daysSinceActive,
      isOverdueInGrace: false,
    };
  }

  // --- Healthy ---
  return {
    bucket: "healthy",
    reason: "Active · payments up to date",
    daysOverdue: 0,
    daysUntilRenewal: Number.isFinite(daysUntilRenewal) ? daysUntilRenewal : 0,
    daysSinceActive,
    isOverdueInGrace: false,
  };
}
