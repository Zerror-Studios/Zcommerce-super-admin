/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * One status mapping for both products (status-mappings.md). The same status always gets the same tone.
 * Keys are normalised (lowercase, spaces/hyphens → "_"). Unknown values render neutral with a humanised label.
 * Entries marked "added" are not in status-mappings.md; they were added from real data and must be reported.
 */
import type { Tone } from "./tones";

export interface StatusInfo {
  label: string;
  tone: Tone;
}

export type StatusDomain =
  | "order"
  | "payment"
  | "fulfillment"
  | "transfer"
  | "campaign"
  | "sync"
  | "store"
  | "plan"
  | "product"
  | "blog"
  | "submission"
  | "review"
  | "subscriber"
  | "user";

const s = (label: string, tone: Tone): StatusInfo => ({ label, tone });

export const STATUS_MAP: Record<StatusDomain, Record<string, StatusInfo>> = {
  order: {
    pending: s("Pending", "warning"),
    on_hold: s("On hold", "warning"),
    processing: s("Processing", "info"),
    confirmed: s("Confirmed", "info"),
    packed: s("Packed", "info"),
    shipped: s("Shipped", "info"),
    out_for_delivery: s("Out for delivery", "info"),
    delivered: s("Delivered", "success"),
    completed: s("Completed", "success"),
    returned: s("Returned", "neutral"),
    refunded: s("Refunded", "neutral"),
    cancelled: s("Cancelled", "danger"),
    canceled: s("Cancelled", "danger"),
    failed: s("Failed", "danger"),
  },
  payment: {
    paid: s("Paid", "success"),
    succeeded: s("Paid", "success"),
    captured: s("Paid", "success"),
    success: s("Paid", "success"), // added: Super Admin transactions
    successful: s("Paid", "success"), // added
    successfull: s("Paid", "success"), // added: Store payments API spelling
    upcoming: s("Upcoming", "info"),
    scheduled: s("Upcoming", "info"),
    processing: s("Processing", "info"),
    authorized: s("Processing", "info"),
    pending: s("Due", "warning"),
    unpaid: s("Due", "warning"),
    due: s("Due", "warning"),
    partially_paid: s("Partially paid", "warning"),
    overdue: s("Overdue", "danger"),
    past_due: s("Overdue", "danger"),
    failed: s("Failed", "danger"),
    declined: s("Failed", "danger"),
    refunded: s("Refunded", "neutral"),
    partially_refunded: s("Refunded", "neutral"),
    void: s("Void", "neutral"),
    cancelled: s("Void", "neutral"),
  },
  fulfillment: {
    // added: Store order fulfilment states
    fulfilled: s("Fulfilled", "success"),
    partially_fulfilled: s("Partially fulfilled", "warning"),
    unfulfilled: s("Unfulfilled", "warning"),
    pending: s("Pending", "warning"),
  },
  transfer: {
    // added: Store inventory transfers
    draft: s("Draft", "neutral"),
    pending: s("Pending", "warning"),
    in_transit: s("In transit", "info"),
    partially_received: s("Partially received", "warning"),
    received: s("Received", "success"),
    cancelled: s("Cancelled", "danger"),
  },
  campaign: {
    // added: Store SMS / email campaigns
    draft: s("Draft", "neutral"),
    scheduled: s("Scheduled", "info"),
    running: s("Running", "info"),
    completed: s("Completed", "success"),
    paused: s("Paused", "neutral"),
    cancelled: s("Cancelled", "neutral"),
    failed: s("Failed", "danger"),
  },
  sync: {
    // added: Store marketplace channel sync
    running: s("Running", "info"),
    pending: s("Pending", "warning"),
    completed: s("Completed", "success"),
    partial: s("Partial", "warning"),
    failed: s("Failed", "danger"),
    cancelled: s("Cancelled", "neutral"),
  },
  store: {
    active: s("Active", "success"),
    live: s("Active", "success"),
    trial: s("Trial", "info"),
    trialing: s("Trial", "info"),
    setup_pending: s("Setting up", "warning"),
    onboarding: s("Setting up", "warning"),
    inactive: s("Inactive", "neutral"),
    paused: s("Inactive", "neutral"),
    suspended: s("Suspended", "danger"),
    blocked: s("Suspended", "danger"),
  },
  plan: {
    active: s("Active", "success"),
    trialing: s("Trial", "info"),
    expiring_soon: s("Expiring soon", "warning"),
    pending: s("Pending", "warning"), // added: Super Admin subscriptions
    past_due: s("Payment overdue", "danger"),
    expired: s("Expired", "danger"),
    cancelled: s("Cancelled", "neutral"),
    canceled: s("Cancelled", "neutral"), // added: US spelling
  },
  product: {
    published: s("Published", "success"),
    active: s("Published", "success"),
    draft: s("Draft", "neutral"),
    scheduled: s("Scheduled", "info"),
    archived: s("Archived", "neutral"),
    in_stock: s("In stock", "success"), // added: Store stock status
    out_of_stock: s("Out of stock", "danger"),
    low_stock: s("Low stock", "warning"),
  },
  blog: {
    published: s("Published", "success"),
    draft: s("Draft", "neutral"),
    scheduled: s("Scheduled", "info"),
    archived: s("Archived", "neutral"),
  },
  submission: {
    new: s("New", "info"),
    unread: s("New", "info"),
    read: s("Read", "neutral"),
    replied: s("Replied", "success"),
    resolved: s("Resolved", "success"),
    spam: s("Spam", "danger"),
  },
  review: {
    // added: Store customer reviews
    approved: s("Approved", "success"),
    pending: s("Pending", "warning"),
    rejected: s("Rejected", "danger"),
  },
  subscriber: {
    // added: Store newsletter subscribers
    active: s("Active", "success"),
    unsubscribed: s("Unsubscribed", "neutral"),
    bounced: s("Bounced", "warning"),
    spam: s("Spam", "danger"),
  },
  user: {
    // added: Super Admin team members
    active: s("Active", "success"),
    invited: s("Invited", "info"),
    disabled: s("Disabled", "danger"),
  },
};

