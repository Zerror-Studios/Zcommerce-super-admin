import type { NavItem } from "../components/layout/types";
import { IconAnalytics, IconBilling, IconHome, IconSettings, IconStore } from "../components/ui/icons";

/**
 * Super Admin navigation (docs/design/04-super-admin.md §1). URLs are unchanged from before the restyle;
 * "Clients" is shown as "Stores" (the /clients → /stores rename comes with the Stores page in Phase 6).
 */
export const mainNavItems: NavItem[] = [
  { key: "home", label: "Home", to: "/", end: true, icon: IconHome },
  { key: "stores", label: "Stores", to: "/clients", icon: IconStore },
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
];

/** Pinned to the bottom of the sidebar. */
export const settingsNavItem: NavItem = {
  key: "settings",
  label: "Settings",
  to: "/settings",
  icon: IconSettings,
  children: [
    { label: "Discounts", to: "/settings/discounts" },
    { label: "Payment reminders", to: "/settings/automation" },
  ],
};

export const allNavItems: NavItem[] = [...mainNavItems, settingsNavItem];
