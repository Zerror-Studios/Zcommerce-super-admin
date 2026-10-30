/**
 * Store health block for the console (PRD-025 FR-5, FR-6.3)
 *
 * The nightly usage snapshot's `health` sub-document as the store page's
 * Health card lists it: one row per figure, "Not collected yet" for a
 * null, refunds as a count and an amount, and a tone where a figure
 * deserves a look (failures, dead letters, no paid orders). Every number
 * is the server's.
 */

import { formatCount, formatMoney, formatPercent } from "../components/ui/money";
import type { Tone } from "../components/ui/tones";
import type { TenantHealth } from "../types/platform-api";

// ─── Constants ────────────────────────────────────────────────────────────

export const NOT_COLLECTED_COPY = "Not collected yet";

export const NO_HEALTH_SNAPSHOT_COPY =
  "No health snapshot yet. The nightly usage run after this deploy fills it in.";

// ─── Types ────────────────────────────────────────────────────────────────

export interface TenantHealthRow {
  key: keyof TenantHealth;
  label: string;
  /** Null = not collected. */
  value: string | null;
  tone: Tone;
}

export interface HealthSnapshotLike {
  date: string;
  partial?: boolean | null;
  health?: TenantHealth | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** The newest snapshot of the list (`platformUsage` is newest first; checked anyway). */
export function latestHealthSnapshot<T extends HealthSnapshotLike>(
  snapshots: readonly T[] | null | undefined,
): T | null {
  let latest: T | null = null;
  for (const snapshot of snapshots ?? []) {
    if (!latest || Date.parse(snapshot.date) > Date.parse(latest.date)) latest = snapshot;
  }
  return latest;
}

function count(value: number | null): string | null {
  return value == null ? null : formatCount(value);
}

/** Warning when the figure is above zero (failures, expiries, dead letters). */
function alertAbove(value: number | null, tone: Tone): Tone {
  return value != null && value > 0 ? tone : "neutral";
}

export function tenantHealthRows(health: TenantHealth | null | undefined): TenantHealthRow[] {
  const h: TenantHealth = health ?? {
    logins30d: null,
    checkoutFailures7d: null,
    paymentFailures7d: null,
    repeatCustomerRate: null,
    unpaidExpiries30d: null,
    returns30d: null,
    refunds30d: null,
    stockOutVariants: null,
    outboxPending: null,
    dlqDepth: null,
    orders14d: null,
  };
  return [
    {
      key: "orders14d",
      label: "Paid orders · 14d",
      value: count(h.orders14d),
      tone: h.orders14d === 0 ? "warning" : "neutral",
    },
    { key: "logins30d", label: "Admin logins · 30d", value: count(h.logins30d), tone: "neutral" },
    {
      key: "checkoutFailures7d",
      label: "Checkout failures · 7d",
      value: count(h.checkoutFailures7d),
      tone: alertAbove(h.checkoutFailures7d, "warning"),
    },
    {
      key: "paymentFailures7d",
      label: "Payment failures · 7d",
      value: count(h.paymentFailures7d),
      tone: alertAbove(h.paymentFailures7d, "warning"),
    },
    {
      key: "repeatCustomerRate",
      label: "Repeat customers",
      value: h.repeatCustomerRate == null ? null : formatPercent(h.repeatCustomerRate),
      tone: "neutral",
    },
    {
      key: "unpaidExpiries30d",
      label: "Unpaid orders expired · 30d",
      value: count(h.unpaidExpiries30d),
      tone: alertAbove(h.unpaidExpiries30d, "warning"),
    },
    { key: "returns30d", label: "Returns · 30d", value: count(h.returns30d), tone: "neutral" },
    {
      key: "refunds30d",
      label: "Refunds · 30d",
      value: h.refunds30d
        ? `${formatCount(h.refunds30d.count)} · ${formatMoney(h.refunds30d.amount, { whole: true })}`
        : null,
      tone: "neutral",
    },
    {
      key: "stockOutVariants",
      label: "Variants out of stock",
      value: count(h.stockOutVariants),
      tone: alertAbove(h.stockOutVariants, "warning"),
    },
    {
      key: "outboxPending",
      label: "Events waiting to publish",
      value: count(h.outboxPending),
      tone: "neutral",
    },
    {
      key: "dlqDepth",
      label: "Dead-lettered events",
      value: count(h.dlqDepth),
      tone: alertAbove(h.dlqDepth, "danger"),
    },
  ];
}
