/**
 * Sample AI copy for the `ai` feature flag (docs/design/04-super-admin.md §3.1, §3.4). No model is called: the brief
 * and insights are written from the same data the page shows (lib/metrics, lib/storeStatus, lib/storeHealth),
 * so they're never wrong about the numbers. Replace with real calls when the assistant backend exists.
 */
import type { AiAnswer } from "../components/layout";
import { formatMoney } from "../components/ui/money";
import type { Client, Subscription, Transaction } from "../types";
import { earnedIn, monthPeriod, storesPaidIn } from "./metrics";
import { getStoreHealth } from "./storeHealth";
import { graceDaysFor, paymentState } from "./storeStatus";
import { buildPaymentReportRows } from "./subscriptionReports";

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

// ─── Assistant (Ask bar, ⌘J, "Ask AI" in ⌘K) ────────────────────────────────

export interface AssistantData {
  clients: Client[];
  subscriptions: Subscription[];
  transactions: Transaction[];
  platformGraceDays: number;
  now: Date;
}

export const ASSISTANT_SUGGESTIONS = ["How much did we earn this month?", "Which stores are overdue?", "Which stores need attention?"];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Sample assistant reply, worked out from the same data the pages show. Marked `sample` until a model is connected. */
export async function sampleAssistantAnswer(question: string, data: AssistantData): Promise<AiAnswer> {
  await wait(1000);
  const { clients, subscriptions, transactions, platformGraceDays, now } = data;
  const q = question.toLowerCase();

  if (/overdue|unpaid|\bdue\b|grace|suspend|payment/.test(q)) {
    // Same open invoices as Billing › Collections and the Outstanding KPI, so the numbers always agree.
    const open = buildPaymentReportRows({ clients, subscriptions, transactions, asOf: now }).filter(
      (row) => row.status === "pending" || row.status === "overdue",
    );
    if (!open.length) return { text: "No store has a payment due or overdue right now.", used: "Used: subscriptions, payments", sample: true };
    const byStore = new Map<string, { name: string; amount: number; overdue: boolean }>();
    for (const row of open) {
      const entry = byStore.get(row.clientId) ?? { name: row.shopName, amount: 0, overdue: false };
      entry.amount += row.amount;
      entry.overdue ||= row.status === "overdue";
      byStore.set(row.clientId, entry);
    }
    const stores = [...byStore.entries()].sort((a, b) => Number(b[1].overdue) - Number(a[1].overdue) || b[1].amount - a[1].amount);
    const total = open.reduce((sum, row) => sum + row.amount, 0);
    const overdueCount = stores.filter(([, store]) => store.overdue).length;
    return {
      text: `${stores.length} ${stores.length === 1 ? "store has" : "stores have"} ${formatMoney(total, { whole: true })} outstanding; ${overdueCount} ${overdueCount === 1 ? "is" : "are"} overdue.`,
      card: {
        title: "Payments due or overdue",
        rows: stores.slice(0, 5).map(([clientId, store]) => {
          const client = clients.find((c) => c.id === clientId);
          const sub = subscriptions.find((sb) => sb.clientId === clientId);
          const state = client ? paymentState(sub, transactions, graceDaysFor(client, platformGraceDays), now) : null;
          const detail = store.overdue && state?.tone === "danger" ? state.label.replace("Overdue · ", "Overdue ") : store.overdue ? "Overdue" : "Due";
          return {
            label: store.name,
            value: `${formatMoney(store.amount, { whole: true })} · ${detail}`,
            tone: store.overdue ? ("danger" as const) : undefined,
          };
        }),
      },
      actions: [
        { label: "Open collections", href: "/billing/subscriptions", primary: true },
        { label: "Payment reminders", href: "/billing/reminders" },
      ],
      used: "Used: subscriptions, payments",
      sample: true,
    };
  }

  if (/earn|revenue|income|collect|money|month/.test(q)) {
    const period = monthPeriod(now);
    const earned = earnedIn(transactions, period);
    const paid = storesPaidIn(transactions, period);
    return {
      text: `${formatMoney(earned, { whole: true })} earned this month from ${paid} ${paid === 1 ? "store" : "stores"}.`,
      actions: [{ label: "Open platform revenue", href: "/analytics/revenue", primary: true }],
      used: "Used: payments · this month",
      sample: true,
    };
  }

  if (/health|attention|risk|critical|check|falling|drop/.test(q)) {
    const rows = clients
      .filter((client) => client.status !== "suspended")
      .map((client) => ({ client, health: getStoreHealth(client, subscriptions.find((s) => s.clientId === client.id)) }))
      .filter(({ client, health }) => health.score < 50 || client.growthPercent <= -20)
      .sort((a, b) => a.health.score - b.health.score);
    if (!rows.length) return { text: "Every store looks healthy right now.", used: "Used: store health", sample: true };
    return {
      text: `${rows.length} ${rows.length === 1 ? "store needs" : "stores need"} a look: critical health or sales down 20% or more.`,
      card: {
        title: "Stores to check",
        rows: rows.slice(0, 5).map(({ client, health }) => ({
          label: client.storeName,
          value: client.growthPercent <= -20 ? `Health ${health.score} · sales ${Math.round(client.growthPercent)}%` : `Health ${health.score}`,
          tone: health.score < 50 ? ("danger" as const) : undefined,
        })),
      },
      actions: [{ label: "Open stores", href: "/stores", primary: true }],
      used: "Used: store health, store sales · 30d",
      sample: true,
    };
  }

  if (/store|client|how many/.test(q)) {
    const active = clients.filter((client) => client.status === "active").length;
    return {
      text: `${clients.length} stores on the platform, ${active} active.`,
      actions: [{ label: "Open stores", href: "/stores", primary: true }],
      used: "Used: stores",
      sample: true,
    };
  }

  return {
    text: "I can answer about earnings, overdue payments, store health and stores. Try one of those.",
    sample: true,
  };
}
