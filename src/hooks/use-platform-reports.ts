/**
 * Data hooks for the billing and report screens (PRD-005 Phase 3)
 *
 * Each hook reads one server rollup and maps it onto the report row types
 * (`lib/api-report-adapters`). Money is never computed in the browser.
 */

import { useQuery } from "@apollo/client";
import { useCallback, useMemo, useState } from "react";
import {
  PLATFORM_COUPONS,
  PLATFORM_INVOICES,
  PLATFORM_PAYMENTS,
} from "../graphql/billing";
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
import {
  COUPONS_PAGE_LIMIT,
  INVOICES_PAGE_LIMIT,
  nextOffset,
  PAYMENTS_PAGE_LIMIT,
} from "../lib/offset-paging.util";
import { useAuth } from "../providers/AuthProvider";
import type { Coupon, Transaction } from "../types";
import type {
  PlatformCollections,
  PlatformCoupon,
  PlatformInvoice,
  PlatformInvoiceFilter,
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
}

export interface PaymentsState extends HookState<Transaction[]> {
  /** Payments on the server; more than `data.length` means `loadMore` has more (FE-09). */
  totalCount: number;
  hasMore: boolean;
  loadingMore: boolean;
  /** Reads the next page (the API caps a page at 200). */
  loadMore: () => Promise<void>;
}

