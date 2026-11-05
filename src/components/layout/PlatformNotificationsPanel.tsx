/**
 * Platform notifications panel (PRD-024 FR-4.1.5; design v2 §10A "Notifications panel")
 *
 * The console's own panel on the server feed: the synced kit panel
 * (`NotificationsPanel.tsx`) takes a static list, while this one reads one
 * tab at a time from `platformNotifications`, pages it with Load more,
 * marks items read on the server and has loading, empty and error states.
 * v2 look: a 420px right drawer (full screen on phone), "Notifications" with
 * "Mark all as read", the tabs (Payments / Stores / Health, each with its
 * unread count) as the segmented switch, then "Today" / "Earlier" groups of
 * rows like the Inbox list: a neutral avatar (the store's initials, else the
 * tab's icon), the title in bold with the time on the right, one line of
 * detail, a status badge only when the item is a warning or critical, and
 * the blue unread dot on the right.
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
import type {
  PlatformNotification,
  PlatformNotificationCategory,
} from "../../types/platform-api";
import { LoadMoreFooter } from "../common/LoadMoreFooter";
import { DrawerBody, DrawerContent, DrawerHeader } from "../ui";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { cx } from "../ui/cx";
import { Drawer } from "../ui/Drawer";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import {
  IconNotifications,
  IconPayments,
  IconStore,
  IconStoreHealth,
} from "../ui/icons";
import { Avatar } from "../ui/Media";
import { Skeleton } from "../ui/Skeleton";
import { SegmentedSwitch, type SegmentedItem } from "../ui/Tabs";
import { toastError } from "../ui/toast";
import { isSameDay, relativeTime } from "./shell-utils";

// ─── Constants ────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<PlatformNotificationCategory, typeof IconStore> = {
  PAYMENTS: IconPayments,
  STORES: IconStore,
  HEALTH: IconStoreHealth,
};

/** Plain words for the two severities that get a badge (§10A: colour only for status). */
const SEVERITY_LABELS: Partial<Record<string, string>> = {
  CRITICAL: "Urgent",
  WARNING: "Needs a look",
};

const LOADING_ROWS = 5;

// ─── Types ────────────────────────────────────────────────────────────────

interface PlatformNotificationsPanelProps {
  /** The bell row (or header button) that opens the panel. */
  trigger: ReactNode;
  counts: NotificationCountsState;
}

// ─── Row ──────────────────────────────────────────────────────────────────