export function normalizeStatus(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function humanize(value: unknown): string {
  const text = String(value ?? "").trim().replace(/[_-]+/g, " ").toLowerCase();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Unknown";
}

/** Label and tone for a status. Unknown values: neutral + humanised label (warns in development). */
export function getStatus(domain: StatusDomain, value: unknown): StatusInfo {
  const hit = STATUS_MAP[domain][normalizeStatus(value)];
  if (hit) return hit;
  if (import.meta.env?.DEV) {
    console.warn(`[status-map] Unknown ${domain} status "${String(value)}". Add it to status-map.ts.`);
  }
  return { label: humanize(value), tone: "neutral" };
}

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
export const fullDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Plan expiry (status-mappings §6). Whole days in the user's timezone, start of day to start of day. */
export function getExpiryStatus(expiresAt: Date | string | number | null | undefined, now: Date = new Date()): StatusInfo & { days: number | null } {
  if (expiresAt == null || expiresAt === "") return { label: "No expiry", tone: "neutral", days: null };
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return { label: "No expiry", tone: "neutral", days: null };
  const days = Math.round((startOfDay(date) - startOfDay(now)) / DAY);
  if (days > 30) return { label: `Renews ${shortDate.format(date)}`, tone: "neutral", days };
  if (days >= 8) return { label: `Expires in ${days} days`, tone: "info", days };
  if (days >= 2) return { label: `Expires in ${days} days`, tone: "warning", days };
  if (days === 1) return { label: "Expires tomorrow", tone: "warning", days };
  if (days === 0) return { label: "Expires today", tone: "danger", days };
  const ago = Math.abs(days);
  return { label: `Expired ${ago} ${ago === 1 ? "day" : "days"} ago`, tone: "danger", days };
}

/** Store health band (status-mappings §7). The score itself comes from existing data. */
export function getHealthBand(score: number | null | undefined): StatusInfo {
  if (score == null || Number.isNaN(score)) return { label: "Not available", tone: "neutral" };
  if (score >= 80) return { label: "Healthy", tone: "success" };
  if (score >= 50) return { label: "Needs attention", tone: "warning" };
  return { label: "Critical", tone: "danger" };
}
