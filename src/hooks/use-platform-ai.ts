/**
 * Data hooks for the ZCOM AI screens (PRD-021 FR-6, backend guide §9)
 *
 * Each hook reads one platform-admin query; nothing is computed from
 * tenant data here. Changes are `useMutation` calls in the screens, which
 * the server audits. `aiTopQuestions` is read only when the operator asks
 * for it (`useAiTopQuestions(..., enabled)`), because every read is logged.
 */

import { useQuery } from "@apollo/client";
import {
  AI_BENCHMARKS,
  AI_CONFIG,
  AI_DATA_HEALTH,
  AI_PLATFORM_TOTALS,
  AI_TENANT_SETTING,
  AI_TOP_QUESTIONS,
  AI_TOP_UP_REQUESTS,
  AI_USAGE_BY_TENANT,
} from "../graphql/ai";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { useAuth } from "../providers/AuthProvider";
import type {
  PlatformAiBenchmark,
  PlatformAiBenchmarkPeriod,
  PlatformAiConfig,
  PlatformAiDataHealthList,
  PlatformAiTenantSetting,
  PlatformAiTopQuestion,
  PlatformAiTopUpRequestStatus,
  PlatformAiTopUpRequestList,
  PlatformAiTotals,
  PlatformAiUsageList,
} from "../types/platform-api";

// ─── Types ────────────────────────────────────────────────────────────────

interface HookState<T> {
  data: T;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

export interface AiPageArgs {
  limit: number;
  offset: number;
}

/** PRD-024 FR-1.10 (B-11): the top-ups list by status (the server's default is OPEN). */
export interface AiTopUpArgs extends AiPageArgs {
  status?: PlatformAiTopUpRequestStatus;
}

/** PRD-024 FR-1.10 (B-11): false lists every store with insights, not only those needing attention. */
export interface AiDataHealthArgs extends AiPageArgs {
  needsAttention?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Skip every AI read for a role without `platform:ai:read`. */
function useCanReadAi(): boolean {
  const { isAuthenticated, can } = useAuth();
  return isAuthenticated && can(PLATFORM_PERMISSIONS.AI_READ);
}

// ─── Reads ────────────────────────────────────────────────────────────────

export function useAiPlatformTotals(): HookState<PlatformAiTotals | null> {
  const canRead = useCanReadAi();
  const query = useQuery<{ aiPlatformTotals: PlatformAiTotals }>(AI_PLATFORM_TOTALS, {
    skip: !canRead,
    fetchPolicy: "cache-and-network",
  });
  return {
    data: query.data?.aiPlatformTotals ?? null,
    loading: query.loading && !query.data,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

export function useAiUsageByTenant(
  args: AiPageArgs & { search: string; tenantId?: string },
): HookState<PlatformAiUsageList | null> {
  const canRead = useCanReadAi();
  const query = useQuery<{ aiUsageByTenant: PlatformAiUsageList }>(AI_USAGE_BY_TENANT, {
    // PRD-024 FR-3.6: `tenantId` reads one store's row (the store page).
    variables: { limit: args.limit, offset: args.offset, search: args.search || null, tenantId: args.tenantId ?? null },
    skip: !canRead,
    fetchPolicy: "cache-and-network",
  });
  return {
    data: query.data?.aiUsageByTenant ?? null,
    loading: query.loading && !query.data,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

export function useAiTopUpRequests(args: AiTopUpArgs): HookState<PlatformAiTopUpRequestList | null> {
  const canRead = useCanReadAi();
  const query = useQuery<{ aiTopUpRequests: PlatformAiTopUpRequestList }>(AI_TOP_UP_REQUESTS, {
    variables: { status: args.status ?? "OPEN", limit: args.limit, offset: args.offset },
    skip: !canRead,
    fetchPolicy: "cache-and-network",
  });
  return {
    data: query.data?.aiTopUpRequests ?? null,
    loading: query.loading && !query.data,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

export function useAiDataHealth(args: AiDataHealthArgs): HookState<PlatformAiDataHealthList | null> {
  const canRead = useCanReadAi();
  const query = useQuery<{ aiDataHealth: PlatformAiDataHealthList }>(AI_DATA_HEALTH, {
    variables: { needsAttention: args.needsAttention ?? true, limit: args.limit, offset: args.offset },
    skip: !canRead,
    fetchPolicy: "cache-and-network",
  });
  return {
    data: query.data?.aiDataHealth ?? null,
    loading: query.loading && !query.data,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

export function useAiBenchmarks(period: PlatformAiBenchmarkPeriod): HookState<PlatformAiBenchmark[]> {
  const canRead = useCanReadAi();
  const query = useQuery<{ aiBenchmarks: PlatformAiBenchmark[] }>(AI_BENCHMARKS, {
    variables: { period },
    skip: !canRead,
    fetchPolicy: "cache-and-network",
  });
  return {
    data: query.data?.aiBenchmarks ?? [],
    loading: query.loading && !query.data,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

export function useAiConfig(): HookState<PlatformAiConfig | null> {
  const canRead = useCanReadAi();
  const query = useQuery<{ aiConfig: PlatformAiConfig }>(AI_CONFIG, {
    skip: !canRead,
    fetchPolicy: "cache-and-network",
  });
  return {
    data: query.data?.aiConfig ?? null,
    loading: query.loading && !query.data,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

export function useAiTenantSetting(tenantId: string): HookState<PlatformAiTenantSetting | null> {
  const canRead = useCanReadAi();
  const query = useQuery<{ aiTenantSetting: PlatformAiTenantSetting }>(AI_TENANT_SETTING, {
    variables: { tenantId },
    skip: !canRead || !tenantId,
    fetchPolicy: "cache-and-network",
  });
  return {
    data: query.data?.aiTenantSetting ?? null,
    loading: query.loading && !query.data,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

/** Read only once `enabled` (the operator pressed Show): each read is audited. */
export function useAiTopQuestions(tenantId: string, enabled: boolean): HookState<PlatformAiTopQuestion[]> {
  const canRead = useCanReadAi();
  const query = useQuery<{ aiTopQuestions: PlatformAiTopQuestion[] }>(AI_TOP_QUESTIONS, {
    variables: { tenantId, limit: 10 },
    skip: !canRead || !enabled || !tenantId,
    // Every view is a new audit row; never serve a cached copy silently.
    fetchPolicy: "network-only",
  });
  return {
    data: query.data?.aiTopQuestions ?? [],
    loading: query.loading,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}
