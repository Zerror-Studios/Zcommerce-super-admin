/**
 * Super Admin Home rules (design v2 §7 "Home", board 02-V4-SA-Home)
 *
 * Pure helpers for the v2 Home: the hero's period tabs (the snapshot
 * periods), its chips and one-line summary, the four summary cells (GMV,
 * Subscriptions, Store health, and Uptime, which falls back to checkout
 * failures until uptime is monitored), and the Recent activity rows. The
 * server computes every number; the only sum here is the average store
 * health over the stores the console has loaded (Phase 0 audit §6).
 */

import type { HomeHeroChip, HomeHeroPeriod, SummaryCell, SummaryTone } from "../components/ui";
import { formatCount, formatMoney, formatPercent } from "../components/ui/money";
import { formatDate, formatTime } from "../components/ui/format-date";
import { getHealthBand } from "../components/ui/status-map";
import { formatMetricValue } from "./platform-insights.util";
import { storeLifecycleEnum, storeLifecycleKey } from "./storeStatus";
import type { Client } from "../types";
import type { PlatformAttention, PlatformMetric, PlatformMetricsPeriod } from "../types/platform-insights";

// ─── Hero ─────────────────────────────────────────────────────────────────

/**
 * The hero's period tabs, as snapshot periods. The snapshot has no
 * calendar-year period, so the last tab is the last 12 months and says so.
 */
export const SA_HOME_PERIODS: HomeHeroPeriod<PlatformMetricsPeriod>[] = [
  { value: "TODAY", label: "Today" },
  { value: "LAST_7D", label: "7 days" },
  { value: "LAST_30D", label: "30 days" },
  { value: "LAST_12M", label: "12 months" },
];

export const SA_HOME_DEFAULT_PERIOD: PlatformMetricsPeriod = "LAST_30D";

/** "vs the previous 30 days", for the chip tooltips. */
export const SA_HOME_COMPARISON: Partial<Record<PlatformMetricsPeriod, string>> = {
  TODAY: "vs yesterday",
  LAST_7D: "vs the previous 7 days",
  LAST_30D: "vs the previous 30 days",
  LAST_12M: "vs the 12 months before",
};

/**
 * The greeting's name (round 2 §6.1, board 02 "Good morning, Zerror Studios"):
 * the viewer's whole display name, so the studio account reads "Zerror
 * Studios"; the studio when the name is blank.
 */
export function greetingName(name: string | null | undefined): string {
  return name?.trim().replace(/\s+/g, " ") || "Zerror Studios";
}

/** "Thursday, 5 November · Platform" (the hero shows it in mono capitals). */
export function heroDate(now: Date = new Date()): string {
  return `${now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · Platform`;
}

export interface StoreCounts {
  total: number;
  live: number;
}

/** Stores the console has loaded (deleted ones left out) and how many went live. */
export function storeCounts(clients: Client[]): StoreCounts {
  let total = 0;
  let live = 0;
  for (const client of clients) {
    const key = storeLifecycleKey(client);
    if (key === storeLifecycleEnum.DELETED) continue;
    total += 1;
    if (key === storeLifecycleEnum.LIVE) live += 1;
  }
  return { total, live };
}

export interface PastDue {
  count: number;
  amount: number;
}

/** Overdue rows of money due (live; `null` without `platform:billing:read`). */
export function pastDueOf(moneyDue: PlatformAttention["moneyDue"] | null | undefined): PastDue | null {
  if (!moneyDue) return null;
  const rows = moneyDue.items.filter((row) => row.overdue);
  return { count: rows.length, amount: rows.reduce((sum, row) => sum + row.amount, 0) };
}

const plural = (count: number, one: string, many: string) => `${formatCount(count)} ${count === 1 ? one : many}`;

/** The three chips: stores · live, GMV change, payments past due. */
export function heroChips(input: {
  stores: StoreCounts | null;
  gmv: PlatformMetric | null;
  pastDue: PastDue | null;
  comparison?: string;
}): HomeHeroChip[] {
  const chips: HomeHeroChip[] = [];
  if (input.stores) {
    chips.push({
      key: "stores",
      label: `${plural(input.stores.total, "store", "stores")} ·`,
      value: `${formatCount(input.stores.live)} live`,
      // A count, not a change: "flat" keeps the arrow off (and the dot white; the kit ties the dot to the trend).
      trend: "flat",
    });
  }
  const gmv = input.gmv;
  if (gmv && gmv.status !== "UNAVAILABLE" && gmv.value != null) {
    const change = gmv.changePercent;
    const hasChange = change != null && Number.isFinite(change) && change !== 0;
    chips.push({
      key: "gmv",
      label: "GMV",
      value: hasChange ? formatPercent(Math.abs(change)) : formatMetricValue(gmv.value, String(gmv.unit)),
      trend: hasChange ? (change > 0 ? "up" : "down") : "flat",
      title: hasChange ? input.comparison : undefined,
    });
  }
  if (input.pastDue) {
    const { count } = input.pastDue;
    chips.push({
      key: "past-due",
      label: count ? `${plural(count, "payment", "payments")} past due` : "Nothing past due",
      // The dot only: red with something past due, green when clear.
      trend: count ? "down" : "up",
      title: count ? `${formatMoney(input.pastDue.amount, { whole: true })} overdue` : undefined,
    });
  }
  return chips;
}

