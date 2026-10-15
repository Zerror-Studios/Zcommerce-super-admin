import { daysUntil } from "../../lib/utils";
import type { Subscription } from "../../types";
import { PlanExpiryBadge } from "../ui/PlanExpiryBadge";
import type { StatusInfo } from "../ui/status-map";

export interface RenewalBadgeProps {
  subscription?: Subscription;
}

/**
 * Plan renewal / expiry for a subscription (component-specs §21).
 * Overdue and ended states come from the subscription status (data), so they are passed as an override;
 * everything else uses the shared expiry thresholds.
 */
export function RenewalBadge({ subscription }: RenewalBadgeProps) {
  if (!subscription) return <span className="text-fg-muted">—</span>;

  let override: StatusInfo | undefined;
  if (subscription.status === "past_due") {
    override = { label: `Overdue by ${Math.abs(daysUntil(subscription.renewalDate))}d`, tone: "danger" };
  } else if (subscription.status === "canceled") {
    override = { label: "Ended", tone: "neutral" };
  }

  return <PlanExpiryBadge expiresAt={subscription.renewalDate} override={override} />;
}
