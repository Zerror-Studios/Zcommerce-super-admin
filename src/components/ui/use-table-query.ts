/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Round 3 C3: one cache entry per table view, so going back to a tab you've seen is instant.
 *
 * The apps use Apollo (not React Query), so a "view" is one Apollo cache entry: the variables carry the tab,
 * filters, sort and page, and the list type policies key on them (apollo-client.ts). `useTableQuery` adds:
 * - a 60s fresh window per view: a view read less than `staleMs` ago is served from the cache with no request
 *   (`cache-first`); an older one shows the cached rows at once and refreshes underneath (`cache-and-network`),
 *   without fading them (a background refresh is not a reload);
 * - previous rows kept only within the same tab (`tabKey`): paging or sorting keeps the last page on screen,
 *   faded (`isReloading`), while switching to a tab that has never loaded shows skeleton rows (`isInitialLoading`),
 *   never another tab's rows;
 * - `prefetchTableQuery` / `useIdleTablePrefetch` warm a tab's first page when the page is idle and on tab hover
 *   (SegmentedSwitch `onItemIntent`), and `prefetchImages` warms that page's thumbnails.
 *
 * `refetch()` (after an action) marks every view of the same operation stale, so other tabs refresh on their next
 * visit while still opening instantly from the cache.
 */
