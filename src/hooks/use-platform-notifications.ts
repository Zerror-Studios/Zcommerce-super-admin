/**
 * Notifications feed hooks (PRD-024 FR-4.1.5)
 *
 * `useNotificationCounts` feeds the bell: one query with a count per tab
 * the role may open, polled every 60 s only while the browser tab is
 * visible (and re-read when it becomes visible again; no websocket).
 * `useNotificationFeed` reads one tab page by page when the panel shows it
 * and marks items read on the server, updating the page only after the
 * server answered.
 */

import { useApolloClient, useQuery } from "@apollo/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  MARK_ALL_PLATFORM_NOTIFICATIONS_READ,
  MARK_PLATFORM_NOTIFICATIONS_READ,
  PLATFORM_NOTIFICATION_COUNTS,
  PLATFORM_NOTIFICATIONS,
} from "../graphql/notifications";
import {
  appendNotificationPage,
  markItemsRead,
  NOTIFICATION_PAGE_LIMIT,
  NOTIFICATION_POLL_INTERVAL_MS,
  notificationCountVariables,
  totalUnread,
  unreadByCategory,
  visibleNotificationTabs,
  type NotificationTab,
} from "../lib/platform-notifications.util";
import { useAuth } from "../providers/AuthProvider";
import type {
  PlatformNotification,
  PlatformNotificationCategory,
  PlatformNotificationList,
} from "../types/platform-api";

// ─── Types ────────────────────────────────────────────────────────────────

export interface NotificationCountsState {
  tabs: NotificationTab[];
  unread: Record<PlatformNotificationCategory, number>;
  total: number;
  refetch: () => void;
}

export interface NotificationFeedState {
  /** The tab on screen; `null` before the panel first opened. */
  category: PlatformNotificationCategory | null;
  items: PlatformNotification[];
  totalCount: number;
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
  hasMore: boolean;
  /** Shows a tab from its first page. */
  load: (category: PlatformNotificationCategory) => Promise<void>;
  loadMore: () => Promise<void>;
  /** Resolves once the server marked them; throws when it refused. */
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
}

function isPageVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

// ─── Counts ───────────────────────────────────────────────────────────────

export function useNotificationCounts(): NotificationCountsState {
  const { isAuthenticated, can } = useAuth();
  const tabs = useMemo(() => visibleNotificationTabs(can), [can]);
  const variables = useMemo(() => notificationCountVariables(tabs), [tabs]);
  const query = useQuery(PLATFORM_NOTIFICATION_COUNTS, {
    variables,
    skip: !isAuthenticated || tabs.length === 0,
    fetchPolicy: "network-only",
    nextFetchPolicy: "network-only",
    pollInterval: NOTIFICATION_POLL_INTERVAL_MS,
    // FR-4.1.5: no polling from a hidden browser tab.
    skipPollAttempt: () => !isPageVisible(),
  });
  const { refetch } = query;
  const isSkipped = !isAuthenticated || tabs.length === 0;

  // Catch up at once when the tab comes back instead of waiting a minute.
  useEffect(() => {
    if (isSkipped) return undefined;
    const onVisible = () => {
      if (isPageVisible()) void refetch().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isSkipped, refetch]);

  const unread = useMemo(
    () => unreadByCategory(query.data ?? query.previousData),
    [query.data, query.previousData],
  );
  const reread = useCallback(() => {
    if (!isSkipped) void refetch().catch(() => undefined);
  }, [isSkipped, refetch]);

  return { tabs, unread, total: totalUnread(unread), refetch: reread };
}

// ─── Feed ─────────────────────────────────────────────────────────────────

export function useNotificationFeed(
  onReadChanged: () => void,
): NotificationFeedState {
  const apollo = useApolloClient();
  const [category, setCategory] =
    useState<PlatformNotificationCategory | null>(null);
  const [items, setItems] = useState<PlatformNotification[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  // A newer read (another tab, a reopen) wins over an older answer.
  const requestRef = useRef(0);

  const fetchPage = useCallback(
    async (target: PlatformNotificationCategory, offset: number) => {
      const { data } = await apollo.query<{
        platformNotifications: PlatformNotificationList;
      }>({
        query: PLATFORM_NOTIFICATIONS,
        variables: {
          category: target,
          limit: NOTIFICATION_PAGE_LIMIT,
          offset,
        },
        fetchPolicy: "network-only",
      });
      return data.platformNotifications;
    },
    [apollo],
  );

  // Called from the events that show a tab (open, tab change, Retry), not
  // from an effect.
  const load = useCallback(
    async (target: PlatformNotificationCategory) => {
      const request = ++requestRef.current;
      setCategory(target);
      setLoading(true);
      setError(false);
      setItems([]);
      setTotalCount(0);
      try {
        const page = await fetchPage(target, 0);
        if (request !== requestRef.current) return;
        setItems(page.items);
        setTotalCount(page.totalCount);
      } catch {
        if (request === requestRef.current) setError(true);
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    },
    [fetchPage],
  );

  const loadMore = useCallback(async () => {
    if (!category) return;
    const request = requestRef.current;
    setLoadingMore(true);
    try {
      const page = await fetchPage(category, items.length);
      if (request !== requestRef.current) return;
      setItems((current) => appendNotificationPage(current, page.items));
      setTotalCount(page.totalCount);
    } finally {
      setLoadingMore(false);
    }
  }, [category, fetchPage, items.length]);

  const markRead = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      await apollo.mutate({
        mutation: MARK_PLATFORM_NOTIFICATIONS_READ,
        variables: { ids },
      });
      setItems((current) => markItemsRead(current, ids));
      onReadChanged();
    },
    [apollo, onReadChanged],
  );

  const markAllRead = useCallback(async () => {
    if (!category) return;
    await apollo.mutate({
      mutation: MARK_ALL_PLATFORM_NOTIFICATIONS_READ,
      variables: { category },
    });
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    onReadChanged();
  }, [apollo, category, onReadChanged]);

  return {
    category,
    items,
    totalCount,
    loading,
    loadingMore,
    error,
    hasMore: items.length < totalCount,
    load,
    loadMore,
    markRead,
    markAllRead,
  };
}
