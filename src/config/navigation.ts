import type { NavItem } from "../components/layout/types";
import { PLATFORM_PERMISSIONS, type PlatformPermission } from "../lib/permissions";
import { IconAnalytics, IconBilling, IconChat, IconHome, IconSettings, IconStore } from "../components/ui/icons";

/**
 * Super Admin navigation (docs/design/04-super-admin.md §1, sections renamed by the owner 2026-10-16:
 * Billing → Subscriptions, Revenue → Platform revenue + Store sales). /billing/* and settings URLs are unchanged;
 * Stores live at /stores (old /clients URLs redirect, see App.tsx).
 */
export const mainNavItems: NavItem[] = [
  { key: "home", label: "Home", to: "/", end: true, icon: IconHome },
  { key: "stores", label: "Stores", to: "/stores", icon: IconStore },
  {
    key: "billing",
    label: "Subscriptions",
    to: "/billing",
    icon: IconBilling,
    children: [
      { label: "Collections", to: "/billing/subscriptions" },
      { label: "Invoices", to: "/billing/invoices" },
      { label: "Transactions", to: "/billing/transactions" },
      // PRD-016 FR-19: payments that need a person (amount mismatch, paid while stopped).
      { label: "Flagged payments", to: "/billing/flagged" },
      // PRD-018 FR-1.8: store payments pending > 48 h in suspended stores.
      { label: "Stuck store payments", to: "/billing/stuck" },
      { label: "Payment reminders", to: "/billing/reminders" },
    ],
  },
  {
    key: "analytics",
    label: "Analytics",
    to: "/analytics",
    icon: IconAnalytics,
    children: [
      // What stores pay Zcom, and what stores sell to their own customers.
      { label: "Platform revenue", to: "/analytics/revenue" },
      { label: "Store sales", to: "/analytics/store-sales" },
      // PRD-012 FR-8.3: traffic and GMV across stores, app health, analytics sync runs.
      { label: "Performance", to: "/analytics/performance" },
      { label: "Integration health", to: "/analytics/integrations" },
      { label: "Sync monitor", to: "/analytics/sync" },
    ],
  },
  {
    key: "ai",
    label: "AI",
    to: "/ai",
    icon: IconChat,
    // PRD-021 FR-6: shown only with platform:ai:read (`visibleNavItems`).
    children: [
      { label: "Overview", to: "/ai/overview" },
      { label: "Usage by store", to: "/ai/usage" },
      { label: "Top-up requests", to: "/ai/top-ups" },
      { label: "Data health", to: "/ai/data-health" },
      { label: "Benchmarks", to: "/ai/benchmarks" },
      { label: "Settings", to: "/ai/settings" },
    ],
  },
  // A single link: /settings is the two-pane settings card (pages/Settings.tsx), like Merchant Admin.
  { key: "settings", label: "Settings", to: "/settings", icon: IconSettings },
];

/** Sections of the Settings two-pane card (pages/Settings.tsx). */
export const settingsPages = [
  { label: "Payment gateway", to: "/settings/payment-gateway" },
  { label: "Grace period and reminders", to: "/settings/billing-rules" },
  { label: "Health thresholds", to: "/settings/health" },
  { label: "Plans", to: "/settings/plans" },
  { label: "Discounts", to: "/settings/discounts" },
  { label: "Admins", to: "/settings/team" },
  { label: "Audit log", to: "/settings/audit" },
];

/** Every page, for page titles and the command palette (settings pages are listed under Settings). */
export const allNavItems: NavItem[] = mainNavItems.map((item) =>
  item.key === "settings" ? { ...item, children: [...settingsPages, { label: "Settings", to: "/settings" }] } : item,
);

/** Nav entries a role may not open at all; others show a lock page instead. */
const NAV_PERMISSIONS: Partial<Record<string, PlatformPermission>> = {
  ai: PLATFORM_PERMISSIONS.AI_READ,
};

/** `items` without the entries the caller's role can't open (PRD-021 FR-6). */
export function visibleNavItems(
  items: NavItem[],
  can: (permission: PlatformPermission) => boolean,
): NavItem[] {
  return items.filter((item) => {
    const permission = NAV_PERMISSIONS[item.key];
    return !permission || can(permission);
  });
}
