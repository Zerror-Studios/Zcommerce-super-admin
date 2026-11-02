/**
 * Sample AI copy for the `ai` feature flag (docs/design/04-super-admin.md §3.1, §3.4). No model is called: the brief
 * and insights are written from the same server data the page shows (payment badge, health score, usage
 * snapshot), so they're never wrong about the numbers. The Ask bar's sample answers were removed when the staff
 * chat was wired to the platform API (backend PRD-026 FR-7.2).
 */
import type { Client, Subscription } from "../types";
import { getStoreHealth } from "./storeHealth";
import { latestSubscriptionByClient } from "./subscription-lookup.util";
import { paymentState } from "./storeStatus";

function names(list: string[]): string {
  if (list.length <= 2) return list.join(" and ");
  return `${list.slice(0, 2).join(", ")} and ${list.length - 2} more`;
}

export interface PlatformBrief {
  /** At most three "what to do — why" lines, most urgent first (08 §2.1). */
  lines: { what: string; why: string }[];
  /** First is the blue action. */
  actions: { label: string; href: string }[];
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Today's brief on Home, operations-style: stores past their grace period, overdue payments still in grace,
 * payments due soon, then stores with critical health. Null when all is well. Reads the server's payment badge
 * and health score only.
 */
export function platformBrief(input: { clients: Client[]; subscriptions: Subscription[] }): PlatformBrief | null {
  const { clients, subscriptions } = input;
  const byClient = latestSubscriptionByClient(subscriptions);
  const pastGrace: string[] = [];
  const overdue: string[] = [];
  const due: string[] = [];
  const critical: string[] = [];
  for (const client of clients) {
    if (client.status === "suspended") continue;
    const state = paymentState(byClient.get(client.id));
    if (state.detail === "Past grace period") pastGrace.push(client.storeName);
    else if (state.tone === "danger") overdue.push(client.storeName);
    else if (state.tone === "warning") due.push(client.storeName);
    if (getStoreHealth(client).score < 50) critical.push(client.storeName);
  }

  const lines: PlatformBrief["lines"] = [];
  if (pastGrace.length) {
    lines.push({
      what: `Decide on ${count(pastGrace.length, "store", "stores")} past the grace period`,
      why: `${names(pastGrace)} ${pastGrace.length === 1 ? "is" : "are"} due for suspension`,
    });
  }
  if (overdue.length) {
    lines.push({
      what: `Chase ${count(overdue.length, "overdue payment", "overdue payments")}`,
      why: `${names(overdue)} ${overdue.length === 1 ? "is" : "are"} still inside the grace period`,
    });
  }
  if (due.length) {
    lines.push({
      what: `Send reminders for ${count(due.length, "payment", "payments")} due soon`,
      why: names(due),
    });
  }
  if (critical.length) {
    lines.push({
      what: `Check in with ${count(critical.length, "store", "stores")} with critical health`,
      why: `${names(critical)} scored below 50`,
    });
  }
  if (!lines.length) return null;

  const actions: PlatformBrief["actions"] = [];
  if (pastGrace.length || overdue.length) actions.push({ label: "Review overdue stores", href: "/stores?tab=overdue" });
  if (due.length) actions.push({ label: "Due & overdue", href: "/subscriptions?tab=due" });
  actions.push({ label: "View stores", href: "/stores" });
  return { lines: lines.slice(0, 3), actions: actions.slice(0, 3) };
}

/** One insight for a store's Overview, or null. */
export function storeInsight(
  client: Client,
  subscription: Subscription | undefined,
): { title: string; body: string } | null {
  const state = paymentState(subscription);
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
  const health = getStoreHealth(client);
  if (health.score < 50) {
    return {
      title: "Store health is critical",
      body: `Health is ${health.score}. Main factors: ${health.factors.slice(0, 3).join(", ").toLowerCase()}.`,
    };
  }
  // PRD-024 FR-2.1: null growth (no previous sales) is no comparison, never a fall.
  const growth = client.growthPercent ?? 0;
  if (growth <= -20) {
    return {
      title: "Sales are falling",
      body: `Store sales are down ${Math.abs(Math.round(growth))}% on the previous 30 days.`,
    };
  }
  return null;
}
