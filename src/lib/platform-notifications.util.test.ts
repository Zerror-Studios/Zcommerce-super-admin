import { describe, expect, it } from "vitest";
import type { PlatformNotification } from "../types/platform-api";
import { PLATFORM_PERMISSIONS, type PlatformPermission } from "./permissions";
import {
  NOTIFICATION_PAGE_LIMIT,
  NOTIFICATION_POLL_INTERVAL_MS,
  appendNotificationPage,
  markItemsRead,
  notificationCountVariables,
  notificationDetail,
  notificationHref,
  notificationTone,
  totalUnread,
  unreadByCategory,
  visibleNotificationTabs,
} from "./platform-notifications.util";

function item(overrides: Partial<PlatformNotification> = {}): PlatformNotification {
  return {
    id: "n1",
    kind: "invoice.overdue",
    category: "PAYMENTS",
    severity: "WARNING",
    title: "Invoice overdue",
    body: null,
    tenantId: "t1",
    tenantName: "Kesar & Kin",
    link: "/stores/t1",
    createdAt: "2026-10-27T10:00:00.000Z",
    read: false,
    ...overrides,
  };
}

const holds =
  (...granted: PlatformPermission[]) =>
  (permission: PlatformPermission) =>
    granted.includes(permission);

describe("notification tabs (PRD-024 FR-4.1.3, FR-4.1.5)", () => {
  it("pages 20 at a time and polls every 60 s", () => {
    expect(NOTIFICATION_PAGE_LIMIT).toBe(20);
    expect(NOTIFICATION_POLL_INTERVAL_MS).toBe(60_000);
  });

  it("maps the three tabs onto the server categories, in order", () => {
    const tabs = visibleNotificationTabs(() => true);
    expect(tabs.map((tab) => [tab.label, tab.category])).toEqual([
      ["Payments", "PAYMENTS"],
      ["Stores", "STORES"],
      ["Health", "HEALTH"],
    ]);
  });

  it("shows a tab only with its read permission", () => {
    const support = visibleNotificationTabs(
      holds(PLATFORM_PERMISSIONS.TENANTS_READ, PLATFORM_PERMISSIONS.REPORTS_READ),
    );
    expect(support.map((tab) => tab.category)).toEqual(["STORES", "HEALTH"]);
    // AI top-ups are STORES items, readable with platform:ai:read alone.
    const aiOnly = visibleNotificationTabs(holds(PLATFORM_PERMISSIONS.AI_READ));
    expect(aiOnly.map((tab) => tab.category)).toEqual(["STORES"]);
    expect(visibleNotificationTabs(() => false)).toEqual([]);
  });

  it("asks counts only for the visible tabs", () => {
    const tabs = visibleNotificationTabs(holds(PLATFORM_PERMISSIONS.BILLING_READ));
    expect(notificationCountVariables(tabs)).toEqual({ payments: true, stores: false, health: false });
  });

  it("adds the per-tab unread counts for the bell", () => {
    const unread = unreadByCategory({ payments: { unreadCount: 2 }, health: { unreadCount: 3 } });
    expect(unread).toEqual({ PAYMENTS: 2, STORES: 0, HEALTH: 3 });
    expect(totalUnread(unread)).toBe(5);
    expect(totalUnread(unreadByCategory(undefined))).toBe(0);
  });
});

describe("notification items", () => {
  it("styles severity with the kit tones", () => {
    expect(notificationTone("CRITICAL")).toBe("danger");
    expect(notificationTone("WARNING")).toBe("warning");
    expect(notificationTone("INFO")).toBe("neutral");
    expect(notificationTone("SOMETHING_NEW")).toBe("neutral");
  });

  it("uses the body, else the store, as the detail", () => {
    expect(notificationDetail(item({ body: "₹4,999 due 3 days ago" }))).toBe("₹4,999 due 3 days ago");
    expect(notificationDetail(item({ body: "  " }))).toBe("Kesar & Kin");
    expect(notificationDetail(item({ tenantName: null }))).toBeNull();
  });

  it("follows only console routes", () => {
    expect(notificationHref("/billing/invoices")).toBe("/billing/invoices");
    expect(notificationHref("https://example.com")).toBeNull();
    expect(notificationHref("//example.com/x")).toBeNull();
    expect(notificationHref(null)).toBeNull();
  });

  it("marks only the given items read", () => {
    const items = [item({ id: "a" }), item({ id: "b" }), item({ id: "c", read: true })];
    const next = markItemsRead(items, ["a", "c"]);
    expect(next.map((entry) => entry.read)).toEqual([true, false, true]);
    // Untouched rows keep their identity.
    expect(next[1]).toBe(items[1]);
    expect(next[2]).toBe(items[2]);
  });

  it("appends a later page without repeating rows", () => {
    const merged = appendNotificationPage([item({ id: "a" }), item({ id: "b" })], [item({ id: "b" }), item({ id: "c" })]);
    expect(merged.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });
});
