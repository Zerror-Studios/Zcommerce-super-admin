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
      { label: "Transactions", to: "/billing/transactions" },
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
    ],
  },
  // A single link: /settings lists every setting as cards (pages/Settings.tsx), like Merchant Admin.
  { key: "settings", label: "Settings", to: "/settings", icon: IconSettings },
];

/** Pages behind the Settings cards. */
export const settingsPages = [
  { label: "Discounts", to: "/settings/discounts" },
  { label: "Billing rules", to: "/settings/billing-rules" },
  { label: "Team", to: "/settings/team" },
  { label: "Audit log", to: "/settings/audit" },
];

/** Every page, for page titles and the command palette (settings pages are listed under Settings). */
export const allNavItems: NavItem[] = mainNavItems.map((item) =>
  item.key === "settings" ? { ...item, children: [...settingsPages, { label: "Settings", to: "/settings" }] } : item,
);
