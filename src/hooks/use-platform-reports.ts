/**
 * Data hooks for the billing and report screens (PRD-005 Phase 3)
 *
 * Each hook reads one server rollup and maps it onto the report row types
 * (`lib/api-report-adapters`). Money is never computed in the browser.
 */

import { useQuery } from "@apollo/client";
import { useMemo } from "react";
import { PLATFORM_COUPONS, PLATFORM_PAYMENTS } from "../graphql/billing";
import { PLATFORM_COLLECTIONS, PLATFORM_REVENUE_OVERVIEW } from "../graphql/reports";
import {
  EMPTY_REVENUE,
  toCollectionsView,
  toCoupon,
  toPickerDay,
  toRevenueView,
  toTransaction,
  type CollectionsView,
  type RevenueView,
} from "../lib/api-report-adapters";
import { useAuth } from "../providers/AuthProvider";
import type { Coupon, Transaction } from "../types";
import type {
  PlatformCollections,
  PlatformCoupon,
  PlatformList,
  PlatformPayment,
  PlatformRevenueOverview,
} from "../types/platform-api";

// ─── Types ────────────────────────────────────────────────────────────────

interface HookState<T> {
  data: T;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

// ─── Hooks ────────────────────────────────────────────────────────────────

export function useRevenueOverview(range: { startDate: Date; endDate: Date }): HookState<RevenueView> {
  const { isAuthenticated } = useAuth();
  const query = useQuery<{ platformRevenueOverview: PlatformRevenueOverview }>(PLATFORM_REVENUE_OVERVIEW, {
    variables: { range: { start: toPickerDay(range.startDate), end: toPickerDay(range.endDate) } },
    skip: !isAuthenticated,
    fetchPolicy: "cache-and-network",
  });
  const data = useMemo(
    () => (query.data ? toRevenueView(query.data.platformRevenueOverview) : EMPTY_REVENUE),
    [query.data],
  );
  return {
    data,
    loading: query.loading && !query.data,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

export interface CollectionsArgs {
  startDate: Date;
  endDate: Date;
  drill?: string;
  search?: string;
  planId?: string | null;
  health?: "all" | "healthy" | "at_risk" | "unhealthy";
}

export function useCollections(args: CollectionsArgs): HookState<CollectionsView | null> {
  const { isAuthenticated } = useAuth();
  const query = useQuery<{ platformCollections: PlatformCollections }>(PLATFORM_COLLECTIONS, {
    variables: {
      range: { start: toPickerDay(args.startDate), end: toPickerDay(args.endDate) },
      drill: args.drill ?? "all",
      search: args.search || null,
      planId: args.planId || null,
      health: args.health ?? "all",
    },
    skip: !isAuthenticated,
    fetchPolicy: "cache-and-network",
  });
  const data = useMemo(
    () => (query.data ? toCollectionsView(query.data.platformCollections) : null),
    [query.data],
  );
  return {
    data,
    loading: query.loading && !query.data,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

export interface PaymentsArgs {
  /** One store's payments (the store page); omitted for the Transactions page. */
  tenantId?: string;
  limit?: number;
}

/** Platform payments, newest first. */
export function usePayments({ tenantId, limit = 200 }: PaymentsArgs = {}): HookState<Transaction[]> {
  const { isAuthenticated } = useAuth();
  const query = useQuery<{ platformPayments: PlatformList<PlatformPayment> }>(PLATFORM_PAYMENTS, {
    variables: { filter: tenantId ? { tenantId } : null, limit, offset: 0 },
    skip: !isAuthenticated,
    fetchPolicy: "cache-and-network",
  });
  const data = useMemo(
    () => (query.data?.platformPayments.items ?? []).map(toTransaction),
    [query.data],
  );
  return {
    data,
    loading: query.loading && !query.data,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

export function useCoupons(): HookState<Coupon[]> {
  const { isAuthenticated } = useAuth();
  const query = useQuery<{ platformCoupons: PlatformCoupon[] }>(PLATFORM_COUPONS, {
    skip: !isAuthenticated,
    fetchPolicy: "cache-and-network",
  });
  const data = useMemo(() => (query.data?.platformCoupons ?? []).map(toCoupon), [query.data]);
  return {
    data,
    loading: query.loading && !query.data,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}