/** Platform payments, newest first, a page of 200 at a time (PRD-014 FE-09). */
export function usePayments({ tenantId }: PaymentsArgs = {}): PaymentsState {
  const { isAuthenticated } = useAuth();
  const query = useQuery<{ platformPayments: PlatformList<PlatformPayment> }>(PLATFORM_PAYMENTS, {
    variables: { filter: tenantId ? { tenantId } : null, limit: PAYMENTS_PAGE_LIMIT, offset: 0 },
    skip: !isAuthenticated,
    fetchPolicy: "cache-and-network",
  });
  const page = query.data?.platformPayments;
  const data = useMemo(() => (page?.items ?? []).map(toTransaction), [page]);
  const [lastPageSize, setLastPageSize] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const offset = nextOffset(page, PAYMENTS_PAGE_LIMIT, lastPageSize);
  const { fetchMore } = query;
  const loadMore = useCallback(async () => {
    if (offset === null) return;
    setLoadingMore(true);
    try {
      const result = await fetchMore({ variables: { offset } });
      setLastPageSize(result.data.platformPayments.items.length);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchMore, offset]);
  const { refetch: refetchPayments } = query;
  const refetch = useCallback(async () => {
    setLastPageSize(null);
    return await refetchPayments();
  }, [refetchPayments]);
  return {
    data,
    loading: query.loading && !query.data,
    error: query.error ?? null,
    refetch,
    totalCount: page?.totalCount ?? data.length,
    hasMore: offset !== null,
    loadingMore,
    loadMore,
  };
}

export interface CouponsState extends HookState<Coupon[]> {
  /** Coupons on the server (`platformCouponCount`). */
  totalCount: number;
  hasMore: boolean;
  loadingMore: boolean;
  /** Reads the next page of 100 (the API's cap). */
  loadMore: () => Promise<void>;
}

/** Platform coupons, newest first, a page of 100 at a time (PRD-014 close-out). */
export function useCoupons(): CouponsState {
  const { isAuthenticated } = useAuth();
  const query = useQuery<{ platformCoupons: PlatformCoupon[]; platformCouponCount: number }>(
    PLATFORM_COUPONS,
    {
      variables: { limit: COUPONS_PAGE_LIMIT, offset: 0 },
      skip: !isAuthenticated,
      fetchPolicy: "cache-and-network",
    },
  );
  const rows = query.data?.platformCoupons;
  const totalCount = query.data?.platformCouponCount ?? rows?.length ?? 0;
  const page = useMemo(
    () => (rows ? { items: rows, totalCount } : undefined),
    [rows, totalCount],
  );
  const data = useMemo(() => (rows ?? []).map(toCoupon), [rows]);
  const [lastPageSize, setLastPageSize] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const offset = nextOffset(page, COUPONS_PAGE_LIMIT, lastPageSize);
  const { fetchMore } = query;
  const loadMore = useCallback(async () => {
    if (offset === null) return;
    setLoadingMore(true);
    try {
      const result = await fetchMore({ variables: { offset } });
      setLastPageSize(result.data.platformCoupons.length);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchMore, offset]);
  const { refetch: refetchCoupons } = query;
  const refetch = useCallback(async () => {
    setLastPageSize(null);
    return await refetchCoupons();
  }, [refetchCoupons]);
  return {
    data,
    loading: query.loading && !query.data,
    error: query.error ?? null,
    refetch,
    totalCount,
    hasMore: offset !== null,
    loadingMore,
    loadMore,
  };
}

// ─── Raw lists (PRD-016 FR-19, PRD-017 FR-4.3) ────────────────────────────

export interface PagedListState<T> extends HookState<T[]> {
  totalCount: number;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => Promise<void>;
}

/** Platform invoices with a server filter, 100 a page (PRD-017 FR-4.3). */
export function useInvoices(
  filter: PlatformInvoiceFilter | null,
  options: { skip?: boolean } = {},
): PagedListState<PlatformInvoice> {
  const { isAuthenticated } = useAuth();
  const query = useQuery<{ platformInvoices: PlatformList<PlatformInvoice> }>(
    PLATFORM_INVOICES,
    {
      variables: { filter, limit: INVOICES_PAGE_LIMIT, offset: 0 },
      skip: !isAuthenticated || options.skip === true,
      fetchPolicy: "cache-and-network",
    },
  );
  const page = query.data?.platformInvoices;
  const data = useMemo(() => page?.items ?? [], [page]);
  const [lastPageSize, setLastPageSize] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const offset = nextOffset(page, INVOICES_PAGE_LIMIT, lastPageSize);
  const { fetchMore, refetch: refetchInvoices } = query;
  const loadMore = useCallback(async () => {
    if (offset === null) return;
    setLoadingMore(true);
    try {
      const result = await fetchMore({ variables: { offset } });
      setLastPageSize(result.data.platformInvoices.items.length);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchMore, offset]);
  const refetch = useCallback(async () => {
    setLastPageSize(null);
    return await refetchInvoices();
  }, [refetchInvoices]);
  return {
    data,
    loading: query.loading && !query.data,
    error: query.error ?? null,
    refetch,
    totalCount: page?.totalCount ?? data.length,
    hasMore: offset !== null,
    loadingMore,
    loadMore,
  };
}

/** The review queue: flagged, unresolved payments (PRD-016 FR-19). */
export function useFlaggedPayments(): PagedListState<PlatformPayment> {
  const { isAuthenticated } = useAuth();
  const query = useQuery<{ platformPayments: PlatformList<PlatformPayment> }>(
    PLATFORM_PAYMENTS,
    {
      variables: { filter: { flagged: true }, limit: PAYMENTS_PAGE_LIMIT, offset: 0 },
      skip: !isAuthenticated,
      fetchPolicy: "cache-and-network",
    },
  );
  const page = query.data?.platformPayments;
  const data = useMemo(() => page?.items ?? [], [page]);
  const [lastPageSize, setLastPageSize] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const offset = nextOffset(page, PAYMENTS_PAGE_LIMIT, lastPageSize);
  const { fetchMore, refetch: refetchPayments } = query;
  const loadMore = useCallback(async () => {
    if (offset === null) return;
    setLoadingMore(true);
    try {
      const result = await fetchMore({ variables: { offset } });
      setLastPageSize(result.data.platformPayments.items.length);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchMore, offset]);
  const refetch = useCallback(async () => {
    setLastPageSize(null);
    return await refetchPayments();
  }, [refetchPayments]);
  return {
    data,
    loading: query.loading && !query.data,
    error: query.error ?? null,
    refetch,
    totalCount: page?.totalCount ?? data.length,
    hasMore: offset !== null,
    loadingMore,
    loadMore,
  };
}
