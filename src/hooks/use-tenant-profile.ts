/**
 * Store page › PRD-025 reads (FR-6.1–6.3)
 *
 * One query per store for the fields the shared `PlatformTenantFields`
 * fragment leaves out (query cost): the profile, the status history, the
 * payment provider, the billing-state reason and the subscription's
 * cancel reason. The Profile, History, Billing state cards and the header
 * chip all read this hook, so Apollo answers the second and later from
 * the cache.
 */

import { useQuery } from "@apollo/client";
import { PLATFORM_TENANT_PROFILE } from "../graphql/store-profile";
import type { PlatformTenant } from "../types/platform-api";

// ─── Types ────────────────────────────────────────────────────────────────

export type TenantProfileRead = Pick<
  PlatformTenant,
  | "id"
  | "paymentProvider"
  | "billingStateReason"
  | "billingStateSince"
  | "profile"
  | "statusHistory"
> & {
  subscription: Pick<
    NonNullable<PlatformTenant["subscription"]>,
    "id" | "trialStartsAt" | "pastDueSince" | "ordersPausedAt" | "cancelReason" | "cancelNote"
  > | null;
};

interface TenantProfileData {
  platformTenant: TenantProfileRead | null;
}

export interface TenantProfileResult {
  tenant: TenantProfileRead | null;
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<unknown>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useTenantProfile(tenantId: string, options: { skip?: boolean } = {}): TenantProfileResult {
  const query = useQuery<TenantProfileData>(PLATFORM_TENANT_PROFILE, {
    variables: { id: tenantId },
    fetchPolicy: "cache-and-network",
    skip: options.skip,
  });
  const data = query.data ?? query.previousData;
  return {
    tenant: data?.platformTenant ?? null,
    loading: query.loading && !data,
    error: query.error,
    refetch: query.refetch,
  };
}