/** One Inbox-style row: avatar, bold title + time, one line of detail, badge and unread dot. */
function NotificationRow({
  item,
  icon: Icon,
  onOpen,
}: {
  item: PlatformNotification;
  icon: typeof IconStore;
  onOpen: (item: PlatformNotification) => void;
}) {
  const detail = notificationDetail(item);
  const tone = notificationTone(item.severity);
  const severity = tone === "neutral" ? undefined : SEVERITY_LABELS[item.severity];
  const unread = !item.read;
  return (
    <li className="border-b border-line-subtle last:border-b-0">
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex w-full items-start gap-3 px-6 py-3.5 text-left transition-colors duration-fast hover:bg-row-hover focus-visible:shadow-focus-strong focus-visible:outline-none"
      >
        {item.tenantName ? (
          <Avatar name={item.tenantName} size="lg" />
        ) : (
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-avatar text-avatar-fg">
            <Icon className="size-4" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-3">
            <span className={cx("min-w-0 flex-1 truncate text-body text-fg", unread ? "font-semibold" : "font-medium")}>
              {item.title}
            </span>
            <span className="shrink-0 text-caption text-fg-muted num">{relativeTime(item.createdAt)}</span>
          </span>
          {detail ? <span className="mt-0.5 block truncate text-label text-fg-muted">{detail}</span> : null}
          {severity || unread ? (
            <span className="mt-1.5 flex min-h-5 items-center gap-2">
              {severity ? <Chip tone={tone}>{severity}</Chip> : null}
              {unread ? <span aria-label="Unread" className="ml-auto size-2 shrink-0 rounded-full bg-brand" /> : null}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

// ─── Component ────────────────────────────────────────────────────────────

const PlatformNotificationsPanel = ({
  trigger,
  counts,
}: PlatformNotificationsPanelProps) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] =
    useState<PlatformNotificationCategory | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  // The chosen tab, else the first one with something unread, else the first.
  const active =
    counts.tabs.find((tab) => tab.category === selected) ??
    counts.tabs.find((tab) => counts.unread[tab.category] > 0) ??
    counts.tabs[0] ??
    null;
  const feed = useNotificationFeed(counts.refetch);
  const activeUnread = active ? counts.unread[active.category] : 0;
  const hasUnread = activeUnread > 0 || feed.items.some((item) => !item.read);

  // "Today" / "Earlier", keeping the server's order within each.
  const groups = useMemo(() => {
    const now = new Date();
    const today = feed.items.filter((item) => isSameDay(new Date(item.createdAt), now));
    const earlier = feed.items.filter((item) => !isSameDay(new Date(item.createdAt), now));
    return [
      { title: "Today", items: today },
      { title: "Earlier", items: earlier },
    ].filter((group) => group.items.length > 0);
  }, [feed.items]);

  /* ----- Handlers ----- */

  const open = () => {
    setIsOpen(true);
    counts.refetch();
    if (!active) return;
    // Keep the tab on screen and the loaded page in step.
    setSelected(active.category);
    void feed.load(active.category);
  };

  const showTab = (category: PlatformNotificationCategory) => {
    setSelected(category);
    void feed.load(category);
  };

  const openItem = (item: PlatformNotification) => {
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

  /* ----- Render ----- */

  const renderBody = () => {
    if (!active) {
      return (
        <EmptyState
          icon={IconNotifications}
          title="No notifications for your role"
          description="Payments, stores and health notifications need their read permission."
        />
      );
    }
    if (feed.error) {
      return (
        <ErrorState
          title="Couldn't load the notifications."
          description="Check your connection, then try again."
          retryLabel="Try again"
          onRetry={() => void feed.load(active.category)}
        />
      );
    }
    if (feed.loading) {
      return (
        <div role="status" aria-label="Loading notifications">
          {Array.from({ length: LOADING_ROWS }).map((_, index) => (
            <div key={index} className="flex items-start gap-3 border-b border-line-subtle px-6 py-3.5 last:border-b-0">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-2 pt-1">
                <Skeleton className="h-4 w-3/5 rounded-full" />
                <Skeleton className="h-3 w-4/5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      );
    }
    if (feed.items.length === 0) {
      return (
        <EmptyState
          icon={IconNotifications}
          title="You're all caught up"
          description={`New ${active.label.toLowerCase()} activity will show up here.`}
        />
      );
    }
    const Icon = CATEGORY_ICONS[active.category];
    return (
      <>
        {groups.map((group) => (
          <section key={group.title} aria-label={group.title}>
            <p className="px-6 pb-1 pt-4 text-caption font-medium text-fg-subtle">{group.title}</p>
            <ul>
              {group.items.map((item) => (
                <NotificationRow key={item.id} item={item} icon={Icon} onOpen={openItem} />
              ))}
            </ul>
          </section>
        ))}
        <LoadMoreFooter
          shown={feed.items.length}
          total={feed.totalCount}
          hasMore={feed.hasMore}
          loading={feed.loadingMore}
          onLoadMore={feed.loadMore}
          noun="notifications"
        />
      </>
    );
  };

  // One wrapping element so the sidebar tooltip (collapsed rail) can anchor to it; the drawer renders in a portal.
  return (
    <div className="flex">
      {opener}
      <Drawer isOpen={isOpen} onOpenChange={setIsOpen} size="sm" classNames={{ body: "!p-0" }}>
        <DrawerContent>
          <DrawerHeader className="gap-3 border-b border-line-subtle pb-4">
            <div className="flex w-full items-center gap-2">
              <span className="flex-1">Notifications</span>
              {active && hasUnread ? (
                <Button variant="tertiary" size="sm" isLoading={isMarkingAll} onPress={() => void markAllRead()}>
                  Mark all as read
                </Button>
              ) : null}
            </div>
            {counts.tabs.length > 0 && active ? (
              <SegmentedSwitch
                size="sm"
                ariaLabel="Notification type"
                value={active.category}
                onChange={(category) => showTab(category as PlatformNotificationCategory)}
                // Phone: the drawer is full screen; the tabs scroll sideways inside its width.
                className="max-w-full self-start"
                items={counts.tabs.map(
                  (tab): SegmentedItem => ({
                    value: tab.category,
                    label: tab.label,
                    // The count after each tab is its unread count, shown only when there is one.
                    count: counts.unread[tab.category] > 0 ? counts.unread[tab.category] : undefined,
                  }),
                )}
              />
            ) : null}
          </DrawerHeader>
          <DrawerBody>
            <div role="tabpanel" className="pb-4">
              {renderBody()}
            </div>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export { PlatformNotificationsPanel };
export default PlatformNotificationsPanel;
