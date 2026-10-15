/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Sidebar in the original Store Dashboard design (owner choice 2026-10-13, replaces component-specs §16 look):
 * 240px / 64px, light-blue hover and active fill, an open group becomes one tinted panel with dot sub-items,
 * left chevron that turns down when open, tab-style collapse handle on the edge.
 */
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { cx } from "../ui/cx";
import { IconButton } from "../ui/IconButton";
import { IconClose, IconCollapseSidebar, IconGroupToggle } from "../ui/icons";
import { Tooltip } from "../ui/Tooltip";
import type { NavItem } from "./types";

export interface SidebarProps {
  items: NavItem[];
  /** Icons only (64px) when true. */
  collapsed?: boolean;
  /** Shows the edge toggle on lg+. Omit when the project has no collapse. */
  onToggleCollapse?: () => void;
  /** Key of the expanded group, or null. The project owns this state (and any storage of it). */
  openKey: string | null;
  /** Called when a group header is clicked. The project decides what opening a group does. */
  onGroupToggle: (item: NavItem) => void;
  /** Project's active-route rule. */
  isActive: (to: string, end?: boolean) => boolean;
  /** Called after a link is clicked ("item" = top-level link, "child" = sub-item). */
  onNavigate?: (source: "item" | "child") => void;
  /** Shows a close button (mobile drawer). */
  onClose?: () => void;
  /** Content above the credit (e.g. the Store Dashboard upgrade card). Receives the collapsed state. */
  footerSlot?: ReactNode | ((collapsed: boolean) => ReactNode);
  /** Credit line under the nav. Hidden when collapsed. */
  credit?: ReactNode;
  className?: string;
}

const focusRing =
  "outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/** Row shared by links and group headers: 36px, 8px inset, 6px radius, 14px label. */
const rowBase = cx(
  "flex h-9 w-full items-center gap-2 rounded-sm px-2 text-body transition-colors duration-fast ease-standard",
  focusRing,
);

export function Sidebar({
  items,
  collapsed = false,
  onToggleCollapse,
  openKey,
  onGroupToggle,
  isActive,
  onNavigate,
  onClose,
  footerSlot,
  credit,
  className,
}: SidebarProps) {
  const footer = typeof footerSlot === "function" ? footerSlot(collapsed) : footerSlot;

  return (
    <div className={cx("relative h-full", className)}>
      {onToggleCollapse ? (
        <Tooltip content={collapsed ? "Expand" : "Collapse"} placement="right">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cx(
              "absolute -right-6 top-10 z-0 hidden h-6 w-10 items-center justify-end rounded-tile border border-line-strong bg-surface px-2 text-fg transition-colors duration-fast ease-standard hover:text-brand-text lg:flex",
              focusRing,
            )}
          >
            <IconCollapseSidebar
              aria-hidden
              className={cx("size-3 transition-transform duration-slow ease-standard", collapsed && "rotate-180")}
            />
          </button>
        </Tooltip>
      ) : null}

      <aside
        className={cx(
          "no-scrollbar relative z-10 flex h-full flex-col justify-between overflow-y-auto overflow-x-hidden border-r border-line bg-surface transition-[width] duration-slow ease-standard",
          collapsed ? "w-sidebar-collapsed px-1 pt-1" : "w-sidebar p-2",
        )}
      >
        <div>
          {onClose ? (
            <div className="p-2 lg:hidden">
              <IconButton aria-label="Close menu" size="sm" showTooltip={false} onPress={onClose}>
                <IconClose aria-hidden className="size-4" />
              </IconButton>
            </div>
          ) : null}

          <nav aria-label="Main">
            <ul className="flex flex-col gap-1 px-2">
              {items.map((item) => (
                <li key={item.key}>
                  {item.children?.length ? (
                    <SidebarGroup
                      item={item}
                      collapsed={collapsed}
                      open={openKey === item.key}
                      onToggle={() => onGroupToggle(item)}
                      isActive={isActive}
                      onNavigate={onNavigate}
                    />
                  ) : (
                    <SidebarItem item={item} collapsed={collapsed} isActive={isActive} onNavigate={onNavigate} />
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {footer || (!collapsed && credit) ? (
          <div className="mb-2 mt-6 flex w-full flex-col gap-3">
            {footer}
            {!collapsed ? credit : null}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

interface SidebarItemProps {
  item: NavItem;
  collapsed: boolean;
  isActive: SidebarProps["isActive"];
  onNavigate?: SidebarProps["onNavigate"];
}

function SidebarItem({ item, collapsed, isActive, onNavigate }: SidebarItemProps) {
  const Icon = item.icon;
  const active = item.to != null && isActive(item.to, item.end);
  const link = (
    <NavLink
      to={item.to ?? "#"}
      end={item.end}
      aria-current={active ? "page" : undefined}
      onClick={() => onNavigate?.("item")}
      className={cx(
        rowBase,
        collapsed && "justify-center px-0",
        active ? "bg-brand-soft text-brand-text" : "text-fg hover:bg-brand-soft hover:text-brand-text",
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
    </NavLink>
  );

  return collapsed ? (
    <Tooltip content={item.label} placement="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

interface SidebarGroupProps extends SidebarItemProps {
  open: boolean;
  onToggle: () => void;
}

function SidebarGroup({ item, collapsed, open, onToggle, isActive, onNavigate }: SidebarGroupProps) {
  const Icon = item.icon;
  const children = item.children ?? [];
  const sectionActive =
    children.some((child) => isActive(child.to)) || (item.to != null && isActive(item.to, item.end));

  if (collapsed) {
    // Collapsed: the group icon links to its first page.
    return (
      <Tooltip content={item.label} placement="right">
        <NavLink
          to={children[0]?.to ?? item.to ?? "#"}
          onClick={() => onNavigate?.("item")}
          className={cx(
            rowBase,
            "justify-center px-0",
            sectionActive ? "bg-brand-soft text-brand-text" : "text-fg hover:bg-brand-soft hover:text-brand-text",
          )}
        >
          <Icon aria-hidden className="size-4 shrink-0" />
          <span className="sr-only">{item.label}</span>
        </NavLink>
      </Tooltip>
    );
  }

  const panelId = `sidebar-group-${item.key}`;

  return (
    <div className={cx("overflow-hidden rounded-sm", open && "bg-brand-soft")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={cx(
          rowBase,
          "text-left hover:bg-brand-soft",
          open ? "text-brand-text" : sectionActive ? "text-brand-text" : "text-fg",
        )}
      >
        <Icon aria-hidden className="size-4 shrink-0" />
        <span className="flex-1 truncate">{item.label}</span>
        <IconGroupToggle
          aria-hidden
          className={cx(
            "mr-1 size-3 shrink-0 text-fg transition-transform duration-base ease-standard",
            open && "-rotate-90",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.ul
            id={panelId}
            key="children"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="flex flex-col gap-1 overflow-hidden py-2"
          >
            {children.map((child) => {
              const active = isActive(child.to);
              return (
                <li key={child.to}>
                  <NavLink
                    to={child.to}
                    aria-current={active ? "page" : undefined}
                    onClick={() => onNavigate?.("child")}
                    className={cx(
                      "mx-2 flex h-9 items-center gap-3 rounded-sm px-2 text-caption transition-colors duration-fast ease-standard",
                      focusRing,
                      active ? "bg-brand-soft-strong text-brand-text" : "text-fg hover:bg-brand-soft-strong",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cx("size-1.5 shrink-0 rounded-full", active ? "bg-brand" : "bg-line-strong")}
                    />
                    <span className="truncate">{child.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
