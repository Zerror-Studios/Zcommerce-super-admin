/**
 * Data hooks for the Super Admin AI screens (backend PRD-026, guide §3–§5)
 *
 * - `usePlatformAttention`: the Home page, one call.
 * - `usePlatformMetrics(period)`: one period of the nightly snapshot for
 *   the tabs; `null` before the first snapshot.
 * - `useRefreshPlatformMetrics`: Refresh now. On success every snapshot
 *   query refetches; the button stays off until `refreshAvailableAt`
 *   (also after a `REFRESH_COOLDOWN` refusal). A failed refresh doesn't
 *   use the cooldown up.
 *
 * All need `platform:tenants:read`; the server leaves out what the viewer
 * may not see (money, AI cost), so screens gate on what came back.
 */

import { useMutation, useQuery } from "@apollo/client";
import { useCallback, useEffect, useState } from "react";

import {
  PLATFORM_ATTENTION,
  PLATFORM_METRICS,
  REFRESH_PLATFORM_METRICS,
} from "../graphql/platform-insights";
import { isRefreshCoolingDown, refreshErrorState } from "../lib/platform-insights.util";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { useAuth } from "../providers/AuthProvider";
import type {
  PlatformAttention,
  PlatformMetricsPeriod,
  PlatformMetricsRefresh,
  PlatformMetricsSnapshot,
} from "../types/platform-insights";

// ─── Types ────────────────────────────────────────────────────────────────

interface HookState<T> {
  data: T;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

export interface RefreshState {
  /** False without `platform:reports:read`: hide the button. */
  canRefresh: boolean;
  refreshing: boolean;
  /** Set while the cooldown runs ("Available at 3:42 pm"). */
  refreshAvailableAt: string | null;
  coolingDown: boolean;
  /** The last refusal's copy, cleared on the next try. */
  error: string | null;
  /** True right after a refresh: "Updated just now". */
  justUpdated: boolean;
  refresh: () => Promise<void>;
}

/** Only one instance's state survives a page change; keep the cooldown. */
let lastAvailableAt: string | null = null;

// ─── Reads ────────────────────────────────────────────────────────────────

function useCanReadTenants(): boolean {
  const { isAuthenticated, can } = useAuth();
  return isAuthenticated && can(PLATFORM_PERMISSIONS.TENANTS_READ);
}

export function usePlatformAttention(): HookState<PlatformAttention | null> {
  const canRead = useCanReadTenants();
  const query = useQuery<{ platformAttention: PlatformAttention }>(PLATFORM_ATTENTION, {
    skip: !canRead,
    fetchPolicy: "cache-and-network",
  });
  return {
    data: query.data?.platformAttention ?? null,
    loading: query.loading && !query.data,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

export function usePlatformMetrics(
  period: PlatformMetricsPeriod,
): HookState<PlatformMetricsSnapshot | null> {
  const canRead = useCanReadTenants();
  const query = useQuery<{ platformMetrics: PlatformMetricsSnapshot | null }>(PLATFORM_METRICS, {
    variables: { period },
    skip: !canRead,
    fetchPolicy: "cache-and-network",
  });
  return {
    data: query.data?.platformMetrics ?? null,
    loading: query.loading && !query.data,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

// ─── Refresh now ──────────────────────────────────────────────────────────

export function useRefreshPlatformMetrics(): RefreshState {
  const { can } = useAuth();
  const canRefresh = can(PLATFORM_PERMISSIONS.REPORTS_READ);
  const [availableAt, setAvailableAt] = useState<string | null>(lastAvailableAt);
  const [error, setError] = useState<string | null>(null);
  const [justUpdated, setJustUpdated] = useState(false);
  const [, setTick] = useState(0);
  const [mutate, { loading }] = useMutation<{ refreshPlatformMetrics: PlatformMetricsRefresh }>(
    REFRESH_PLATFORM_METRICS,
    {
      refetchQueries: ["PlatformAttention", "PlatformMetrics"],
      awaitRefetchQueries: true,
    },
  );

  const coolingDown = isRefreshCoolingDown(availableAt);

  // Re-render when the cooldown ends, so the button comes back by itself
  useEffect(() => {
    if (!availableAt || !coolingDown) return undefined;
    const wait = new Date(availableAt).getTime() - Date.now() + 500;
    const timer = window.setTimeout(() => setTick((n) => n + 1), Math.max(wait, 500));
    return () => window.clearTimeout(timer);
  }, [availableAt, coolingDown]);

  const keep = (at: string | null) => {
    lastAvailableAt = at;
    setAvailableAt(at);
  };

  const refresh = useCallback(async () => {
    setError(null);
    setJustUpdated(false);
    try {
      const result = await mutate();
      keep(result.data?.refreshPlatformMetrics.refreshAvailableAt ?? null);
      setJustUpdated(true);
    } catch (caught) {
      const state = refreshErrorState(caught);
      if (state.refreshAvailableAt) keep(state.refreshAvailableAt);
      setError(state.message);
    }
  }, [mutate]);

  return {
    canRefresh,
    refreshing: loading,
    refreshAvailableAt: coolingDown ? availableAt : null,
    coolingDown,
    error,
    justUpdated,
    refresh,
  };
}
