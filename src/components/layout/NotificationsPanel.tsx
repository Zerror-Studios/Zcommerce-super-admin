/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Notifications pop-up (02 §10): a 640px modal from the bell row or the top bar. Header "Notifications" with
 * "Mark all as read" and a ghost circle close; a small segmented switch for the tabs; "Today" / "Earlier" groups
 * of 64px rows: a 36px circle icon in the event's tone, the text, the time and an 8px blue dot when unread.
 * A row opens its page, closes the pop-up and marks itself read.
 */
import { ModalBody, ModalContent } from "@heroui/react";
import { cloneElement, isValidElement, useMemo, useState, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { EmptyState } from "../ui/EmptyState";
import { IconButton } from "../ui/IconButton";
import { IconClose, IconNotifications } from "../ui/icons";
import { Modal } from "../ui/Modal";
import { SegmentedSwitch } from "../ui/Tabs";
import { isSameDay, relativeTime } from "./shell-utils";
import type { NotificationEntry } from "./types";

export interface NotificationsPanelProps {
  /** The bell row (or header button) that opens the panel. */
  trigger: ReactNode;
  items: NotificationEntry[];
  /** Tabs after "All": [{ key: "orders", label: "Orders" }, …]. */
  tabs: { key: string; label: string }[];
  onMarkAllRead: () => void;
  onItemOpen?: (item: NotificationEntry) => void;
}

export function NotificationsPanel({
  trigger,
  items,
  tabs,
  onMarkAllRead,
  onItemOpen,
}: NotificationsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState("all");
  const navigate = useNavigate();

  const groups = useMemo(() => {
    const now = new Date();
    const visible = (tab === "all" ? items : items.filter((item) => item.category === tab))
      .slice()
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    const today = visible.filter((item) => isSameDay(new Date(item.time), now));
    const earlier = visible.filter((item) => !isSameDay(new Date(item.time), now));
    return [
      { title: "Today", items: today },
      { title: "Earlier", items: earlier },
    ].filter((group) => group.items.length > 0);
  }, [items, tab]);

  const hasUnread = items.some((item) => item.unread);

  // The trigger keeps its own click handler (if any) and also opens the panel.
  const opener = isValidElement<{ onClick?: (event: MouseEvent) => void }>(trigger)
    ? cloneElement(trigger as ReactElement<{ onClick?: (event: MouseEvent) => void }>, {
        onClick: (event: MouseEvent) => {
          trigger.props.onClick?.(event);
          setIsOpen(true);
        },
      })
    : trigger;

  // One wrapping element so the sidebar tooltip (collapsed rail) can anchor to it; the modal renders in a portal.
  return (
    <div className="flex">
      {opener}
      <Modal isOpen={isOpen} onOpenChange={setIsOpen} width="md" hideCloseButton classNames={{ body: "!p-0" }}>
        <ModalContent>
          <ModalBody className="flex min-h-0 flex-col">
            {/* Header (02 §10): title, "Mark all as read", ghost circle close. */}
            <div className="flex shrink-0 items-center gap-2 px-6 pb-3 pt-5">
              <h2 className="flex-1 text-title-2 text-fg">Notifications</h2>
              {hasUnread ? (
                <Button variant="tertiary" size="sm" onPress={onMarkAllRead}>
                  Mark all as read
                </Button>
              ) : null}
              <IconButton aria-label="Close notifications" variant="ghost" size="sm" onPress={() => setIsOpen(false)}>
                <IconClose aria-hidden />
              </IconButton>
            </div>
            <div className="shrink-0 border-b border-line-subtle px-6 pb-3">
              <SegmentedSwitch
                size="sm"
                ariaLabel="Notification type"
                value={tab}
                onChange={setTab}
                items={[{ value: "all", label: "All" }, ...tabs.map((option) => ({ value: option.key, label: option.label }))]}
              />
            </div>

            <div className="custom-scroll max-h-[560px] min-h-0 overflow-y-auto">
              {groups.length === 0 ? (
                <EmptyState icon={IconNotifications} title="You're all caught up" description="New activity will show up here." />
              ) : (
                groups.map((group) => (
                  <div key={group.title}>
                    <p className="px-6 pb-1 pt-3 text-caption font-medium text-fg-subtle">{group.title}</p>
                    <ul>
                      {group.items.map((item) => {
                        const Icon = item.icon ?? IconNotifications;
                        return (
                          <li key={item.id} className="border-b border-line-subtle last:border-b-0">
                            <button
                              type="button"
                              onClick={() => {
                                onItemOpen?.(item);
                                setIsOpen(false);
                                if (item.href) navigate(item.href);
                              }}
                              className="flex min-h-16 w-full items-center gap-3 px-6 py-3 text-left transition-colors duration-fast hover:bg-row-hover focus-visible:shadow-focus-strong focus-visible:outline-none"
                            >
                              <span
                                aria-hidden
                                className={cx(
                                  "flex size-9 shrink-0 items-center justify-center rounded-full",
                                  item.critical ? "bg-tone-danger-soft text-tone-danger-text" : "bg-tone-info-soft text-tone-info",
                                )}
                              >
                                <Icon className="size-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-body font-medium text-fg">{item.title}</span>
                                {item.detail ? <span className="block truncate text-label text-fg-muted">{item.detail}</span> : null}
                              </span>
                              <span className="flex shrink-0 items-center gap-2">
                                <span className="text-caption text-fg-muted num">{relativeTime(item.time)}</span>
                                <span
                                  aria-label={item.unread ? "Unread" : undefined}
                                  className={cx("size-2 rounded-full", item.unread ? "bg-brand" : "bg-transparent")}
                                />
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}
