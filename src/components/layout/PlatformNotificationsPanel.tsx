/**
 * Platform notifications panel (PRD-024 FR-4.1.5; round 2 G2)
 *
 * The console's panel on the server feed, rendered as the shared centred
 * pop-up (`NotificationsPopup`, Medium 640 up to 72vh; a bottom sheet at 85%
 * on phone): the bell tile, "Notifications", the unread count, "Mark all as
 * read", close; the tabs All · Payments · Stores · Health with their unread
 * counts (only those the role may open; All merges them); Inbox-like rows
 * (the store's initials, else the tab's icon; one line; the time; the blue
 * unread dot) grouped Today / Yesterday / Earlier. It reads a tab page by
 * page from `platformNotifications`, marks items read on the server and has
 * loading, empty and error states. A row opens its link and closes.
 */

import {
  cloneElement,
  isValidElement,
  useMemo,
  useState,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

import {
  useNotificationFeed,
  type NotificationCountsState,
} from "../../hooks/use-platform-notifications";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import {
  notificationDetail,
  notificationHref,
  notificationTone,
} from "../../lib/platform-notifications.util";
import type { PlatformNotificationCategory } from "../../types/platform-api";
import {
  IconNotifications,
  IconPayments,
  IconStore,
  IconStoreHealth,
} from "../ui/icons";
import { toastError } from "../ui/toast";
import { NotificationsPopup, type NotificationPopupItem } from "./NotificationsPanel";

// ─── Constants ────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<PlatformNotificationCategory, typeof IconStore> = {
  PAYMENTS: IconPayments,
  STORES: IconStore,
  HEALTH: IconStoreHealth,
};

const ALL = "ALL";

// ─── Types ────────────────────────────────────────────────────────────────

interface PlatformNotificationsPanelProps {
  /** The bell row (or header button) that opens the panel. */
  trigger: ReactNode;
  counts: NotificationCountsState;
}

interface PopupTab {
  key: string;
  label: string;
  categories: PlatformNotificationCategory[];
  unread: number;
}

// ─── Component ────────────────────────────────────────────────────────────

const PlatformNotificationsPanel = ({
  trigger,
  counts,
}: PlatformNotificationsPanelProps) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<string>(ALL);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const feed = useNotificationFeed(counts.refetch);

  // All first (every readable category), then one tab per category.
  const tabs = useMemo<PopupTab[]>(() => {
    if (!counts.tabs.length) return [];
    const single = counts.tabs.map((tab) => ({
      key: tab.category,
      label: tab.label,
      categories: [tab.category],
      unread: Math.max(0, counts.unread[tab.category] ?? 0),
    }));
    return [
      { key: ALL, label: "All", categories: counts.tabs.map((tab) => tab.category), unread: counts.total },
      ...single,
    ];
  }, [counts.tabs, counts.unread, counts.total]);
  const active = tabs.find((tab) => tab.key === selected) ?? tabs[0] ?? null;
  const hasUnread = (active?.unread ?? 0) > 0 || feed.items.some((item) => !item.read);

  /* ----- Handlers ----- */

  const open = () => {
    setIsOpen(true);
    counts.refetch();
    if (!active) return;
    setSelected(active.key);
    void feed.load(active.categories);
  };

  const showTab = (key: string) => {
    const tab = tabs.find((option) => option.key === key);
    if (!tab) return;
    setSelected(tab.key);
    void feed.load(tab.categories);
  };

  const openItem = (id: string) => {
    const item = feed.items.find((entry) => entry.id === id);
    if (!item) return;
    const href = notificationHref(item.link);
    setIsOpen(false);
    if (href) navigate(href);
    if (item.read) return;
    feed.markRead([item.id]).catch((error) => {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    });
  };

  const markAllRead = async () => {
    setIsMarkingAll(true);
    try {
      await feed.markAllRead();
    } catch (error) {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    } finally {
      setIsMarkingAll(false);
    }
  };

  // The trigger keeps its own click handler (if any) and also opens the panel.
  const opener = isValidElement<{ onClick?: (event: MouseEvent) => void }>(
    trigger,
  )
    ? cloneElement(
        trigger as ReactElement<{ onClick?: (event: MouseEvent) => void }>,
        {
          onClick: (event: MouseEvent) => {
            trigger.props.onClick?.(event);
            open();
          },
        },
      )
    : trigger;

  const items = useMemo<NotificationPopupItem[]>(
    () =>
      feed.items.map((item) => {
        const tone = notificationTone(item.severity);
        return {
          id: item.id,
          title: item.title,
          detail: notificationDetail(item) ?? undefined,
          time: item.createdAt,
          unread: !item.read,
          icon: CATEGORY_ICONS[item.category] ?? IconNotifications,
          avatarName: item.tenantName ?? undefined,
          tone: tone === "danger" ? "danger" : tone === "warning" ? "warning" : "neutral",
        };
      }),
    [feed.items],
  );

  /* ----- Render ----- */

  // One wrapping element so the sidebar tooltip (collapsed rail) can anchor to it; the pop-up renders in a portal.
  return (
    <div className="flex">
      {opener}
      <NotificationsPopup
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        unreadCount={counts.total}
        tabs={tabs.map((tab) => ({ key: tab.key, label: tab.label, count: tab.unread }))}
        tab={active?.key ?? ALL}
        onTabChange={showTab}
        onMarkAllRead={active && hasUnread ? () => void markAllRead() : undefined}
        isMarkingAll={isMarkingAll}
        items={items}
        loading={feed.loading}
        error={feed.error}
        onRetry={() => active && void feed.load(active.categories)}
        onItemOpen={openItem}
        hasMore={feed.hasMore}
        loadingMore={feed.loadingMore}
        onLoadMore={() => void feed.loadMore().catch(() => toastError("Couldn't load more notifications. Try again."))}
        emptyDescription={
          !active
            ? "Payments, stores and health notifications need their read permission."
            : active.key !== ALL
              ? `New ${active.label.toLowerCase()} activity will show up here.`
              : "New activity will show up here."
        }
      />
    </div>
  );
};

export { PlatformNotificationsPanel };
export default PlatformNotificationsPanel;
