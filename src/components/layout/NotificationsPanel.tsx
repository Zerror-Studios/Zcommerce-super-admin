/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Notifications pop-up (round 2 G2, CHANGED from the v2 right drawer): the same pop-up family as search, the
 * Medium size (640) up to 72vh, centred, the pop-up motion; a bottom sheet at 85% height on phone.
 * - Title row: the bell icon tile, "Notifications", the unread count, "Mark all as read" (text button), close (36px).
 * - Tabs (All · Orders · Payments · System in the store) with counts, in one row that never scrolls.
 * - Rows like Inbox rows: an icon tile by type (or the store's initials), a one-line sentence, the time on the
 *   right and the blue unread dot; grouped Today / Yesterday / Earlier. A click opens the record and closes.
 * - Empty: an ink icon tile and "You're all caught up".
 * Presentational: each app keeps its own data hooks (store StoreNotificationsPanel, PRD-033; console
 * PlatformNotificationsPanel, PRD-024) and renders through <NotificationsPopup>.
 */
import { ModalBody, ModalContent } from "@heroui/react";
import { useMemo, type ReactNode } from "react";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { ErrorState } from "../ui/ErrorState";
import { IconButton } from "../ui/IconButton";
import { IconTile } from "../ui/IconTile";
import { IconClose, IconNotifications } from "../ui/icons";
import { Avatar } from "../ui/Media";
import { Modal } from "../ui/Modal";
import { Skeleton } from "../ui/Skeleton";
import { isSameDay, relativeTime } from "./shell-utils";
import type { NavIcon } from "./types";

export interface NotificationPopupItem {
  id: string;
  /** One-line sentence: "₹4,498 paid by Fatima Qureshi". */
  title: ReactNode;
  /** Optional second line (kept short; most rows have none). */
  detail?: ReactNode;
  /** ISO date or Date; shown as a relative time on the right. */
  time: string | Date;
  unread: boolean;
  /** Icon tile by type. */
  icon?: NavIcon;
  /** "danger" for critical, "warning" for a look-soon; neutral otherwise. */
  tone?: "neutral" | "warning" | "danger";
  /** Shows the store's initials instead of the icon (console). */
  avatarName?: string;
}

export interface NotificationPopupTab {
  key: string;
  label: string;
  /** Unread in this tab; hidden at 0. */
  count?: number;
}

export interface NotificationsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  /** Unread across every tab, next to the title. */
  unreadCount: number;
  tabs: NotificationPopupTab[];
  tab: string;
  onTabChange: (key: string) => void;
  /** "Mark all as read" for the tab on screen; hidden without it. */
  onMarkAllRead?: () => void;
  isMarkingAll?: boolean;
  items: NotificationPopupItem[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  /** Opens the record; the pop-up closes itself. */
  onItemOpen: (id: string) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  /** Under "You're all caught up". */
  emptyDescription?: ReactNode;
}

const LOADING_ROWS = 5;

/** Today / Yesterday / Earlier, keeping the order given. */
function groupByDay(items: NotificationPopupItem[], now = new Date()) {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const groups: { title: string; items: NotificationPopupItem[] }[] = [
    { title: "Today", items: [] },
    { title: "Yesterday", items: [] },
    { title: "Earlier", items: [] },
  ];
  for (const item of items) {
    const day = new Date(item.time);
    const slot = isSameDay(day, now) ? 0 : isSameDay(day, yesterday) ? 1 : 2;
    groups[slot].items.push(item);
  }
  return groups.filter((group) => group.items.length > 0);
}

const tileTones = {
  neutral: "bg-surface-sunken text-fg",
  warning: "bg-tone-warning-soft text-tone-warning-text",
  danger: "bg-tone-danger-soft text-tone-danger-text",
} as const;

function NotificationRow({ item, onOpen }: { item: NotificationPopupItem; onOpen: (id: string) => void }) {
  const Icon = item.icon ?? IconNotifications;
  return (
    <li>
      <button type="button" onClick={() => onOpen(item.id)} className="zc-notice-row">
        {item.avatarName ? (
          <Avatar name={item.avatarName} size="sm28" />
        ) : (
          <span aria-hidden className={cx("zc-notice-row__tile", tileTones[item.tone ?? "neutral"])}>
            <Icon className="size-4" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className={cx("block truncate text-body text-fg", item.unread ? "font-semibold" : "font-normal")}>
            {item.title}
          </span>
          {item.detail ? <span className="block truncate text-caption text-fg-muted">{item.detail}</span> : null}
        </span>
        <span className="shrink-0 text-caption text-fg-subtle num">{relativeTime(item.time)}</span>
        <span
          aria-label={item.unread ? "Unread" : undefined}
          className={cx("size-2 shrink-0 rounded-full", item.unread ? "bg-brand" : "bg-transparent")}
        />
      </button>
    </li>
  );
}

export function NotificationsPopup({
  isOpen,
  onClose,
  unreadCount,
  tabs,
  tab,
  onTabChange,
  onMarkAllRead,
  isMarkingAll = false,
  items,
  loading = false,
  error = false,
  onRetry,
  onItemOpen,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  emptyDescription = "New activity will show up here.",
}: NotificationsPopupProps) {
  const groups = useMemo(() => groupByDay(items), [items]);

  const body = error ? (
    <ErrorState
      title="Couldn't load the notifications."
      description="Check your connection, then try again."
      retryLabel="Try again"
      onRetry={onRetry}
      className="py-12"
    />
  ) : loading ? (
    // Same size as the rows, so nothing jumps when they arrive.
    <ul role="status" aria-label="Loading notifications" className="px-3 py-2">
      {Array.from({ length: LOADING_ROWS }).map((_, index) => (
        <li key={index} className="flex h-14 items-center gap-3 px-3">
          <Skeleton className="size-8 shrink-0 rounded-field" />
          <Skeleton className="h-4 flex-1 rounded-full" />
          <Skeleton className="h-3 w-10 rounded-full" />
        </li>
      ))}
    </ul>
  ) : items.length === 0 ? (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <IconTile tone="ink" size="lg">
        <IconNotifications aria-hidden />
      </IconTile>
      <p className="text-title-3 text-fg">You&apos;re all caught up</p>
      <p className="text-label text-fg-muted">{emptyDescription}</p>
    </div>
  ) : (
    <>
      {groups.map((group) => (
        <section key={group.title} aria-label={group.title} className="px-3 pt-2">
          <p className="zc-notice-heading">{group.title}</p>
          <ul>
            {group.items.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                onOpen={(id) => {
                  onItemOpen(id);
                  onClose();
                }}
              />
            ))}
          </ul>
        </section>
      ))}
      {hasMore && onLoadMore ? (
        <div className="flex justify-center px-6 py-3">
          <Button variant="ghost" size="sm" isLoading={loadingMore} onPress={onLoadMore}>
            Load more
          </Button>
        </div>
      ) : null}
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      size="md"
      sheet
      hideCloseButton
      aria-label="Notifications"
      classNames={{ base: "zc-notices", body: "!p-0" }}
    >
      <ModalContent>
        <ModalBody className="flex min-h-0 flex-col">
          {/* Title row (G2): bell tile, title, unread count, Mark all as read, 36px close. */}
          <div className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-5">
            <IconTile tone="neutral" size="md">
              <IconNotifications aria-hidden />
            </IconTile>
            <h2 className="min-w-0 truncate text-title-3 text-fg">Notifications</h2>
            {unreadCount > 0 ? (
              <span className="text-label text-fg-muted num">{unreadCount > 99 ? "99+" : unreadCount} unread</span>
            ) : null}
            <span className="flex-1" />
            {onMarkAllRead ? (
              <Button variant="ghost" size="sm" isLoading={isMarkingAll} onPress={onMarkAllRead}>
                Mark all as read
              </Button>
            ) : null}
            <IconButton aria-label="Close notifications" onPress={onClose}>
              <IconClose aria-hidden />
            </IconButton>
          </div>

          {tabs.length > 1 ? (
            <div role="tablist" aria-label="Notification type" className="zc-notice-tabs">
              {tabs.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  role="tab"
                  aria-selected={option.key === tab}
                  onClick={() => onTabChange(option.key)}
                  className={cx("zc-notice-tab", option.key === tab && "is-active")}
                >
                  {option.label}
                  {option.count ? <span className="zc-notice-tab__count num">{option.count > 99 ? "99+" : option.count}</span> : null}
                </button>
              ))}
            </div>
          ) : null}

          <div role="tabpanel" className="custom-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3">
            {body}
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
