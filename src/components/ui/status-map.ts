/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * One status mapping for both products (status-mappings.md). The same status always gets the same tone.
 * Keys are normalised (lowercase, spaces/hyphens → "_"). Unknown values render neutral with a humanised label.
 * Entries marked "added" are not in status-mappings.md; they were added from real data and must be reported.
 */
import type { Tone } from "./tones";
import { formatDate } from "./format-date";

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
    rto: s("RTO", "danger"), // spec 02 §10: return to origin is critical
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
    // v2 status words (03 "Status words"): Awaiting payment replaces "Un paid"; Pending is info.
    pending: s("Pending", "info"),
    unpaid: s("Awaiting payment", "warning"),
    un_paid: s("Awaiting payment", "warning"),
    due: s("Due", "warning"),
    partially_paid: s("Partially paid", "warning"),
    overdue: s("Overdue", "danger"),
    past_due: s("Overdue", "danger"),
    failed: s("Failed", "danger"),
    declined: s("Failed", "danger"),
    refunded: s("Refunded", "neutral"),
    partially_refunded: s("Partially refunded", "neutral"),
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
    // v2 status words (03): Draft · Scheduled · Sending · Sent · Failed.
    running: s("Sending", "info"),
    sending: s("Sending", "info"),
    completed: s("Sent", "success"),
    sent: s("Sent", "success"),
    paused: s("Paused", "neutral"),
    cancelled: s("Cancelled", "danger"),
    failed: s("Failed", "danger"),
  },
  sync: {
    // added: Store marketplace channel sync
    running: s("Running", "info"),
    pending: s("Pending", "warning"),
    completed: s("Completed", "success"),
    partial: s("Partial", "warning"),
    failed: s("Failed", "danger"),
    cancelled: s("Cancelled", "danger"),
  },
  store: {
    // Store lifecycle (docs/design/04-super-admin.md §2): Building · Live · Suspended · Cancelled.
    active: s("Live", "success"),
    live: s("Live", "success"),
    building: s("Building", "info"),
    trial: s("Trial", "info"),
    trialing: s("Trial", "info"),
    setup_pending: s("Building", "info"),
    onboarding: s("Building", "info"),
    inactive: s("Inactive", "neutral"),
    paused: s("Inactive", "neutral"),
    suspended: s("Suspended", "danger"),
    blocked: s("Suspended", "danger"),
    cancelled: s("Cancelled", "danger"),
    canceled: s("Cancelled", "danger"),
  },
  plan: {
    active: s("Active", "success"),
    trial: s("Trial", "info"), // added: Super Admin subscriptions (backend TRIAL)
    trialing: s("Trial", "info"),
    expiring_soon: s("Expiring soon", "warning"),
    pending: s("Pending", "warning"), // added: Super Admin subscriptions
    past_due: s("Overdue", "danger"),
    expired: s("Expired", "danger"),
    suspended: s("Suspended", "danger"), // added: Super Admin subscriptions (backend SUSPENDED)
    cancelled: s("Cancelled", "danger"),
    canceled: s("Cancelled", "danger"), // added: US spelling
  },
  product: {
    published: s("Active", "success"),
    active: s("Active", "success"),
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
    // v2: a hidden review is not an error (03 "Status words": Review Pending / Approved / Hidden).
    rejected: s("Hidden", "neutral"),
    hidden: s("Hidden", "neutral"),
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
    inactive: s("Inactive", "neutral"), // added: Store staff ("Deactive" in the API)
    deactive: s("Inactive", "neutral"),
    blocked: s("Blocked", "warning"),
    deleted: s("Deleted", "danger"),
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

/** The badge tone for a status (spec statusTone()): same status, same tone, in both apps. */
export function statusTone(domain: StatusDomain, value: unknown): Tone {
  return getStatus(domain, value).tone;
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

/** "14 Oct 2026" (always with the year; tooltips). Same `format()` shape as the Intl formatter it replaced. */
export const fullDate = { format: (date: Date) => formatDate(date, new Date(0)) };

/** Plan expiry (status-mappings §6). Whole days in the user's timezone, start of day to start of day. */
export function getExpiryStatus(expiresAt: Date | string | number | null | undefined, now: Date = new Date()): StatusInfo & { days: number | null } {
  if (expiresAt == null || expiresAt === "") return { label: "No expiry", tone: "neutral", days: null };
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return { label: "No expiry", tone: "neutral", days: null };
  const days = Math.round((startOfDay(date) - startOfDay(now)) / DAY);
  if (days > 30) return { label: `Renews ${formatDate(date, now)}`, tone: "neutral", days };
  if (days >= 8) return { label: `Expires in ${days} days`, tone: "info", days };
  if (days >= 2) return { label: `Expires in ${days} days`, tone: "warning", days };
  if (days === 1) return { label: "Expires tomorrow", tone: "warning", days };
  if (days === 0) return { label: "Expires today", tone: "danger", days };
  const ago = Math.abs(days);
  // Spec 05 §5: "Overdue · 2 days" (was "Expired 2 days ago").
  return { label: `Overdue · ${ago} ${ago === 1 ? "day" : "days"}`, tone: "danger", days };
}

/** Store health band (docs/design/04-super-admin.md §2): 80–100 Healthy · 50–79 At risk · 0–49 Critical. */
export function getHealthBand(score: number | null | undefined): StatusInfo {
  if (score == null || Number.isNaN(score)) return { label: "Not live yet", tone: "neutral" };
  if (score >= 80) return { label: "Healthy", tone: "success" };
  if (score >= 50) return { label: "At risk", tone: "warning" };
  return { label: "Critical", tone: "danger" };
}
