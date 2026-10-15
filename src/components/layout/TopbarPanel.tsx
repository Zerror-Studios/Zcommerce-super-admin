/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Badge } from "../ui/Badge";
import { cx } from "../ui/cx";
import { IconButton } from "../ui/IconButton";
import { IconClose } from "../ui/icons";
import { TopbarIconButton } from "./Topbar";
import type { NavIcon } from "./types";

export interface PanelItem {
  id: string;
  title: ReactNode;
  preview?: ReactNode;
  time?: ReactNode;
  unread?: boolean;
  /** Notification icon (shown in a 40px soft tile) … */
  icon?: NavIcon;
  /** … or a person's name (shown as a 40px initial avatar) for messages. */
  avatarName?: string;
}

export interface PanelGroup {
  key: string;
  label: ReactNode;
  items: PanelItem[];
}

export interface PanelFilter {
  key: string;
  label: string;
  count?: number;
}

export interface TopbarPanelProps {
  /** Trigger aria-label, e.g. "Notifications". */
  label: string;
  /** Panel heading (defaults to label). */
  title?: string;
  icon: NavIcon;
  /** Unread count on the trigger badge. */
  count: number;
  /** Groups to show (already filtered by the project). */
  groups: PanelGroup[];
  filters?: PanelFilter[];
  activeFilter?: string;
  onFilterChange?: (key: string) => void;
  /** Shows the "Mark as read" link. */
  onMarkAllRead?: () => void;
  emptyText?: string;
}

/** Notification / message panel (component-specs §14), anchored to its topbar control. Same in both products. */
export function TopbarPanel({
  label,
  title,
  icon: TriggerIcon,
  count,
  groups,
  filters,
  activeFilter,
  onFilterChange,
  onMarkAllRead,
  emptyText = "Nothing here yet",
}: TopbarPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasItems = groups.some((group) => group.items.length > 0);

  return (
    <Popover placement="bottom-end" showArrow offset={12} isOpen={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger>
        <TopbarIconButton aria-label={label} count={count}>
          <TriggerIcon aria-hidden className="size-4" />
        </TopbarIconButton>
      </PopoverTrigger>

      <PopoverContent className="w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl bg-surface p-0 !shadow-popover">
        <div className="flex max-h-[70vh] w-full flex-col">
          <div className="shrink-0 border-b border-line p-4">
            <div className="flex items-center justify-between">
              <p className="text-subtitle font-medium text-fg">{title ?? label}</p>
              <IconButton aria-label={`Close ${label.toLowerCase()}`} size="sm" showTooltip={false} onPress={() => setIsOpen(false)}>
                <IconClose aria-hidden className="size-4" />
              </IconButton>
            </div>

            {filters?.length ? (
              <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label={`${label} filters`}>
                {filters.map((filter) => {
                  const selected = filter.key === activeFilter;
                  return (
                    <button
                      key={filter.key}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => onFilterChange?.(filter.key)}
                      className={cx(
                        "inline-flex h-7 items-center gap-1 rounded-full px-3 text-caption font-medium outline-hidden transition-colors duration-fast ease-standard focus-visible:ring-2 focus-visible:ring-focus",
                        selected ? "bg-brand-soft text-brand-text" : "border border-line text-fg hover:bg-surface-muted",
                      )}
                    >
                      {filter.label}
                      {filter.count ? <Badge count={filter.count} /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {onMarkAllRead ? (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  className="text-caption font-medium text-brand-text underline-offset-2 hover:underline"
                  onClick={onMarkAllRead}
                >
                  Mark as read
                </button>
              </div>
            ) : null}
          </div>

          <div className="custom-scroll min-h-0 flex-1 overflow-y-auto pb-2">
            {hasItems ? (
              groups
                .filter((group) => group.items.length > 0)
                .map((group) => (
                  <section key={group.key}>
                    <p className="mt-4 px-4 text-body font-medium text-fg">{group.label}</p>
                    <ul>
                      {group.items.map((item) => (
                        <PanelRow key={item.id} item={item} />
                      ))}
                    </ul>
                  </section>
                ))
            ) : (
              <p className="py-8 text-center text-body text-fg-muted">{emptyText}</p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PanelRow({ item }: { item: PanelItem }) {
  const Icon = item.icon;
  return (
    <li className="flex min-h-16 gap-3 border-b border-line px-4 py-3 transition-colors duration-fast ease-standard last:border-b-0 hover:bg-surface-muted">
      {Icon ? (
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Icon className="size-4" />
        </span>
      ) : item.avatarName ? (
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-body font-medium text-brand-on">
          {item.avatarName.trim().charAt(0).toUpperCase()}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-2 text-body font-medium text-fg">
            <span className="truncate">{item.title}</span>
            {item.unread ? (
              <span className="size-1.5 shrink-0 rounded-full bg-brand">
                <span className="sr-only">Unread</span>
              </span>
            ) : null}
          </p>
          {item.time ? <span className="shrink-0 text-caption text-fg-muted">{item.time}</span> : null}
        </div>
        {item.preview ? <p className="mt-1 line-clamp-2 text-caption text-fg-muted">{item.preview}</p> : null}
      </div>
    </li>
  );
}
