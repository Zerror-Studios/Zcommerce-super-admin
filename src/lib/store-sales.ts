/**
 * Store sales (what stores sell to their own customers), from the server
 * rollup `platformStoreSales` (PRD-024 FR-3.4). The server sums each
 * store's daily figures over the chosen window and the window before it,
 * computes growth (null when the window before sold nothing) and reports
 * totals per currency. Nothing is summed or worked back in the browser.
 */

import type {
  PlatformStoreSales,
  PlatformStoreSalesRow,
  PlatformStoreSalesTotal,
} from "../types/platform-api";

// ─── Constants ────────────────────────────────────────────────────────────

/** Stores whose sales fell by this much or more are flagged on Store sales. */
export const SALES_DROP_ALERT_PERCENT = 20;

/** Rows per page of `platformStoreSales` (the API caps a page at 100). */
export const STORE_SALES_PAGE_LIMIT = 100;

/** PRD-024 FR-2.1: what a null growth means, wherever it shows as "—". */
export const NO_PREVIOUS_SALES_COPY = "No previous sales to compare";

// ─── Types ────────────────────────────────────────────────────────────────

export interface StoreSalesRow {
  clientId: string;
  storeName: string;
  slug: string;
  currency: string;
  /** Net sales in the window. */
  sales: number;
  orders: number;
  previousSales: number;
  previousOrders: number;
  /** Server average order value; null without orders. */
  averageOrder: number | null;
  /** Server growth vs the window before; null when nothing sold then. */
  changePercent: number | null;
}

export interface StoreSalesTotal {
  currency: string;
  sales: number;
  orders: number;
  previousSales: number;
  previousOrders: number;
  /** Net sales ÷ orders of the server totals; null without orders. */
  averageOrder: number | null;
  changePercent: number | null;
  stores: number;
}

export interface StoreSalesView {
  rangeStart: string;
  rangeEnd: string;
  previousStart: string;
  previousEnd: string;
  /** One row per currency, largest first. */
  totals: StoreSalesTotal[];
  rows: StoreSalesRow[];
  totalCount: number;
}

// ─── Mapping ──────────────────────────────────────────────────────────────

export function toStoreSalesRow(row: PlatformStoreSalesRow): StoreSalesRow {
  return {
    clientId: row.tenantId,
    storeName: row.name,
    slug: row.slug,
    currency: row.currency,
    sales: row.revenue,
    orders: row.orders,
    previousSales: row.previousRevenue,
    previousOrders: row.previousOrders,
    averageOrder: row.orders > 0 ? row.averageOrderValue : null,
    changePercent: row.growthPercent,
  };
}

export function toStoreSalesTotal(total: PlatformStoreSalesTotal): StoreSalesTotal {
  return {
    currency: total.currency,
    sales: total.revenue,
    orders: total.orders,
    previousSales: total.previousRevenue,
    previousOrders: total.previousOrders,
    // A ratio of two server totals of one currency, never a sum across stores.
    averageOrder: total.orders > 0 ? total.revenue / total.orders : null,
    changePercent: total.growthPercent,
    stores: total.stores,
  };
}

export function toStoreSalesView(data: PlatformStoreSales): StoreSalesView {
  return {
    rangeStart: data.rangeStart,
    rangeEnd: data.rangeEnd,
    previousStart: data.previousStart,
    previousEnd: data.previousEnd,
    totals: data.totals.map(toStoreSalesTotal).sort((a, b) => b.sales - a.sales),
    rows: data.stores.map(toStoreSalesRow),
    totalCount: data.totalCount,
  };
}

/** No orders in the window, or sales down `SALES_DROP_ALERT_PERCENT` or more. */
export function storesNeedingALook(rows: readonly StoreSalesRow[]): StoreSalesRow[] {
  return rows.filter(
    (row) =>
      row.orders === 0 ||
      (row.changePercent != null && row.changePercent <= -SALES_DROP_ALERT_PERCENT),
  );
}
