/**
 * Platform notifications panel (PRD-024 FR-4.1.5)
 *
 * The console's own panel on the server feed: the synced kit panel
 * (`NotificationsPanel.tsx`) takes a static list, while this one reads one
 * tab at a time from `platformNotifications`, pages it with Load more,
 * marks items read on the server and has loading, empty and error states.
 * Same look as the kit panel (02 §10): a 640px modal, a small segmented switch
 * for the tabs, 64px rows with a 36px circle icon, relative time and a blue dot.
 */

import { ModalBody, ModalContent } from "@heroui/react";
import {
  cloneElement,
  isValidElement,
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
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { IconButton } from "../ui/IconButton";
import {
  IconClose,
  IconNotifications,
  IconPayments,
  IconStore,
  IconStoreHealth,
} from "../ui/icons";
import { Modal } from "../ui/Modal";
import { SegmentedSwitch, type SegmentedItem } from "../ui/Tabs";
import { Skeleton } from "../ui/Skeleton";
import { toastError } from "../ui/toast";
import { toneClasses } from "../ui/tones";
import { relativeTime } from "./shell-utils";

// ─── Constants ────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<PlatformNotificationCategory, typeof IconStore> = {
  PAYMENTS: IconPayments,
  STORES: IconStore,
  HEALTH: IconStoreHealth,
};

const LOADING_ROWS = 4;

// ─── Types ────────────────────────────────────────────────────────────────

interface PlatformNotificationsPanelProps {
  /** The bell row (or header button) that opens the panel. */
  trigger: ReactNode;
  counts: NotificationCountsState;
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
          className="py-10"
        />
      );
    }
    if (feed.error) {
      return (
        <ErrorState
          inline
          title="Couldn't load the notifications."
          onRetry={() => void feed.load(active.category)}
        />
      );
    }
    if (feed.loading) {
      return (
        <div role="status" aria-label="Loading notifications" className="space-y-3 p-4">
          {Array.from({ length: LOADING_ROWS }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-lg" />
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
          className="py-10"
        />
      );
    }
    const Icon = CATEGORY_ICONS[active.category];
    return (
      <>
        <ul>
          {feed.items.map((item) => {
            const detail = notificationDetail(item);
            const tone = notificationTone(item.severity);
            return (
              <li key={item.id} className="border-b border-line-subtle last:border-b-0">
                <button
                  type="button"
                  onClick={() => openItem(item)}
                  className="flex min-h-16 w-full items-center gap-3 px-6 py-3 text-left transition-colors duration-fast hover:bg-row-hover focus-visible:shadow-focus-strong focus-visible:outline-none"
                >
                  <span
                    aria-hidden
                    className={cx(
                      "flex size-9 shrink-0 items-center justify-center rounded-full",
                      tone === "neutral" ? "bg-surface-sunken text-fg-muted" : toneClasses[tone],
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-medium text-fg">{item.title}</span>
                    {detail ? <span className="block truncate text-label text-fg-muted">{detail}</span> : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-caption text-fg-muted num">{relativeTime(item.createdAt)}</span>
                    <span
                      aria-label={item.read ? undefined : "Unread"}
                      className={cx("size-2 rounded-full", item.read ? "bg-transparent" : "bg-brand")}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
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

  // One wrapping element so the sidebar tooltip (collapsed rail) can anchor to it; the modal renders in a portal.
  return (
    <div className="flex">
      {opener}
      <Modal isOpen={isOpen} onOpenChange={setIsOpen} width="md" hideCloseButton classNames={{ body: "!p-0" }}>
        <ModalContent>
          <ModalBody className="flex min-h-0 flex-col">
            <div className="flex shrink-0 items-center gap-2 px-6 pb-3 pt-5">
              <h2 className="flex-1 text-title-2 text-fg">Notifications</h2>
              {active && hasUnread ? (
                <Button
                  variant="tertiary"
                  size="sm"
                  isLoading={isMarkingAll}
                  onPress={() => void markAllRead()}
                >
                  Mark all as read
                </Button>
              ) : null}
              <IconButton aria-label="Close notifications" variant="ghost" size="sm" onPress={() => setIsOpen(false)}>
                <IconClose aria-hidden />
              </IconButton>
            </div>

            {counts.tabs.length > 0 && active ? (
              <div className="shrink-0 border-b border-line-subtle px-6 pb-3">
                <SegmentedSwitch
                  size="sm"
                  ariaLabel="Notification type"
                  value={active.category}
                  onChange={(category) => showTab(category as PlatformNotificationCategory)}
                  items={counts.tabs.map(
                    (tab): SegmentedItem => ({
                      value: tab.category,
                      label: tab.label,
                      // The count after each tab is its unread count, shown only when there is one.
                      count: counts.unread[tab.category] > 0 ? counts.unread[tab.category] : undefined,
                    }),
                  )}
                />
              </div>
            ) : null}

            <div role="tabpanel" className="custom-scroll max-h-[560px] min-h-0 overflow-y-auto">
              {renderBody()}
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
};

export { PlatformNotificationsPanel };
export default PlatformNotificationsPanel;
