/**
 * Platform notifications panel (PRD-024 FR-4.1.5)
 *
 * The console's own panel on the server feed: the synced kit panel
 * (`NotificationsPanel.tsx`) takes a static list, while this one reads one
 * tab at a time from `platformNotifications`, pages it with Load more,
 * marks items read on the server and has loading, empty and error states.
 * Same look: a 640px modal near the top, underline tabs, 28px icon tiles,
 * relative time and a blue unread dot.
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
                  className="flex w-full gap-3 px-4 py-3 text-left transition-colors duration-instant hover:bg-surface-muted"
                >
                  <span
                    aria-hidden
                    className={cx(
                      "flex size-7 shrink-0 items-center justify-center rounded-lg",
                      tone === "neutral" ? "bg-surface-sunken text-fg-muted" : toneClasses[tone],
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-fg">{item.title}</span>
                    {detail ? <span className="block truncate text-label text-fg-muted">{detail}</span> : null}
                  </span>
                  <span className="flex shrink-0 items-start gap-2 pt-0.5">
                    <span className="text-caption text-fg-subtle num">{relativeTime(item.createdAt)}</span>
                    <span
                      aria-label={item.read ? undefined : "Unread"}
                      className={cx("mt-1 size-1.5 rounded-full", item.read ? "bg-transparent" : "bg-brand")}
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
      <Modal
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        width="md"
        placement="top"
        hideCloseButton
        classNames={{ base: "mt-[12vh]" }}
      >
        <ModalContent>
          <ModalBody className="p-0">
            <div className="flex h-12 items-center gap-3 border-b border-line px-4">
              <IconNotifications aria-hidden className="size-4 shrink-0 text-fg-subtle" />
              <p className="flex-1 text-body font-semibold text-fg">Notifications</p>
              {active && hasUnread ? (
                <Button
                  variant="link"
                  size="sm"
                  isLoading={isMarkingAll}
                  onPress={() => void markAllRead()}
                >
                  Mark all read
                </Button>
              ) : null}
              <IconButton aria-label="Close notifications" size="sm" showTooltip={false} onPress={() => setIsOpen(false)}>
                <IconClose aria-hidden className="size-4" />
              </IconButton>
            </div>

            {counts.tabs.length > 0 ? (
              <div role="tablist" aria-label="Notification type" className="flex gap-5 border-b border-line px-4">
                {counts.tabs.map((tab) => {
                  const isSelected = tab.category === active?.category;
                  const unread = counts.unread[tab.category];
                  return (
                    <button
                      key={tab.category}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => showTab(tab.category)}
                      className={cx(
                        "-mb-px flex h-9 items-center gap-1.5 border-b-2 text-sm font-medium transition-colors duration-fast",
                        isSelected ? "border-fg text-fg" : "border-transparent text-fg-muted hover:text-fg",
                      )}
                    >
                      {tab.label}
                      {unread > 0 ? (
                        <span className="num text-caption text-brand" aria-label={`${unread} unread`}>
                          {unread}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div role="tabpanel" className="custom-scroll max-h-[min(420px,60vh)] overflow-y-auto">
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
