/**
 * Sample AI copy for the `ai` feature flag (docs/design/04-super-admin.md §3.1, §3.4). No model is called: the brief
 * and insights are written from the same server data the page shows (payment badge, health score, usage
 * snapshot), so they're never wrong about the numbers. Replace with real calls when the assistant backend exists.
 */
import type { AiAnswer } from "../components/layout";
import { formatMoney } from "../components/ui/money";
import type { Client, Subscription } from "../types";
import { getStoreHealth } from "./storeHealth";
import { paymentState } from "./storeStatus";

function names(list: string[]): string {
  if (list.length <= 2) return list.join(" and ");
  return `${list.slice(0, 2).join(", ")} and ${list.length - 2} more`;
}

/** Today's brief on Home: stores past their grace period, then stores with critical health. Null when all is well. */
export function platformBrief(input: {
  clients: Client[];
  subscriptions: Subscription[];
}): { message: string; action: { label: string; href: string } } | null {
  const { clients, subscriptions } = input;
  const pastGrace: string[] = [];
  const critical: string[] = [];
  for (const client of clients) {
    if (client.status === "suspended") continue;
    const sub = subscriptions.find((s) => s.clientId === client.id);
    const state = paymentState(sub);
    if (state.detail === "Past grace period") pastGrace.push(client.storeName);
    if (getStoreHealth(client).score < 50) critical.push(client.storeName);
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
  if (client.growthPercent <= -20) {
    return {
      title: "Sales are falling",
      body: `Store sales are down ${Math.abs(Math.round(client.growthPercent))}% on the previous 30 days.`,
    };
  }
  return null;
}

// ─── Assistant (Ask bar, ⌘J, "Ask AI" in ⌘K) ────────────────────────────────

/** This month's money, read from the server rollup when the question needs it. */
export interface MonthSummary {
  earnedMonth: number;
  paidStoresMonth: number;
}

export interface AssistantData {
  clients: Client[];
  subscriptions: Subscription[];
  /** Fetched only for money questions (platformRevenueOverview); never computed here. */
  loadMonthSummary: () => Promise<MonthSummary>;
}

export const ASSISTANT_SUGGESTIONS = ["How much did we earn this month?", "Which stores are overdue?", "Which stores need attention?"];

/**
 * Sample assistant reply, worked out from the same server data the pages show
 * (payment badges, health scores, the revenue rollup). Marked `sample` until a
 * model is connected.
 */
export async function sampleAssistantAnswer(question: string, data: AssistantData): Promise<AiAnswer> {
  const { clients, subscriptions } = data;
  const q = question.toLowerCase();

  if (/overdue|unpaid|\bdue\b|grace|suspend|payment/.test(q)) {
    // The server's payment badge per store: the same one the Stores table shows.
    const open = clients
      .filter((client) => client.status !== "suspended")
      .map((client) => {
        const sub = subscriptions.find((s) => s.clientId === client.id);
        return { client, sub, state: paymentState(sub) };
      })
      .filter(({ state }) => state.tone === "danger" || state.tone === "warning");
    if (!open.length) return { text: "No store has a payment due or overdue right now.", used: "Used: subscriptions, invoices", sample: true };
    const overdue = open.filter(({ state }) => state.tone === "danger");
    const total = open.reduce((sum, { sub }) => sum + (sub?.amountDue ?? 0), 0);
    const sorted = [...overdue, ...open.filter(({ state }) => state.tone !== "danger")];
    return {
      text: `${open.length} ${open.length === 1 ? "store has" : "stores have"} ${formatMoney(total, { whole: true })} outstanding; ${overdue.length} ${overdue.length === 1 ? "is" : "are"} overdue.`,
      card: {
        title: "Payments due or overdue",
        rows: sorted.slice(0, 5).map(({ client, sub, state }) => ({
          label: client.storeName,
          value: `${formatMoney(sub?.amountDue ?? 0, { whole: true })} · ${state.label}`,
          tone: state.tone === "danger" ? ("danger" as const) : undefined,
        })),
      },
      actions: [
        { label: "Open collections", href: "/billing/subscriptions", primary: true },
        { label: "Payment reminders", href: "/billing/reminders" },
      ],
      used: "Used: subscriptions, invoices",
      sample: true,
    };
  }

  if (/earn|revenue|income|collect|money|month/.test(q)) {
    const { earnedMonth, paidStoresMonth } = await data.loadMonthSummary();
    return {
      text: `${formatMoney(earnedMonth, { whole: true })} earned this month from ${paidStoresMonth} ${paidStoresMonth === 1 ? "store" : "stores"}.`,
      actions: [{ label: "Open platform revenue", href: "/analytics/revenue", primary: true }],
      used: "Used: payments · this month",
      sample: true,
    };
  }

  if (/health|attention|risk|critical|check|falling|drop/.test(q)) {
    const rows = clients
      .filter((client) => client.status !== "suspended")
      .map((client) => ({ client, health: getStoreHealth(client) }))
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
