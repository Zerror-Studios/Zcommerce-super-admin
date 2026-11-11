/**
 * Non-component helpers for the Analytics tabs (04 S-05): the export registration, store links and the full ₹
 * axis labels (01 §7.25: never "k", "L" or "Cr").
 */
import { useEffect } from "react";
import { formatCount, formatMoney } from "../ui";
import type { RegisterExport } from "./analytics-shared";

/** Keeps the header's Export pointed at this tab's latest data; clears it when the tab leaves. */
export function useRegisterExport(register: RegisterExport | undefined, exporter: (() => void) | null) {
  useEffect(() => {
    register?.(exporter);
  }, [register, exporter]);
  useEffect(() => () => register?.(null), [register]);
}

/** Store rows open the store detail (S-05 change 4). */
export const storeHref = (tenantId: string) => `/stores/${tenantId}/overview`;

/** Left axis: full rupees with Indian grouping ("₹1,80,000"). */
export const moneyAxis = (value: number) => formatMoney(value, { whole: true });
/** Right axis: plain counts ("12,000"). */
export const countAxis = (value: number) => formatCount(value);
/** Wide enough for "₹10,00,000" at 12px. */
export const MONEY_AXIS_WIDTH = 84;
export const COUNT_AXIS_WIDTH = 56;

export const legendProps = {
  verticalAlign: "top",
  align: "right",
  iconType: "circle",
  iconSize: 8,
  height: 28,
  wrapperStyle: { fontSize: 12 },
} as const;

/**
 * Analytics › Stores sub-tabs (Analytics Level 1 §3.7): the old Stores and System (performance) pages in one, kept in
 * the URL as `?tab=` (Overview has none).
 */
export const STORES_SUB_TABS = [
  { value: "overview", label: "Overview" },
  { value: "top", label: "Top stores" },
  { value: "needs-look", label: "Needs a look" },
] as const;

export type StoresSubTab = (typeof STORES_SUB_TABS)[number]["value"];

export const isStoresSubTab = (value: string | null | undefined): value is StoresSubTab =>
  STORES_SUB_TABS.some((tab) => tab.value === value);

/**
 * `platformAnalyticsOverview` and `platformStoreSales` take any window of 1 to 366 days (backend
 * `dailyWindows`), so the shared date picker maps straight onto them; it offers no day before this many days ago.
 */
export const STORES_MAX_WINDOW_DAYS = 366;
