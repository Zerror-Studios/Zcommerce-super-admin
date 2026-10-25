/**
 * Store sales (what stores sell to their own customers), from the usage
 * snapshot each tenant carries (`revenue30d` as net revenue, `orders30d`,
 * `growthPercent`, and since PRD-012 FR-8.2 `sessions30d`, `pageViews30d`
 * and the server's `conversionRate30d`). Every figure covers the last 30 days
 * and compares with the 30 days before. growthPercent −100 means "no previous
 * sales". Traffic and conversion are shown as the server sent them.
 */

import type { Client } from "../types";

export interface StoreSalesRow {
  clientId: string;
  storeName: string;
  ownerEmail: string;
  plan: Client["plan"];
  status: Client["status"];
  /** Net sales in the last 30 days. */
  sales: number;
  orders: number;
  /** Average order value; null without orders. */
  averageOrder: number | null;
  /** Change vs the previous 30 days; null when there were no sales then. */
  changePercent: number | null;
  /** GA4 sessions in the last 30 days; 0 without analytics. */
  sessions: number;
  pageViews: number;
  /** Server conversion rate (percent); null without sessions. */
  conversionRate: number | null;
}

/** Sales in the previous 30 days, worked back from the current sales and the change. */
function previousSales(client: Client): number {
  return client.growthPercent <= -100 ? 0 : client.revenue / (1 + client.growthPercent / 100);
}

export function storeSalesRows(clients: Client[]): StoreSalesRow[] {
  return clients
    .map((client) => ({
      clientId: client.id,
      storeName: client.storeName,
      ownerEmail: client.ownerEmail,
      plan: client.plan,
      status: client.status,
      sales: client.revenue,
      orders: client.orders30d,
      averageOrder: client.orders30d > 0 ? client.revenue / client.orders30d : null,
      changePercent: client.growthPercent <= -100 ? null : client.growthPercent,
      sessions: client.sessions30d,
      pageViews: client.pageViews30d,
      conversionRate: client.sessions30d > 0 ? client.conversionRate30d : null,
    }))
    .sort((a, b) => b.sales - a.sales);
}

export interface StoreSalesSummary {
  sales: number;
  orders: number;
  averageOrder: number | null;
  /** Total sales change vs the previous 30 days; null when nothing sold then. */
  changePercent: number | null;
  /** Stores with at least one order in the last 30 days. */
  sellingStores: number;
  /** Stores whose analytics reported at least one session (PRD-012 FR-8.3). */
  storesWithTraffic: number;
  totalStores: number;
}

export function storeSalesSummary(clients: Client[]): StoreSalesSummary {
  const sales = clients.reduce((sum, client) => sum + client.revenue, 0);
  const orders = clients.reduce((sum, client) => sum + client.orders30d, 0);
  const previous = clients.reduce((sum, client) => sum + previousSales(client), 0);
  return {
    sales,
    orders,
    averageOrder: orders > 0 ? sales / orders : null,
    changePercent: previous > 0 ? ((sales - previous) / previous) * 100 : null,
    sellingStores: clients.filter((client) => client.orders30d > 0).length,
    storesWithTraffic: clients.filter((client) => client.sessions30d > 0).length,
    totalStores: clients.length,
  };
}

export interface StoreSalesByPlan {
  plan: Client["plan"];
  sales: number;
  orders: number;
  stores: number;
  sharePercent: number;
}

export function storeSalesByPlan(clients: Client[]): StoreSalesByPlan[] {
  const total = clients.reduce((sum, client) => sum + client.revenue, 0);
  const plans = [...new Set(clients.map((client) => client.plan))];
  return plans
    .map((plan) => {
      const group = clients.filter((client) => client.plan === plan);
      const sales = group.reduce((sum, client) => sum + client.revenue, 0);
      return {
        plan,
        sales,
        orders: group.reduce((sum, client) => sum + client.orders30d, 0),
        stores: group.length,
        sharePercent: total > 0 ? (sales / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.sales - a.sales);
}

/** Stores whose sales fell by this much or more are flagged on Store sales. */
export const SALES_DROP_ALERT_PERCENT = 20;
