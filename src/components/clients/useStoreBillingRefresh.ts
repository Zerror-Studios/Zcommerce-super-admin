import { useApolloClient } from "@apollo/client";
import { useCallback } from "react";
import { useClients } from "../../providers/ClientsProvider";

/** The reads Billing & plan shows; a billing action re-reads them all (by operation name). */
const STORE_BILLING_QUERIES = ["PlatformInvoices", "PlatformPayments", "PlatformCredits", "PlatformReminderLog"];

/**
 * Re-reads the store's billing after a change: the stores list (payment badge, fee, health live on the tenant)
 * and every active billing query on the page. Failures are left to each card's own error state.
 */
export function useStoreBillingRefresh(): () => Promise<void> {
  const apollo = useApolloClient();
  const { refetch } = useClients();
  return useCallback(async () => {
    await Promise.all([
      refetch().catch(() => undefined),
      apollo.refetchQueries({ include: STORE_BILLING_QUERIES }).catch(() => undefined),
    ]);
  }, [apollo, refetch]);
}
