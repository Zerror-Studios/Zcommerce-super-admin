import type { NavItem } from "../components/layout/types";
import { IconAnalytics, IconBilling, IconHome, IconSettings, IconStore } from "../components/ui/icons";

/**
 * Super Admin navigation (docs/design/04-super-admin.md §1). Billing and settings URLs are unchanged;
 * Stores live at /stores (old /clients URLs redirect, see App.tsx).
 */
export const mainNavItems: NavItem[] = [
  { key: "home", label: "Home", to: "/", end: true, icon: IconHome },
  { key: "stores", label: "Stores", to: "/stores", icon: IconStore },
  {
    key: "billing",
    label: "Billing",
    to: "/billing",
    icon: IconBilling,
    children: [
      { label: "Collections", to: "/billing/subscriptions" },
      { label: "Transactions", to: "/billing/transactions" },
    ],
  },
  {
    key: "analytics",
    label: "Analytics",
    to: "/analytics",
    icon: IconAnalytics,
    children: [{ label: "Revenue", to: "/analytics/revenue" }],
  },
  {
    key: "settings",
    label: "Settings",
    to: "/settings",
    icon: IconSettings,
    children: [
      { label: "Discounts", to: "/settings/discounts" },
      { label: "Payment reminders", to: "/settings/automation" },
      { label: "Account", to: "/settings/account" },
    ],
  },
];

export const allNavItems: NavItem[] = mainNavItems;
