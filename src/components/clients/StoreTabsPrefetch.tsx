/**
 * Store page › tab prefetch (round 2 §6.3: "the first click did nothing and a
 * tab took about 5s").
 *
 * Mounted once the page has painted (idle callback), this reads the other
 * tabs' queries with the same documents and variables the tabs use, so a tab
 * opens with its data already in the Apollo cache (every tab read is
 * cache-and-network: it shows the cached rows at once and refreshes behind).
 * Renders nothing.
 *
 * Left out on purpose: the Team list (`platformTenantStaff`) and the AI top
 * questions, because the server audit-logs each of those reads
 * (`tenant.staff_viewed`, `ai.top_questions_viewed`); opening a store must not
 * log a read nobody made. Those two tabs show their skeleton on first open.
 */

import { useQuery } from "@apollo/client";
import { useEffect, useState } from "react";

import { PLATFORM_CREDITS } from "../../graphql/billing";
import { PLATFORM_AUDIT_LOG } from "../../graphql/team";
import { PLATFORM_USAGE } from "../../graphql/tenants";
import { useTenantSyncRows } from "../../hooks/use-platform-analytics";
import { useAiTenantSetting, useAiUsageByTenant } from "../../hooks/use-platform-ai";
import { useInvoices, usePayments, useReminderLog } from "../../hooks/use-platform-reports";
import { STORE_ACTIVITY_PAGE_SIZE, tenantActivityFilter } from "../../lib/audit-filter.util";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { USAGE_HISTORY_MONTHS } from "../../lib/usage-history.util";
import { useAuth } from "../../providers/AuthProvider";
import type { Client } from "../../types";
import { PAYMENTS_PAGE, REMINDERS_PAGE, useStorePayments } from "./StorePaymentsCard";
import { useStoreApps } from "./use-store-apps";

function Prefetch({ client }: { client: Client }) {
  const { can } = useAuth();
  const canBilling = can(PLATFORM_PERMISSIONS.BILLING_READ);
  const canAudit = can(PLATFORM_PERMISSIONS.AUDIT_READ);
  const id = client.id;

  // Billing (StorePaymentsCard, ClientPlatformBilling)
  useStorePayments(id, "all", PAYMENTS_PAGE, !canBilling);
  useStorePayments(id, "review", PAYMENTS_PAGE, !canBilling);
  useInvoices({ tenantId: id }, { skip: !canBilling });
  useReminderLog({ tenantId: id, limit: REMINDERS_PAGE, offset: 0 });
  usePayments({ tenantId: id, statuses: ["success"], skip: !canBilling });
  useQuery(PLATFORM_CREDITS, { variables: { tenantId: id }, skip: !canBilling, fetchPolicy: "cache-first" });
  // Apps (StoreAppsTab)
  useStoreApps(client);
  useTenantSyncRows(id);
  // AI usage (ClientAiCard, ClientUsageHistory); the top questions are left out (audited)
  useAiTenantSetting(id);
  useAiUsageByTenant({ limit: 1, offset: 0, search: "", tenantId: id });
  useQuery(PLATFORM_USAGE, { variables: { tenantId: id, months: USAGE_HISTORY_MONTHS }, fetchPolicy: "cache-first" });
  // Activity log (ClientActivityCard, full)
  useQuery(PLATFORM_AUDIT_LOG, {
    variables: { filter: tenantActivityFilter(id), limit: STORE_ACTIVITY_PAGE_SIZE, offset: 0 },
    skip: !canAudit,
    fetchPolicy: "cache-first",
  });
  return null;
}

/** Starts the reads once the browser is idle after the first paint (or after 600ms where there is no idle callback). */
export function StoreTabsPrefetch({ client }: { client: Client }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) {
      const handle = idle(() => setReady(true), { timeout: 1500 });
      return () => (window as Window & { cancelIdleCallback?: (handle: number) => void }).cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(() => setReady(true), 600);
    return () => window.clearTimeout(timer);
  }, []);
  return ready ? <Prefetch client={client} /> : null;
}
