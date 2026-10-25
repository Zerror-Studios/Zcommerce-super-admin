/**
 * Data hooks for the platform analytics screens (PRD-012 FR-8.3)
 *
 * Performance, Integration health and Sync monitor each read one server
 * rollup from the master collections; the store page reads the sync monitor
 * row for its tenant. The re-run action is the only mutation (FR-8.3,
 * `platform:tenants:manage`). Nothing is computed from tenant data here.
 */

import { useMutation, useQuery } from "@apollo/client";
import { useMemo } from "react";
import {
  PLATFORM_ANALYTICS_OVERVIEW,
  PLATFORM_INTEGRATION_HEALTH,
  PLATFORM_RERUN_ANALYTICS_SYNC,
  PLATFORM_SYNC_MONITOR,
} from "../graphql/analytics";
import { toPickerDay } from "../lib/api-report-adapters";
import type { DayRange } from "../lib/analytics-health";
import { useAuth } from "../providers/AuthProvider";
import type {
  IntegrationHealthFilter,
  PlatformAnalyticsOverview,
  PlatformIntegrationHealth,
  PlatformSyncMonitor,
  SyncMonitorRow,
} from "../types/platform-api";

// ─── Types ────────────────────────────────────────────────────────────────

interface HookState<T> {
  data: T;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

export interface IntegrationHealthArgs {
  filter: IntegrationHealthFilter;
  limit: number;
  offset: number;
}

// ─── Reads ────────────────────────────────────────────────────────────────

export function useAnalyticsOverview(range: DayRange): HookState<PlatformAnalyticsOverview | null> {
  const { isAuthenticated } = useAuth();
  const query = useQuery<{ platformAnalyticsOverview: PlatformAnalyticsOverview }>(PLATFORM_ANALYTICS_OVERVIEW, {
    variables: { range: { start: toPickerDay(range.startDate), end: toPickerDay(range.endDate) } },
    skip: !isAuthenticated,
    fetchPolicy: "cache-and-network",
  });
  return {
    data: query.data?.platformAnalyticsOverview ?? null,
    loading: query.loading && !query.data,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

export function useIntegrationHealth({ filter, limit, offset }: IntegrationHealthArgs): HookState<PlatformIntegrationHealth | null> {
  const { isAuthenticated } = useAuth();
  const query = useQuery<{ platformIntegrationHealth: PlatformIntegrationHealth }>(PLATFORM_INTEGRATION_HEALTH, {
    variables: {
      filter: {
        provider: filter.provider || null,
        channelType: filter.channelType || null,
        status: filter.status || null,
        search: filter.search || null,
      },
      limit,
      offset,
    },
    skip: !isAuthenticated,
    fetchPolicy: "cache-and-network",
  });
  return {
    data: query.data?.platformIntegrationHealth ?? null,
    loading: query.loading && !query.data,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

export function useSyncMonitor(skip = false): HookState<PlatformSyncMonitor | null> {
  const { isAuthenticated } = useAuth();
  const query = useQuery<{ platformSyncMonitor: PlatformSyncMonitor }>(PLATFORM_SYNC_MONITOR, {
    skip: !isAuthenticated || skip,
    fetchPolicy: "cache-and-network",
  });
  return {
    data: query.data?.platformSyncMonitor ?? null,
    loading: query.loading && !query.data,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

/** The analytics installations of one store, from the same sync-monitor rollup (the store page). */
export function useTenantSyncRows(tenantId: string | undefined): HookState<SyncMonitorRow[]> {
  const monitor = useSyncMonitor(!tenantId);
  const data = useMemo(
    () => (monitor.data?.installations ?? []).filter((row) => row.tenantId === tenantId),
    [monitor.data, tenantId],
  );
  return { ...monitor, data };
}

// ─── Actions ──────────────────────────────────────────────────────────────

export interface RerunSyncArgs {
  tenantId: string;
  connectionId: string;
}

/**
 * Asks the scheduler for an incremental sync of one connection; it picks the
 * request up within a minute. Re-reads the monitor so the pending chip shows.
 */
export function useRerunAnalyticsSync() {
  const [mutate, { loading }] = useMutation<{ platformRerunAnalyticsSync: boolean }>(PLATFORM_RERUN_ANALYTICS_SYNC, {
    refetchQueries: [{ query: PLATFORM_SYNC_MONITOR }],
    awaitRefetchQueries: true,
  });
  const rerun = async ({ tenantId, connectionId }: RerunSyncArgs): Promise<boolean> => {
    const result = await mutate({ variables: { tenantId, connectionId } });
    return result.data?.platformRerunAnalyticsSync ?? false;
  };
  return { rerun, loading };
}
