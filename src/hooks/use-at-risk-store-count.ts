/**
 * At risk tab count (PRD-025 FR-6.5)
 *
 * The server's total of stores at risk, for the Stores › At risk tab label.
 * It asks for the first page with the table's own variables, so the tab and
 * the table share one cache entry (the way `useDeletedStoreCount` does for
 * Deleted).
 */

import { useQuery } from "@apollo/client";

import { PLATFORM_STORES_AT_RISK } from "../graphql/store-profile";
import { AT_RISK_PAGE_SIZE, atRiskOffset } from "../lib/store-risk.util";
import type { PlatformStoreAtRiskList } from "../types/platform-api";

export function useAtRiskStoreCount(skip: boolean): number | undefined {
  const query = useQuery<{ platformStoresAtRisk: PlatformStoreAtRiskList }>(PLATFORM_STORES_AT_RISK, {
    variables: { limit: AT_RISK_PAGE_SIZE, offset: atRiskOffset(1) },
    fetchPolicy: "cache-and-network",
    skip,
  });
  return query.data?.platformStoresAtRisk.totalCount;
}
