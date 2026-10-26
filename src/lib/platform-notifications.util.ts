/**
 * Notifications feed helpers (PRD-024 FR-4.1)
 *
 * The bell's tabs map one to one onto the server's categories, and each tab
 * is shown only to a role that holds its read permission (FR-4.1.3; the
 * server filters too). Read state lives on the server per user; these
 * helpers keep the loaded page in step after a mark succeeds.
 */

import type { Tone } from "../components/ui/tones";
import type {
  PlatformNotification,
  PlatformNotificationCategory,
} from "../types/platform-api";
import { PLATFORM_PERMISSIONS, type PlatformPermission } from "./permissions";

// ─── Constants ────────────────────────────────────────────────────────────

/** One page of a tab. */
export const NOTIFICATION_PAGE_LIMIT = 20;

/** How often the bell re-reads the unread counts while the tab is visible. */
export const NOTIFICATION_POLL_INTERVAL_MS = 60_000;

export interface NotificationTab {
  category: PlatformNotificationCategory;
  /** The `@include` variable and count alias in the counts query. */
  key: "payments" | "stores" | "health";
  label: string;
  /** Any one of these opens the tab. */
  permissions: readonly PlatformPermission[];
}

/** The panel's tabs, in order (the console's existing Payments, Stores, Health). */
export const NOTIFICATION_TABS: readonly NotificationTab[] = [
  {
    category: "PAYMENTS",
    key: "payments",
    label: "Payments",
    permissions: [PLATFORM_PERMISSIONS.BILLING_READ],
  },
  {
    category: "STORES",
    key: "stores",
    label: "Stores",
    // AI top-up requests are STORES items readable with platform:ai:read.
    permissions: [
      PLATFORM_PERMISSIONS.TENANTS_READ,
      PLATFORM_PERMISSIONS.AI_READ,
    ],
  },
  {
    category: "HEALTH",
    key: "health",
    label: "Health",
    permissions: [PLATFORM_PERMISSIONS.REPORTS_READ],
  },
];

// ─── Tabs and counts ──────────────────────────────────────────────────────

/** The tabs the caller's role may open. */
export function visibleNotificationTabs(
  can: (permission: PlatformPermission) => boolean,
): NotificationTab[] {
  return NOTIFICATION_TABS.filter((tab) => tab.permissions.some(can));
}

/** `@include` flags for the counts query: one per visible tab. */
export function notificationCountVariables(
  tabs: readonly NotificationTab[],
): Record<NotificationTab["key"], boolean> {
  const keys = new Set(tabs.map((tab) => tab.key));
  return {
    payments: keys.has("payments"),
    stores: keys.has("stores"),
    health: keys.has("health"),
  };
}

type CountsAnswer = Partial<
  Record<NotificationTab["key"], { unreadCount: number } | null>
>;

/** Unread per category from the counts query; a skipped tab reads 0. */
export function unreadByCategory(
  data: CountsAnswer | undefined,
): Record<PlatformNotificationCategory, number> {
  return {
    PAYMENTS: data?.payments?.unreadCount ?? 0,
    STORES: data?.stores?.unreadCount ?? 0,
    HEALTH: data?.health?.unreadCount ?? 0,
  };
}

/** The bell's total. */
export function totalUnread(
  counts: Record<PlatformNotificationCategory, number>,
): number {
  return counts.PAYMENTS + counts.STORES + counts.HEALTH;
}

// ─── Items ────────────────────────────────────────────────────────────────

/** Severity → kit tone for the icon tile. */
export function notificationTone(severity: string): Tone {
  if (severity === "CRITICAL") return "danger";
  if (severity === "WARNING") return "warning";
  return "neutral";
}

/** The one-line detail: the body, else the store it is about. */
export function notificationDetail(item: PlatformNotification): string | null {
  return item.body?.trim() || item.tenantName || null;
}

/**
 * The console route to open, or `null`. Only same-app paths are followed,
 * so a stored link can never send staff to another site.
 */
export function notificationHref(link: string | null): string | null {
  if (!link || !link.startsWith("/") || link.startsWith("//")) return null;
  return link;
}

/** The page with `ids` marked read (after the server confirmed). */
export function markItemsRead(
  items: readonly PlatformNotification[],
  ids: readonly string[],
): PlatformNotification[] {
  const marked = new Set(ids);
  return items.map((item) =>
    marked.has(item.id) && !item.read ? { ...item, read: true } : item,
  );
}

/** Appends a later page, dropping rows already shown (a new item shifts offsets). */
export function appendNotificationPage(
  items: readonly PlatformNotification[],
  page: readonly PlatformNotification[],
): PlatformNotification[] {
  const seen = new Set(items.map((item) => item.id));
  return [...items, ...page.filter((item) => !seen.has(item.id))];
}
