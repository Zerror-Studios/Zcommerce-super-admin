/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Notifications panel (docs/design/02-components.md §12, ref 05): opens beside the sidebar, anchored to the
 * bell row. 380px, 12px radius. Header with "Mark all as read", underline tabs, "Today" / "Earlier" groups,
 * items with a 28px icon tile, title, one-line detail, relative time and a blue unread dot.
 */
import { Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { EmptyState } from "../ui/EmptyState";
import { IconNotifications } from "../ui/icons";
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
  /** "right-end" beside the sidebar; "bottom-end" from the mobile header. */
  placement?: "right-end" | "bottom-end";
}

export function NotificationsPanel({
  trigger,
  items,
  tabs,
  onMarkAllRead,
  onItemOpen,
  placement = "right-end",
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

  return (
    <Popover placement={placement} offset={12} isOpen={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger>{trigger}</PopoverTrigger>
      <PopoverContent className="w-[380px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-line bg-surface p-0 shadow-modal">
        <div className="w-full">
          <div className="flex items-center justify-between px-4 pt-4">
            <p className="text-body font-semibold text-fg">Notifications</p>
            {hasUnread ? (
              <Button variant="link" size="sm" onPress={onMarkAllRead}>
                Mark all as read
              </Button>
            ) : null}
          </div>

          <div role="tablist" aria-label="Notification type" className="mt-2 flex gap-5 border-b border-line px-4">
            {[{ key: "all", label: "All" }, ...tabs].map((option) => {
              const selected = option.key === tab;
              return (
                <button
                  key={option.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setTab(option.key)}
                  className={cx(
                    "-mb-px h-9 border-b-2 text-sm font-medium transition-colors duration-fast",
                    selected ? "border-fg text-fg" : "border-transparent text-fg-muted hover:text-fg",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="custom-scroll max-h-[min(560px,70vh)] overflow-y-auto">
            {groups.length === 0 ? (
              <EmptyState icon={IconNotifications} title="You're all caught up" description="New notifications show up here." className="py-10" />
            ) : (
              groups.map((group) => (
                <div key={group.title}>
                  <p className="px-4 pb-1 pt-3 text-caption font-medium text-fg-subtle">{group.title}</p>
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
                            className="flex w-full gap-3 px-4 py-3 text-left transition-colors duration-instant hover:bg-surface-muted"
                          >
                            <span
                              aria-hidden
                              className={cx(
                                "flex size-7 shrink-0 items-center justify-center rounded-lg",
                                item.critical ? "bg-tone-danger-soft text-tone-danger-text" : "bg-surface-sunken text-fg-muted",
                              )}
                            >
                              <Icon className="size-[15px]" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-fg">{item.title}</span>
                              {item.detail ? <span className="block truncate text-label text-fg-muted">{item.detail}</span> : null}
                            </span>
                            <span className="flex shrink-0 items-start gap-2 pt-0.5">
                              <span className="text-caption text-fg-subtle num">{relativeTime(item.time)}</span>
                              <span
                                aria-label={item.unread ? "Unread" : undefined}
                                className={cx("mt-1 size-1.5 rounded-full", item.unread ? "bg-brand" : "bg-transparent")}
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
        </div>
      </PopoverContent>
    </Popover>
  );
}
