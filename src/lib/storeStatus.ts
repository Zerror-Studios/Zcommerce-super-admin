/**
 * One status per store (docs/design/04-super-admin.md §2 "Store lifecycle"): the lifecycle badge and the
 * payment badge are shown as two separate columns. Never "Active" next to "Expired".
 * The payment badge is computed by the server (PRD-005 FR-3.6, one rule everywhere); this file only
 * maps it onto the kit's tones.
 */
import type { Tone } from "../components/ui/tones";
import type { Client, Subscription } from "../types";

export interface StatusBadge {
  label: string;
  tone: Tone;
  /** Second line under the badge ("Suspends on 20 Oct"). */
  detail?: string;
}

/** Store lifecycle. The data has active / trial / suspended; Building and Cancelled don't exist yet. */
export function storeLifecycle(client: Client): StatusBadge {
  // PRD-018 FR-2.3: a deleted store (in its grace period) is only reachable by link.
  if (client.tenantStatus === "DELETED") return { label: "Deleted", tone: "neutral" };
  switch (client.status) {
    case "active":
      return { label: "Live", tone: "success" };
    case "trial":
      return { label: "Trial", tone: "info" };
    case "suspended":
      return { label: "Suspended", tone: "danger" };
    default:
      return { label: "Unknown", tone: "neutral" };
  }
}

/**
 * This month's payment state: Paid · 3 Oct / Due 20 Oct / Overdue · 12 days (+ "Suspends on …" from the
 * grace period) / Trial / Cancelled, as the server judged it for this subscription.
 */
export function paymentState(subscription: Subscription | undefined): StatusBadge {
  if (!subscription) return { label: "No plan", tone: "neutral" };
  if (subscription.paymentState) {
    const { label, tone, detail } = subscription.paymentState;
    return { label, tone, detail: detail ?? undefined };
  }
  // A subscription row the server has not judged yet (never expected from the API).
  return { label: "Unknown", tone: "neutral" };
}

/** Grace days for a store: its own override, else the platform default (Settings › Billing rules). */
export function graceDaysFor(client: Client, platformDefault: number): number {
  return client.gracePeriodDays ?? platformDefault;
}
