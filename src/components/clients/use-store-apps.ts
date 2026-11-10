/**
 * One store's installed apps (design v2 §7 Store › Apps, the Stores row opened in place).
 *
 * `platformIntegrationHealth` has no tenant filter (`IntegrationHealthFilter`: provider, channelType, status,
 * search); its `search` matches the store's slug and name on the server, so the store's slug narrows the read
 * and the rows are then kept by `tenantId`. Backend gap: a `tenantId` filter would make this exact (a store
 * whose slug is part of another store's slug reads both, then drops the other's rows here).
 */

import { useMemo } from "react";
import { useIntegrationHealth } from "../../hooks/use-platform-analytics";
import type { Client } from "../../types";
import type { IntegrationHealthRow } from "../../types/platform-api";

/** The backend's page cap; one store has far fewer apps than this. */
const STORE_APPS_LIMIT = 100;

export interface StoreApps {
  rows: IntegrationHealthRow[];
  loading: boolean;
  error: Error | null;
  refetch: () => unknown;
}

export function useStoreApps(client: Pick<Client, "id" | "slug" | "storeName">): StoreApps {
  const api = useIntegrationHealth({
    filter: { provider: "", channelType: "", status: "", search: client.slug || client.storeName },
    limit: STORE_APPS_LIMIT,
    offset: 0,
  });
  const rows = useMemo(() => (api.data?.rows ?? []).filter((row) => row.tenantId === client.id), [api.data, client.id]);
  // First load only (loading pass 2026-11-10): a background refetch keeps the apps on screen.
  return { rows, loading: api.loading && !api.data, error: api.error, refetch: api.refetch };
}

/** Apps that need a look: a connection error or switched off. */
export function needsAttention(row: Pick<IntegrationHealthRow, "status">): boolean {
  const status = String(row.status).toUpperCase();
  return status === "ERROR" || status === "INACTIVE";
}

/** The newest successful sync across the store's apps, or null. */
export function lastSyncOf(rows: Pick<IntegrationHealthRow, "lastSyncAt">[]): string | null {
  return rows.reduce<string | null>((latest, row) => (row.lastSyncAt && (!latest || row.lastSyncAt > latest) ? row.lastSyncAt : latest), null);
}
