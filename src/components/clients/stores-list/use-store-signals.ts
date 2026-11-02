/**
 * Stores › signals (backend PRD-026 FR-3.4, guide §6)
 *
 * Reads `PlatformTenantSignals` 100 at a time until `totalCount` (the
 * backend caps a page at 100) for one server filter, so the table, the
 * filter options and the CSV export all see the same rows. A filter of
 * `null` reads every store (the new columns and the option lists); a set
 * filter also tells the table which loaded stores match. Changing the
 * filter drops a read still running for the previous one.
 */

import { useApolloClient } from "@apollo/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PLATFORM_TENANT_SIGNALS } from "../../../graphql/tenants";
import type { PlatformList } from "../../../types/platform-api";
import type { StoreServerFilter, StoreSignal } from "./store-signals.util";

// ─── Constants ────────────────────────────────────────────────────────────

/** The backend's page cap. */
export const STORE_SIGNALS_PAGE_SIZE = 100;

/** 50 pages = 5,000 stores, the same guard as the store list (FE-09). */
const STORE_SIGNALS_MAX_PAGES = 50;

// ─── Types ────────────────────────────────────────────────────────────────

export interface StoreSignalsState {
  /** Signal per store id (every store read so far). */
  byId: Map<string, StoreSignal>;
  signals: StoreSignal[];
  /** Ids matching the filter; null while no filter is set. */
  matchingIds: Set<string> | null;
  totalCount: number | null;
  loading: boolean;
  error: Error | null;
  /** True when the 5,000-store guard stopped the read. */
  truncated: boolean;
  refetch: () => void;
}

/** Every page of `PlatformTenantSignals` for `filter` (export uses it too). */
export async function fetchAllStoreSignals(
  query: (offset: number) => Promise<PlatformList<StoreSignal>>,
): Promise<{ items: StoreSignal[]; totalCount: number; truncated: boolean }> {
  const items: StoreSignal[] = [];
  let totalCount = 0;
  for (let page = 0; page < STORE_SIGNALS_MAX_PAGES; page += 1) {
    const result = await query(page * STORE_SIGNALS_PAGE_SIZE);
    totalCount = result.totalCount;
    items.push(...result.items);
    if (result.items.length < STORE_SIGNALS_PAGE_SIZE || items.length >= totalCount) {
      return { items, totalCount, truncated: false };
    }
  }
  return { items, totalCount, truncated: items.length < totalCount };
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useStoreSignals(
  filter: StoreServerFilter | null,
  { skip = false }: { skip?: boolean } = {},
): StoreSignalsState {
  const client = useApolloClient();
  const filterKey = JSON.stringify(filter);
  const [state, setState] = useState<{
    key: string | null;
    signals: StoreSignal[];
    totalCount: number | null;
    error: Error | null;
    truncated: boolean;
  }>({ key: null, signals: [], totalCount: null, error: null, truncated: false });
  const [reload, setReload] = useState(0);
  const runRef = useRef(0);

  useEffect(() => {
    if (skip) return undefined;
    const run = ++runRef.current;
    const parsed = JSON.parse(filterKey) as StoreServerFilter | null;
    fetchAllStoreSignals(async (offset) => {
      const result = await client.query<{ platformTenants: PlatformList<StoreSignal> }>({
        query: PLATFORM_TENANT_SIGNALS,
        variables: { filter: parsed ?? undefined, limit: STORE_SIGNALS_PAGE_SIZE, offset },
        fetchPolicy: "network-only",
      });
      return result.data.platformTenants;
    })
      .then((result) => {
        if (run !== runRef.current) return;
        setState({
          key: filterKey,
          signals: result.items,
          totalCount: result.totalCount,
          error: null,
          truncated: result.truncated,
        });
      })
      .catch((error: Error) => {
        if (run !== runRef.current) return;
        setState({ key: filterKey, signals: [], totalCount: null, error, truncated: false });
      });
    return () => {
      runRef.current += 1;
    };
  }, [client, filterKey, reload, skip]);

  const refetch = useCallback(() => setReload((n) => n + 1), []);
  const current = state.key === filterKey;

  return useMemo(() => {
    const signals = current ? state.signals : [];
    const byId = new Map(signals.map((signal) => [signal.id, signal]));
    return {
      byId,
      signals,
      matchingIds: filter && current && !state.error ? new Set(byId.keys()) : null,
      totalCount: current ? state.totalCount : null,
      loading: !skip && !current,
      error: current ? state.error : null,
      truncated: current && state.truncated,
      refetch,
    };
    // filterKey stands for `filter`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, state, filterKey, skip, refetch]);
}
