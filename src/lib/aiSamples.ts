/**
 * Sample AI copy for the `ai` feature flag (docs/design/04-super-admin.md §3.1, §3.4). No model is called: the brief
 * and insights are written from the same data the page shows (lib/metrics, lib/storeStatus, lib/storeHealth),
 * so they're never wrong about the numbers. Replace with real calls when the assistant backend exists.
 */
import type { Client, Subscription, Transaction } from "../types";
import { getStoreHealth } from "./storeHealth";
import { graceDaysFor, paymentState } from "./storeStatus";

function names(list: string[]): string {
  if (list.length <= 2) return list.join(" and ");
  return `${list.slice(0, 2).join(", ")} and ${list.length - 2} more`;
}

/** Today's brief on Home: stores past their grace period, then stores with critical health. Null when all is well. */
export function platformBrief(input: {
  clients: Client[];
  subscriptions: Subscription[];
  transactions: Transaction[];
  platformGraceDays: number;
  now: Date;
}): { message: string; action: { label: string; href: string } } | null {
  const { clients, subscriptions, transactions, platformGraceDays, now } = input;
  const pastGrace: string[] = [];
  const critical: string[] = [];
  for (const client of clients) {
    if (client.status === "suspended") continue;
    const sub = subscriptions.find((s) => s.clientId === client.id);
    const state = paymentState(sub, transactions, graceDaysFor(client, platformGraceDays), now);
    if (state.detail === "Past grace period") pastGrace.push(client.storeName);
    if (getStoreHealth(client, sub).score < 50) critical.push(client.storeName);
  }
  if (pastGrace.length) {
    return {
      message: `${names(pastGrace)} ${pastGrace.length === 1 ? "is" : "are"} past the grace period and due for suspension.${
        critical.length ? ` ${critical.length} ${critical.length === 1 ? "store has" : "stores have"} critical health.` : ""
      }`,
      action: { label: "Review stores", href: "/stores?status=unpaid" },
    };
  }
  if (critical.length) {
    return {
      message: `${names(critical)} ${critical.length === 1 ? "has" : "have"} critical health. Worth a check-in.`,
      action: { label: "Review stores", href: "/stores" },
    };
  }
  return null;
}

/** One insight for a store's Overview, or null. */
export function storeInsight(
  client: Client,
  subscription: Subscription | undefined,
  transactions: Transaction[],
  platformGraceDays: number,
  now: Date,
): { title: string; body: string } | null {
  const state = paymentState(subscription, transactions, graceDaysFor(client, platformGraceDays), now);
  if (state.tone === "danger" && state.label.startsWith("Overdue")) {
    return {
      title: "Payment is overdue",
      body: [
        `${client.storeName} is ${state.label.replace("Overdue · ", "")} overdue.`,
        state.detail ? `${state.detail}.` : null,
        "A reminder now usually avoids a suspension.",
      ]
        .filter(Boolean)
        .join(" "),
    };
  }
  const health = getStoreHealth(client, subscription);
  if (health.score < 50) {
    return {
      title: "Store health is critical",
      body: `Health is ${health.score}. Main factors: ${health.factors.slice(0, 3).join(", ").toLowerCase()}.`,
    };
  }
  if (client.growthPercent <= -20) {
    return {
      title: "Sales are falling",
      body: `Store sales are down ${Math.abs(Math.round(client.growthPercent))}% on the previous 30 days.`,
    };
  }
  return null;
}