/** The hero's one line: what needs the team this week, from the counts Home already has. */
export function heroSummary(input: { pastDue: PastDue | null; atRisk: number; inSetup: number }): string {
  const parts: string[] = [];
  if (input.pastDue?.count) parts.push(plural(input.pastDue.count, "payment past due", "payments past due"));
  if (input.atRisk) parts.push(`${plural(input.atRisk, "store", "stores")} at risk`);
  if (input.inSetup) parts.push(`${plural(input.inSetup, "store", "stores")} in setup`);
  if (parts.length === 0) return "Nothing needs you today. Every store is paid up and on track.";
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  return `This week: ${list}.`;
}

/** Stores in setup longer than this are "stuck" (the backend's SETUP_STALLED_DAYS, PRD-036 D15). */
export const SETUP_STALLED_DAYS = 7;

/**
 * The hero's line from the attention engine (round 2 §6.1): how many stores
 * need the team this week and why, e.g. "2 stores need you this week: a
 * past-due payment and a store stuck in setup." The stores are the union of
 * those Zcom AI's attention items name (PRD-036 D15 rules), money due this
 * week, stores at risk and stores in setup for more than 7 days. When the
 * items name no store, the first item is the line.
 */
/** PRD-036 round 2 gaps: the attention rule keys the hero can name ("the payment app shutdown"). */
const RULE_REASONS: Record<string, { one: string; many: string }> = {
  PAYMENT_APP_RETIRING: { one: "a store on a payment app that is shutting down", many: "stores on a payment app that is shutting down" },
  PAYMENTS_FAILING: { one: "a store with payments failing", many: "stores with payments failing" },
  CHECKOUT_FAILURES: { one: "a store with checkouts failing", many: "stores with checkouts failing" },
  ANALYTICS_STALE: { one: "a store whose Google Analytics stopped syncing", many: "stores whose Google Analytics stopped syncing" },
  TRIAL_ENDING: { one: "a trial ending soon", many: "trials ending soon" },
  INVOICE_PAST_DUE: { one: "a past-due invoice", many: "past-due invoices" },
  INVOICE_DUE_SOON: { one: "an invoice due soon", many: "invoices due soon" },
  SETUP_STALLED: { one: "a store stuck in setup", many: "stores stuck in setup" },
};

export function heroAttentionLine(attention: PlatformAttention | null | undefined): string {
  if (!attention) return "";
  const items = attention.whatNeedsAttention?.items ?? [];
  const money = attention.moneyDue?.items ?? [];
  const pastDue = money.filter((row) => row.overdue).length;
  const dueSoon = money.length - pastDue;
  const stalled = attention.development.items.filter((row) => (row.days ?? 0) > SETUP_STALLED_DAYS);
  const atRisk = attention.atRisk.items;

  const stores = new Set<string>();
  for (const item of items) for (const id of item.storeIds) stores.add(id);
  for (const row of money) stores.add(row.tenantId);
  for (const row of stalled) stores.add(row.tenantId);
  for (const row of atRisk) stores.add(row.tenantId);

  const a = (count: number, one: string, many: string) => (count === 1 ? `a ${one}` : `${formatCount(count)} ${many}`);
  const parts: string[] = [];
  if (pastDue) parts.push(a(pastDue, "past-due payment", "past-due payments"));
  if (dueSoon) parts.push(a(dueSoon, "payment due soon", "payments due soon"));
  if (stalled.length) parts.push(stalled.length === 1 ? "a store stuck in setup" : `${formatCount(stalled.length)} stores stuck in setup`);
  if (atRisk.length) parts.push(atRisk.length === 1 ? "a store at risk" : `${formatCount(atRisk.length)} stores at risk`);
  // Stores only the rules name (payment app retiring, checkouts failing, sync stale): named by the item's rule key
  // (PRD-036 round 2 gaps), else "flagged by Zcom AI".
  const covered = new Set([...money, ...stalled, ...atRisk].map((row) => row.tenantId));
  const extraStores = Array.from(stores).filter((id) => !covered.has(id));
  const byReason = new Map<string, number>();
  for (const id of extraStores) {
    const rule = items.find((item) => item.storeIds.includes(id) && item.rule && RULE_REASONS[item.rule])?.rule;
    const key = rule ?? "AI";
    byReason.set(key, (byReason.get(key) ?? 0) + 1);
  }
  for (const [key, count] of byReason) {
    if (key === "AI") continue;
    const reason = RULE_REASONS[key];
    parts.push(count === 1 ? reason.one : `${formatCount(count)} ${reason.many}`);
  }
  const unnamed = byReason.get("AI") ?? 0;
  if (unnamed) {
    const more = parts.length ? "more " : "";
    parts.push(unnamed === 1 ? `one ${more}flagged by Zcom AI` : `${formatCount(unnamed)} ${more}flagged by Zcom AI`);
  }

  if (stores.size === 0) {
    if (items.length) return items[0].text;
    return "Nothing needs you today. Every store is paid up and on track.";
  }
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  const who = stores.size === 1 ? "1 store needs you this week" : `${formatCount(stores.size)} stores need you this week`;
  return list ? `${who}: ${list}.` : `${who}.`;
}

