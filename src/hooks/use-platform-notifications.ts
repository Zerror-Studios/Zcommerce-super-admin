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
  /** The categories on screen (one tab); `null` before the panel first opened. */
  categories: PlatformNotificationCategory[] | null;
  items: PlatformNotification[];
  totalCount: number;
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
  hasMore: boolean;
  /**
   * Shows a tab from its first page. Round 2 G2: the "All" tab merges every
   * readable category; `platformNotifications` takes one, so each is read
   * page by page and merged newest first.
   */
  load: (categories: PlatformNotificationCategory | PlatformNotificationCategory[]) => Promise<void>;
  loadMore: () => Promise<void>;
  /** Resolves once the server marked them; throws when it refused. */
  markRead: (ids: string[]) => Promise<void>;
  /** "Mark all as read" for every category of the tab on screen. */
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

/** Newest first. */
function byNewest(items: PlatformNotification[]): PlatformNotification[] {
  return items.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

type PageState = Partial<Record<PlatformNotificationCategory, { read: number; total: number }>>;

export function useNotificationFeed(
  onReadChanged: () => void,
): NotificationFeedState {
  const apollo = useApolloClient();
  const [categories, setCategories] = useState<PlatformNotificationCategory[] | null>(null);
  const [items, setItems] = useState<PlatformNotification[]>([]);
  const [pages, setPages] = useState<PageState>({});
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
    async (target: PlatformNotificationCategory | PlatformNotificationCategory[]) => {
      const list = Array.isArray(target) ? target : [target];
      const request = ++requestRef.current;
      setCategories(list);
      setLoading(true);
      setError(false);
      setItems([]);
      setPages({});
      try {
        const results = await Promise.all(list.map((category) => fetchPage(category, 0)));
        if (request !== requestRef.current) return;
        const next: PageState = {};
        list.forEach((category, index) => {
          next[category] = { read: results[index].items.length, total: results[index].totalCount };
        });
        setPages(next);
        setItems(byNewest(results.flatMap((page) => page.items)));
      } catch {
        if (request === requestRef.current) setError(true);
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    },
    [fetchPage],
  );

  const loadMore = useCallback(async () => {
    if (!categories) return;
    const request = requestRef.current;
    const pending = categories.filter((category) => {
      const page = pages[category];
      return page && page.read < page.total;
    });
    if (!pending.length) return;
    setLoadingMore(true);
    try {
      const results = await Promise.all(pending.map((category) => fetchPage(category, pages[category]?.read ?? 0)));
      if (request !== requestRef.current) return;
      setPages((current) => {
        const next = { ...current };
        pending.forEach((category, index) => {
          next[category] = {
            read: (current[category]?.read ?? 0) + results[index].items.length,
            total: results[index].totalCount,
          };
        });
        return next;
      });
      setItems((current) => byNewest(appendNotificationPage(current, results.flatMap((page) => page.items))));
    } finally {
      setLoadingMore(false);
    }
  }, [categories, fetchPage, pages]);

  const markRead = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      // Round 2 §2: optimistic. The rows read as read at once; on an error they go back and the caller toasts.
      const unread = new Set(items.filter((item) => ids.includes(item.id) && !item.read).map((item) => item.id));
      setItems((current) => markItemsRead(current, ids));
      try {
        await apollo.mutate({
          mutation: MARK_PLATFORM_NOTIFICATIONS_READ,
          variables: { ids },
        });
      } catch (error) {
        setItems((current) => current.map((item) => (unread.has(item.id) ? { ...item, read: false } : item)));
        throw error;
      }
      onReadChanged();
    },
    [apollo, items, onReadChanged],
  );

  const markAllRead = useCallback(async () => {
    if (!categories?.length) return;
    const unread = new Set(items.filter((item) => !item.read).map((item) => item.id));
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    try {
      await Promise.all(
        categories.map((category) =>
          apollo.mutate({
            mutation: MARK_ALL_PLATFORM_NOTIFICATIONS_READ,
            variables: { category },
          }),
        ),
      );
    } catch (error) {
      setItems((current) => current.map((item) => (unread.has(item.id) ? { ...item, read: false } : item)));
      throw error;
    }
    onReadChanged();
  }, [apollo, categories, items, onReadChanged]);

  return {
    categories,
    items,
    totalCount: Object.values(pages).reduce((sum, page) => sum + (page?.total ?? 0), 0),
    loading,
    loadingMore,
    error,
    hasMore: Object.values(pages).some((page) => page && page.read < page.total),
    load,
    loadMore,
    markRead,
    markAllRead,
  };
}
