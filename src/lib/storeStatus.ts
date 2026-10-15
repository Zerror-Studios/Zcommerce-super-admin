/**
 * One status per store (docs/design/04-super-admin.md §2 "Store lifecycle"): the lifecycle badge and the
 * payment badge are derived here and shown as two separate columns. Never "Active" next to "Expired".
 */
import type { Tone } from "../components/ui/tones";
import type { Client, Subscription, Transaction } from "../types";

export interface StatusBadge {
  label: string;
  tone: Tone;
  /** Second line under the badge ("Suspends on 20 Oct"). */
  detail?: string;
}

const DAY = 24 * 60 * 60 * 1000;
const dayMonth = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Store lifecycle. The data has active / trial / suspended; Building and Cancelled don't exist yet. */
export function storeLifecycle(client: Client): StatusBadge {
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
 * This month's payment state from the store's subscription:
 * Paid · 3 Oct / Due 20 Oct / Overdue · 12 days (+ "Suspends on …" from the grace period) / Trial / Cancelled.
 */
export function paymentState(
  subscription: Subscription | undefined,
  transactions: Transaction[],
  graceDays: number,
  now: Date = new Date(),
): StatusBadge {
  if (!subscription) return { label: "No plan", tone: "neutral" };
  const due = new Date(subscription.renewalDate);
  const daysPast = Math.round((startOfDay(now) - startOfDay(due)) / DAY);

  if (subscription.status === "canceled") return { label: "Cancelled", tone: "neutral" };
  if (subscription.status === "trialing") return { label: "Trial", tone: "info" };

  const unpaid = subscription.status === "past_due" || subscription.status === "pending";
  if (unpaid && daysPast > 0) {
    const suspends = new Date(startOfDay(due) + graceDays * DAY);
    return {
      label: `Overdue · ${daysPast} ${daysPast === 1 ? "day" : "days"}`,
      tone: "danger",
      detail: daysPast > graceDays ? "Past grace period" : `Suspends on ${dayMonth.format(suspends)}`,
    };
  }
  if (unpaid) return { label: `Due ${dayMonth.format(due)}`, tone: "warning" };

  const lastPaid = transactions
    .filter((txn) => txn.clientId === subscription.clientId && txn.status === "success")
    .map((txn) => new Date(txn.date))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  return { label: lastPaid ? `Paid · ${dayMonth.format(lastPaid)}` : "Paid", tone: "success" };
}

/** Grace days for a store: its own override, else the platform default (Settings › Billing rules). */
export function graceDaysFor(client: Client, platformDefault: number): number {
  return client.gracePeriodDays ?? platformDefault;
}
