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
  PLATFORM_INVOICE_DETAIL,
  PLATFORM_INVOICES,
  PLATFORM_PAYMENTS,
} from "../graphql/billing";
import {
  PLATFORM_COLLECTIONS,
  PLATFORM_JOB_RUNS,
  PLATFORM_MRR_HISTORY,
  PLATFORM_REMINDER_LOG,
  PLATFORM_REVENUE_OVERVIEW,
} from "../graphql/reports";
import {
  EMPTY_REVENUE,
  couponStatusesOf,
  paymentsFilterOf,
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
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import {
  mrrHistoryWindow,
  paymentStatusCounts,
  type PaymentStatusCounts,
} from "../lib/platform-history.util";
import { useAuth } from "../providers/AuthProvider";
import type { Coupon, Transaction } from "../types";
import type {
  PlatformCollections,
  PlatformCoupon,
  PlatformInvoice,
  PlatformInvoiceFilter,
  PlatformJobRun,
  PlatformList,
  PlatformMrrDay,
  PlatformPayment,
  PlatformReminderLogEntry,
  PlatformRevenueOverview,
  PlatformStatusCount,
} from "../types/platform-api";

/** `platformPayments` with the PRD-024 FR-3.5 counts. */
type PaymentPage = PlatformList<PlatformPayment> & { countsByStatus?: PlatformStatusCount[] };

// ─── Types ────────────────────────────────────────────────────────────────

interface HookState<T> {
  data: T;
  loading: boolean;
  /** A newer answer is loading while the previous one stays on screen (faded rows, 09 §3.2). */
  reloading?: boolean;
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
  // Keep the last answer on screen while a new range loads (no skeleton flash).
  const raw = query.data ?? query.previousData;
  const data = useMemo(
    () => (raw ? toRevenueView(raw.platformRevenueOverview) : EMPTY_REVENUE),
    [raw],
  );
  return {
    data,
    loading: query.loading && !raw,
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
  // Keep the last answer on screen while new filters load (no skeleton flash).
  const raw = query.data ?? query.previousData;
  const data = useMemo(
    () => (raw ? toCollectionsView(raw.platformCollections) : null),
    [raw],
  );
  return {
    data,
    loading: query.loading && !raw,
    reloading: query.loading && !!raw,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

export interface PaymentsArgs {
  /** One store's payments (the store page); omitted for the Transactions page. */
  tenantId?: string;
  /** Don't fetch (the screen that needs it is not shown). */
  skip?: boolean;
  /** PRD-024 FR-1.6: server-side search (store name, slug, transaction id). */
  search?: string;
  /** PRD-024 FR-1.6: console statuses (`success`, `pending`, …), filtered on the server. */
  statuses?: readonly string[];
}

export interface PaymentsState extends HookState<Transaction[]> {
  /** Payments on the server; more than `data.length` means `loadMore` has more (FE-09). */
  totalCount: number;
  /** PRD-024 FR-3.5: the server's counts per status, under every filter except status. */
  statusCounts: PaymentStatusCounts;
  hasMore: boolean;
  loadingMore: boolean;
  /** Reads the next page (the API caps a page at 200). */
  loadMore: () => Promise<void>;
}

/** Platform payments, newest first, a page of 200 at a time (PRD-014 FE-09). */
export function usePayments({ tenantId, skip = false, search, statuses }: PaymentsArgs = {}): PaymentsState {
  const { isAuthenticated } = useAuth();
  const statusKey = (statuses ?? []).join();
  const filter = useMemo(
    () => paymentsFilterOf({ tenantId, search, statuses: statusKey ? statusKey.split(",") : [] }),
    [search, statusKey, tenantId],
  );
  const query = useQuery<{ platformPayments: PaymentPage }>(PLATFORM_PAYMENTS, {
    variables: { filter, limit: PAYMENTS_PAGE_LIMIT, offset: 0 },
    skip: skip || !isAuthenticated,
    fetchPolicy: "cache-and-network",
  });
  const page = query.data?.platformPayments;
  const data = useMemo(() => (page?.items ?? []).map(toTransaction), [page]);
  const statusCounts = useMemo(() => paymentStatusCounts(page?.countsByStatus), [page]);
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
    statusCounts,
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

export interface CouponsArgs {
  skip?: boolean;
  /** PRD-024 FR-3.5: server search (code or plan). */
  search?: string;
  /** PRD-024 FR-3.5: console statuses (`active`, `inactive`, `expired`), filtered on the server. */
  statuses?: readonly string[];
}

/** Platform coupons, newest first, a page of 100 at a time (PRD-014 close-out). */
export function useCoupons({ skip = false, search, statuses }: CouponsArgs = {}): CouponsState {
  const { isAuthenticated } = useAuth();
  const statusKey = (statuses ?? []).join();
  const status = useMemo(
    () => couponStatusesOf(statusKey ? statusKey.split(",") : []),
    [statusKey],
  );
  const query = useQuery<{ platformCoupons: PlatformCoupon[]; platformCouponCount: number }>(
    PLATFORM_COUPONS,
    {
      variables: { limit: COUPONS_PAGE_LIMIT, offset: 0, search: search?.trim() || null, status },
      skip: skip || !isAuthenticated,
      fetchPolicy: "cache-and-network",
    },
  );
  // Keep the last rows on screen while new filters load (the table stays mounted).
  const shown = query.data ?? query.previousData;
  const rows = shown?.platformCoupons;
  const totalCount = shown?.platformCouponCount ?? rows?.length ?? 0;
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
    loading: query.loading && !shown,
    reloading: query.loading && !!shown,
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

// ─── PRD-024 Phase C reads ────────────────────────────────────────────────

/**
 * FR-3.1 (reports:read): recorded MRR days for the picker range (cut to the
 * server's 731 days). Days before the first snapshot are absent.
 */
export function useMrrHistory(range: { startDate: Date; endDate: Date }): HookState<PlatformMrrDay[]> {
  const { isAuthenticated, can } = useAuth();
  const historyWindow = mrrHistoryWindow(range.startDate, range.endDate);
  const query = useQuery<{ platformMrrHistory: PlatformMrrDay[] }>(PLATFORM_MRR_HISTORY, {
    variables: historyWindow,
    skip: !isAuthenticated || !can(PLATFORM_PERMISSIONS.REPORTS_READ),
    fetchPolicy: "cache-and-network",
  });
  const raw = query.data ?? query.previousData;
  const data = useMemo(() => raw?.platformMrrHistory ?? [], [raw]);
  return {
    data,
    loading: query.loading && !raw,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

export interface ReminderLogState extends HookState<PlatformReminderLogEntry[]> {
  totalCount: number;
}

/** FR-3.9 (billing:read): reminders sent, newest first; one store with `tenantId`. */
export function useReminderLog(
  { tenantId, limit, offset }: { tenantId?: string; limit: number; offset: number },
): ReminderLogState {
  const { isAuthenticated, can } = useAuth();
  const query = useQuery<{ platformReminderLog: PlatformList<PlatformReminderLogEntry> }>(
    PLATFORM_REMINDER_LOG,
    {
      variables: { tenantId: tenantId ?? null, limit, offset },
      skip: !isAuthenticated || !can(PLATFORM_PERMISSIONS.BILLING_READ),
      fetchPolicy: "cache-and-network",
    },
  );
  const raw = query.data ?? query.previousData;
  const data = useMemo(() => raw?.platformReminderLog.items ?? [], [raw]);
  return {
    data,
    loading: query.loading && !raw,
    reloading: query.loading && !!raw,
    error: query.error ?? null,
    refetch: query.refetch,
    totalCount: raw?.platformReminderLog.totalCount ?? 0,
  };
}

/** FR-3.10 (settings:manage): the platform jobs' latest runs, newest first. */
export function useJobRuns({ limit, skip = false }: { limit: number; skip?: boolean }): HookState<PlatformJobRun[]> {
  const { isAuthenticated, can } = useAuth();
  const query = useQuery<{ platformJobRuns: PlatformJobRun[] }>(PLATFORM_JOB_RUNS, {
    variables: { job: null, limit },
    skip: skip || !isAuthenticated || !can(PLATFORM_PERMISSIONS.SETTINGS_MANAGE),
    fetchPolicy: "cache-and-network",
  });
  const data = useMemo(() => query.data?.platformJobRuns ?? [], [query.data]);
  return {
    data,
    loading: query.loading && !query.data,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

/** Rows the detail read asks for: the invoice search matches numbers by substring. */
const INVOICE_DETAIL_LIMIT = 10;

/**
 * FR-3.8 (billing:read): one invoice's status history and linked payments,
 * read when its detail dialog opens.
 */
export function useInvoiceDetail(
  invoice: Pick<PlatformInvoice, "id" | "tenantId" | "number"> | null,
): HookState<Pick<PlatformInvoice, "statusHistory" | "payments"> | null> {
  const { isAuthenticated, can } = useAuth();
  const query = useQuery<{ platformInvoices: PlatformList<Pick<PlatformInvoice, "id" | "statusHistory" | "payments">> }>(
    PLATFORM_INVOICE_DETAIL,
    {
      variables: invoice
        ? { filter: { tenantId: invoice.tenantId, search: invoice.number }, limit: INVOICE_DETAIL_LIMIT }
        : undefined,
      skip: !invoice || !isAuthenticated || !can(PLATFORM_PERMISSIONS.BILLING_READ),
      fetchPolicy: "cache-and-network",
    },
  );
  const data = useMemo(
    () => query.data?.platformInvoices.items.find((item) => item.id === invoice?.id) ?? null,
    [invoice?.id, query.data],
  );
  return {
    data,
    loading: query.loading && !query.data,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}