import { useApolloClient, useQuery } from "@apollo/client";
import type {
  ApolloClient,
  DocumentNode,
  OperationVariables,
  QueryHookOptions,
  QueryResult,
  TypedDocumentNode,
  WatchQueryFetchPolicy,
} from "@apollo/client";
import { useCallback, useEffect, useMemo, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

/** A view read this recently is served from the cache with no request (round 3 C3: 60s). */
export const TABLE_STALE_MS = 60_000;
/** Idle prefetch waits for the browser this long at most (then runs anyway). */
const IDLE_TIMEOUT_MS = 2_000;
/** Spacing between idle prefetches, so a tab's prefetch never competes with the page's own requests. */
const IDLE_STEP_MS = 250;
/** Thumbnails warmed per prefetched page (the first screen of rows). */
const PREFETCH_IMAGES_MAX = 12;

// ─── Freshness registry (module level: survives remounts within the page load) ─

const readAt = new Map<string, number>();
const inFlight = new Set<string>();
const warmedImages = new Set<string>();

type AnyDocument = DocumentNode | TypedDocumentNode<unknown, OperationVariables>;

/** Sorted-key JSON, so `{a, b}` and `{b, a}` name the same view. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function operationName(query: AnyDocument): string {
  const definition = query.definitions.find((item) => item.kind === "OperationDefinition");
  return (definition && "name" in definition && definition.name?.value) || "anonymous";
}

/** The registry key of one view: the operation and its variables. */
export function tableViewKey(query: AnyDocument, variables?: OperationVariables): string {
  return `${operationName(query)}|${stableJson(variables ?? {})}`;
}

const isFresh = (key: string, staleMs: number) => {
  const at = readAt.get(key);
  return at != null && Date.now() - at < staleMs;
};

/** Every view of `query` (or of every table query) needs a fresh read on its next visit; cached rows still show. */
export function markTableQueriesStale(query?: AnyDocument) {
  if (!query) {
    readAt.clear();
    return;
  }
  const prefix = `${operationName(query)}|`;
  for (const key of Array.from(readAt.keys())) if (key.startsWith(prefix)) readAt.delete(key);
}

// ─── Prefetch ─────────────────────────────────────────────────────────────────

/**
 * Reads one view into the Apollo cache unless it is fresh or already on its way. Use the same variables the
 * table's `useTableQuery` will send for that tab. Errors are ignored (the tab shows them when opened).
 */
export function prefetchTableQuery<TData = unknown>(
  client: ApolloClient<object>,
  query: AnyDocument,
  variables: OperationVariables,
  options: { staleMs?: number; onData?: (data: TData) => void } = {},
): void {
  const key = tableViewKey(query, variables);
  if (isFresh(key, options.staleMs ?? TABLE_STALE_MS) || inFlight.has(key)) return;
  inFlight.add(key);
  client
    .query<TData>({ query, variables, fetchPolicy: "network-only" })
    .then((result) => {
      if (result.error || result.errors?.length) return;
      readAt.set(key, Date.now());
      if (result.data) options.onData?.(result.data);
    })
    .catch(() => undefined)
    .finally(() => inFlight.delete(key));
}

/** Warms image URLs (a prefetched page's thumbnails) once each, at low priority. */
export function prefetchImages(urls: (string | null | undefined)[]): void {
  if (typeof Image === "undefined") return;
  urls
    .filter((url): url is string => !!url && !warmedImages.has(url))
    .slice(0, PREFETCH_IMAGES_MAX)
    .forEach((url) => {
      warmedImages.add(url);
      const image = new Image();
      image.decoding = "async";
      (image as HTMLImageElement & { fetchPriority?: string }).fetchPriority = "low";
      image.src = url;
    });
}

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/**
 * Runs `tasks` one by one once the page is idle (`requestIdleCallback`, else a short timeout), only while `ready`
 * (the visible tab has its rows). Each task usually calls `prefetchTableQuery` for one other tab's first page.
 */
export function useIdleTablePrefetch(ready: boolean, tasks: (() => void)[]): void {
  const latest = useRef(tasks);
  latest.current = tasks;
  useEffect(() => {
    if (!ready || typeof window === "undefined") return undefined;
    const idle = window as IdleWindow;
    let cancelled = false;
    let timer = 0;
    let handle = 0;
    const runFrom = (index: number) => {
      if (cancelled || index >= latest.current.length) return;
      latest.current[index]?.();
      timer = window.setTimeout(() => schedule(index + 1), IDLE_STEP_MS);
    };
    const schedule = (index: number) => {
      if (cancelled) return;
      if (idle.requestIdleCallback) handle = idle.requestIdleCallback(() => runFrom(index), { timeout: IDLE_TIMEOUT_MS });
      else timer = window.setTimeout(() => runFrom(index), IDLE_STEP_MS);
    };
    schedule(0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (handle && idle.cancelIdleCallback) idle.cancelIdleCallback(handle);
    };
  }, [ready]);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the same default as Apollo's useQuery (untyped gql)
type UntypedData = any;

export interface TableQueryOptions<TData, TVariables extends OperationVariables>
  extends Omit<QueryHookOptions<TData, TVariables>, "fetchPolicy" | "nextFetchPolicy" | "notifyOnNetworkStatusChange"> {
  /** The tab (or view family) these rows belong to: previous rows are kept only while it stays the same. */
  tabKey?: string;
  /** Fresh window per view; default 60s. */
  staleMs?: number;
}

export type TableQueryResult<TData, TVariables extends OperationVariables> = QueryResult<TData, TVariables> & {
  /** No rows to show yet for this tab: skeleton rows. */
  isInitialLoading: boolean;
  /** The same tab's previous page/sort is on screen while the new one loads: fade it. */
  isReloading: boolean;
  /** Cached rows on screen while they refresh in the background: show them as they are. */
  isRefreshing: boolean;
};

export function useTableQuery<TData = UntypedData, TVariables extends OperationVariables = OperationVariables>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  { tabKey = "", staleMs = TABLE_STALE_MS, ...options }: TableQueryOptions<TData, TVariables> = {},
): TableQueryResult<TData, TVariables> {
  const key = tableViewKey(query, options.variables);
  // Decided once per view (not per render), so a re-render after 60s doesn't fire a request by itself.
  const fetchPolicy: WatchQueryFetchPolicy = useMemo(
    () => (isFresh(key, staleMs) ? "cache-first" : "cache-and-network"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  const result = useQuery<TData, TVariables>(query, {
    ...options,
    fetchPolicy,
    // After the first read, cache updates never refetch; a variables change (tab, page, sort, filter) picks the
    // policy for the new view from the registry.
    nextFetchPolicy: (_current, context) =>
      context.reason === "variables-changed"
        ? isFresh(tableViewKey(query, context.options.variables), staleMs)
          ? "cache-first"
          : "cache-and-network"
        : "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  // A network answer for this view makes it fresh.
  const wasLoading = useRef<string | null>(null);
  useEffect(() => {
    if (result.loading) {
      wasLoading.current = key;
      return;
    }
    if (wasLoading.current === key && !result.error && result.data) readAt.set(key, Date.now());
    wasLoading.current = null;
  }, [result.loading, result.error, result.data, key]);

  // Previous rows only within the same tab (paging, sorting, a refetch); never another tab's.
  const lastShown = useRef<{ tab: string; data: TData } | null>(null);
  if (result.data && !options.skip) lastShown.current = { tab: tabKey, data: result.data };
  const kept =
    !result.data && result.loading && lastShown.current?.tab === tabKey ? lastShown.current.data : undefined;
  const data = result.data ?? kept;

  const { refetch: apolloRefetch } = result;
  const refetch = useCallback(
    (variables?: Partial<TVariables>) => {
      markTableQueriesStale(query);
      return apolloRefetch(variables);
    },
    [apolloRefetch, query],
  );

  return {
    ...result,
    data,
    refetch,
    isInitialLoading: result.loading && !data,
    isReloading: result.loading && !result.data && !!kept,
    isRefreshing: result.loading && !!result.data,
  };
}

/** The Apollo client for prefetching (re-exported so pages import table caching from the kit only). */
export const useTableQueryClient = useApolloClient;
