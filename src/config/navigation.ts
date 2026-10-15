import type { NavItem } from "../components/layout/types";
import { IconAnalytics, IconBilling, IconCustomers, IconHome, IconSettings } from "../components/ui/icons";

/** Super Admin navigation (project-specific; the Sidebar component is shared). */
export const mainNavItems: NavItem[] = [
  { key: "home", label: "Home", to: "/", end: true, icon: IconHome },
  { key: "clients", label: "Clients", to: "/clients", icon: IconCustomers },
  {
    key: "billing",
    label: "Billing",
    to: "/billing",
    icon: IconBilling,
    children: [
      { label: "Subscriptions", to: "/billing/subscriptions" },
      { label: "Transactions", to: "/billing/transactions" },
    ],
  },
  {
    key: "analytics",
    label: "Analytics",
    to: "/analytics",
    icon: IconAnalytics,
    children: [{ label: "Revenue Reports", to: "/analytics/revenue" }],
  },
  {
    key: "settings",
    label: "Settings",
    to: "/settings",
    icon: IconSettings,
    children: [
      { label: "Discounts", to: "/settings/discounts" },
      { label: "Automation", to: "/settings/automation" },
    ],
  },
];
