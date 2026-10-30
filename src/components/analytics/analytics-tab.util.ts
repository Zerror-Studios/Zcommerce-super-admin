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