// ─── Summary panel ────────────────────────────────────────────────────────

export interface HealthSummary {
  /** Rounded average of the scored stores; null when none is scored. */
  average: number | null;
  scored: number;
  /** Scored stores, highest first. */
  rows: { id: string; name: string; score: number }[];
}

/** Average server health score over the loaded, scored stores (deleted ones left out). */
export function healthSummary(clients: Client[]): HealthSummary {
  const rows = clients
    .filter((client) => client.health && storeLifecycleKey(client) !== storeLifecycleEnum.DELETED)
    .map((client) => ({
      id: client.id,
      name: client.storeName,
      score: Math.max(0, Math.min(100, Math.round(client.health!.score))),
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  if (rows.length === 0) return { average: null, scored: 0, rows };
  const average = Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length);
  return { average, scored: rows.length, rows };
}

const EMPTY = "—";

const toneOfBand = (tone: string): SummaryTone => (tone === "danger" ? "danger" : tone === "warning" ? "warning" : "default");

const usable = (metric: PlatformMetric | null | undefined): metric is PlatformMetric =>
  Boolean(metric && metric.status !== "UNAVAILABLE" && metric.value != null);

export interface SummaryInput {
  gmv: PlatformMetric | null;
  orders: PlatformMetric | null;
  activeStores: number | null;
  mrr: PlatformMetric | null;
  collected: PlatformMetric | null;
  pastDue: PastDue | null;
  health: HealthSummary;
  /** Stores on the server; more than the loaded ones while paging. */
  totalStores: number;
  uptime: PlatformMetric | null;
  checkoutFailures: PlatformMetric | null;
  paymentFailures: PlatformMetric | null;
  /** The snapshot failed to load. */
  metricsError: boolean;
}

/**
 * GMV, Subscriptions, Store health and Uptime (§7). Uptime is not monitored
 * yet (`uptimePct` is UNAVAILABLE, Phase 0 audit §6), so until it is the
 * cell shows the nearest live platform number: checkout failures in 7 days.
 */
export function summaryCells(input: SummaryInput): SummaryCell[] {
  const snapshotNote = input.metricsError ? "Couldn't load the snapshot" : "No snapshot yet";

  // GMV
  const gmv = input.gmv;
  const orders = usable(input.orders) ? input.orders.value! : null;
  // Round 2 D3: a partial figure says so (the server's coverage reason), never looks complete
  const gmvNote = usable(gmv)
    ? [
        [
          orders != null ? plural(orders, "order", "orders") : null,
          input.activeStores != null ? `across ${plural(input.activeStores, "store", "stores")}` : null,
        ]
          .filter(Boolean)
          .join(" "),
        gmv?.reason ?? null,
      ]
        .filter(Boolean)
        .join(" · ")
    : (input.gmv?.reason ?? snapshotNote);
  const gmvCell: SummaryCell = {
    key: "gmv",
    label: "Sales on Zcom · GMV",
    value: usable(gmv) ? formatMetricValue(gmv.value, String(gmv.unit)) : EMPTY,
    note: gmvNote || undefined,
    chart: usable(gmv) ? { kind: "dots" } : undefined,
  };

  // Subscriptions: MRR, paying stores, past due in red.
  const mrr = input.mrr;
  const pastDue = input.pastDue;
  const paying = usable(mrr) ? mrr.count : null;
  const subNote = !mrr
    ? "Needs billing access"
    : !usable(mrr)
      ? (input.mrr?.reason ?? "No MRR snapshot yet")
      : [
          paying != null ? `${formatCount(paying)} paying` : null,
          pastDue?.count
            ? `${formatCount(pastDue.count)} past due`
            : usable(input.collected)
              ? `${formatMoney(input.collected.value, { whole: true })} collected this month`
              : null,
        ]
          .filter(Boolean)
          .join(" · ");
  const storesForShare = input.activeStores ?? 0;
  const subCell: SummaryCell = {
    key: "subscriptions",
    label: "Subscriptions",
    value: usable(mrr) ? formatMetricValue(mrr.value, String(mrr.unit)) : EMPTY,
    note: subNote || undefined,
    tone: pastDue?.count ? "danger" : "default",
    chart:
      paying != null && storesForShare > 0
        ? { kind: "segments", filled: Math.round((10 * Math.min(paying, storesForShare)) / storesForShare), total: 10 }
        : undefined,
  };

  // Store health: the average of the loaded stores' server scores.
  const health = input.health;
  const healthNote =
    health.average == null
      ? "No store scored yet"
      : health.rows.length <= 3
        ? health.rows.map((row) => `${row.name} ${row.score}`).join(" · ")
        : `Lowest: ${health.rows[health.rows.length - 1].name} ${health.rows[health.rows.length - 1].score} · ${plural(
            health.rows.filter((row) => getHealthBand(row.score).tone === "danger").length,
            "store",
            "stores",
          )} critical`;
  const partial = health.average != null && input.totalStores > health.scored ? ` (${formatCount(health.scored)} scored)` : "";
  const healthCell: SummaryCell = {
    key: "health",
    label: "Store health",
    value: health.average == null ? EMPTY : `${health.average} of 100`,
    note: health.average == null ? healthNote : `${healthNote}${partial}`,
    tone: health.average == null ? "default" : toneOfBand(getHealthBand(health.average).tone),
    chart: health.average == null ? undefined : { kind: "ring", percent: health.average },
  };

  // Uptime, or checkout failures in 7 days until uptime is monitored.
  let uptimeCell: SummaryCell;
  if (usable(input.uptime)) {
    uptimeCell = {
      key: "uptime",
      label: "Uptime",
      // Two decimals: 99.98% must not round to 100%.
      value: formatPercent(input.uptime.value, 2),
      note: input.uptime.reason ?? undefined,
    };
  } else {
    const checkout = usable(input.checkoutFailures) ? input.checkoutFailures : null;
    const payment = usable(input.paymentFailures) ? input.paymentFailures.value! : null;
    const failing = checkout?.count ?? 0;
    const note = checkout
      ? [
          failing ? `In ${plural(failing, "store", "stores")}` : "No store affected",
          payment != null ? plural(payment, "payment failure", "payment failures") : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : snapshotNote;
    uptimeCell = {
      key: "uptime",
      label: "Checkout failures · 7 days",
      value: checkout ? formatCount(checkout.value) : EMPTY,
      note,
      tone: checkout && checkout.value! > 0 ? "danger" : "default",
      chart:
        checkout && storesForShare > 0
          ? { kind: "ring", percent: Math.round((100 * (storesForShare - Math.min(failing, storesForShare))) / storesForShare) }
          : undefined,
    };
  }

  return [gmvCell, subCell, healthCell, uptimeCell];
}

// ─── Recent activity ──────────────────────────────────────────────────────

export type ActivityIconKey = "store" | "plan" | "coupon" | "ai" | "user" | "auth" | "settings" | "billing" | "other";

const ACTIVITY_PREFIXES: [string, ActivityIconKey][] = [
  ["tenant.", "store"],
  ["store.", "store"],
  ["plan.", "plan"],
  ["coupon.", "coupon"],
  ["ai.", "ai"],
  ["user.", "user"],
  ["auth.", "auth"],
  ["settings.", "settings"],
  ["invoice.", "billing"],
  ["subscription.", "billing"],
  ["payment.", "billing"],
  ["billing.", "billing"],
];

/** Which grey tile icon an audit action gets, by its area prefix. */
export function activityIconKey(action: string): ActivityIconKey {
  const lower = action.toLowerCase();
  return ACTIVITY_PREFIXES.find(([prefix]) => lower.startsWith(prefix))?.[1] ?? "other";
}

/** "10:42 AM" today (upper-case AM/PM, round 2 G13), "Yesterday", else "2 Nov". */
export function activityWhen(at: string, now: Date = new Date()): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return EMPTY;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (date.getTime() >= startOfToday) return formatTime(date);
  if (date.getTime() >= startOfToday - 86_400_000) return "Yesterday";
  return formatDate(date, now);
}
