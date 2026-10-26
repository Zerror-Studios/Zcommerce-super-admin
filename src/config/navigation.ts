import type { NavItem } from "../components/layout/types";
import { IconAnalytics, IconBilling, IconHome, IconSettings, IconStore } from "../components/ui/icons";

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
  // A single link: /settings lists every setting as cards (pages/Settings.tsx), like Merchant Admin.
  { key: "settings", label: "Settings", to: "/settings", icon: IconSettings },
];

/** Pages behind the Settings cards. */
export const settingsPages = [
  { label: "Plans", to: "/settings/plans" },
  { label: "Discounts", to: "/settings/discounts" },
  { label: "Billing rules", to: "/settings/billing-rules" },
  { label: "Team", to: "/settings/team" },
  { label: "Audit log", to: "/settings/audit" },
];

/** Every page, for page titles and the command palette (settings pages are listed under Settings). */
export const allNavItems: NavItem[] = mainNavItems.map((item) =>
  item.key === "settings" ? { ...item, children: [...settingsPages, { label: "Settings", to: "/settings" }] } : item,
);
