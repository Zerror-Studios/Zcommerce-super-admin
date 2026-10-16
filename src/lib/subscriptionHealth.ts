import type {
  Client,
  PlatformSettings,
  Subscription,
  SubscriptionHealthBucket,
} from "../types";
import { formatMoney } from "../components/ui/money";
import { daysUntil } from "./utils";
import { DEFAULT_PLATFORM_SETTINGS } from "./platformSettings";

export interface SubscriptionHealthResult {
  bucket: SubscriptionHealthBucket;
  reason: string;
  daysOverdue: number;
  daysUntilRenewal: number;
  daysSinceActive: number;
}

export interface HealthInput {
  client: Client;
  subscription?: Subscription;
  asOf?: Date;
  settings?: Pick<PlatformSettings, "health" | "gracePeriodDays">;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Subscription-ops health for Reports.
 * Priority: Unhealthy > At risk > Healthy.
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
    Math.floor(
      (startOfDay(asOf).getTime() - startOfDay(new Date(client.lastActive)).getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );

  const renewalDate = subscription?.renewalDate;
  const daysUntilRenewal = renewalDate ? daysUntil(renewalDate, asOf) : Number.POSITIVE_INFINITY;
  const daysOverdue =
    renewalDate && daysUntilRenewal < 0 ? Math.abs(daysUntilRenewal) : 0;

  const subStatus = subscription?.status;
  const amountDue = subscription?.amountDue ?? 0;

  // --- Unhealthy ---
  if (client.status === "suspended") {
    return {
      bucket: "unhealthy",
      reason: "Account suspended",
      daysOverdue,
      daysUntilRenewal: Number.isFinite(daysUntilRenewal) ? daysUntilRenewal : 0,
      daysSinceActive,
    };
  }

  if (subStatus === "canceled") {
    return {
      bucket: "unhealthy",
      reason: "Subscription cancelled",
      daysOverdue,
      daysUntilRenewal: Number.isFinite(daysUntilRenewal) ? daysUntilRenewal : 0,
      daysSinceActive,
    };
  }

  if (subStatus === "past_due") {
    return {
      bucket: "unhealthy",
      reason:
        daysOverdue > 0
          ? `Payment overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`
          : "Payment past due",
      daysOverdue,
      daysUntilRenewal: Number.isFinite(daysUntilRenewal) ? daysUntilRenewal : 0,
      daysSinceActive,
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
    };
  }

  // --- At risk ---
  if (subStatus === "pending") {
    return {
      bucket: "at_risk",
      reason:
        amountDue > 0
          ? `Payment pending (${formatMoney(amountDue, { whole: true })})`
          : "Payment pending",
      daysOverdue,
      daysUntilRenewal: Number.isFinite(daysUntilRenewal) ? daysUntilRenewal : 0,
      daysSinceActive,
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
    };
  }

  // --- Healthy ---
  return {
    bucket: "healthy",
    reason: "Active · payments up to date",
    daysOverdue: 0,
    daysUntilRenewal: Number.isFinite(daysUntilRenewal) ? daysUntilRenewal : 0,
    daysSinceActive,
  };
}
