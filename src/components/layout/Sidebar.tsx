/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Dark sidebar (docs/design/02-components.md §1, ref 01/05/07). Top to bottom: wordmark → search (⌘K) →
 * navigation → divider + secondary items → spacer → Notifications → Settings → user row.
 * 248px, or a 64px icon rail when collapsed. Only the active section shows its children. No blue except
 * the unread count pill.
 */
import { DropdownItem, DropdownSection, DropdownTrigger } from "@heroui/react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { cx } from "../ui/cx";
import { Dropdown, DropdownMenu } from "../ui/Dropdown";
import { IconClose, IconCollapseSidebar, IconNotifications, IconSearch } from "../ui/icons";
import { menuItemDangerClasses } from "../ui/menu-styles";
import { Kbd } from "../ui/Primitives";
import { Tooltip } from "../ui/Tooltip";
import type { NavItem, UserMenuItem } from "./types";

export interface SidebarUser {
  name: string;
  email?: string;
  /** Two letters; derived from the name when omitted. */
  initials?: string;
}

export interface SidebarProps {
  /** Main navigation. */
  items: NavItem[];
  /** Under a divider (Merchant: Apps & channels). */
  secondaryItems?: NavItem[];
  /** Settings, pinned to the bottom above the user row. */
  settingsItem?: NavItem;
  /** Muted label after the wordmark ("Super admin"). */
  productLabel?: string;
  searchPlaceholder?: string;
  /** Opens the command palette. */
  onOpenSearch?: () => void;
  /** Unread notifications; the bell row shows a count pill (a dot when collapsed). */
  unreadCount?: number;
  /** Renders the notifications row; receives the row so the panel can anchor to it. */
  renderNotifications?: (row: ReactNode) => ReactNode;
  user?: SidebarUser;
  userMenu?: UserMenuItem[];
  /** Small line at the bottom of the user menu (app version). */
  userMenuFooter?: ReactNode;
  /** Icons only (64px) when true. */
  collapsed?: boolean;
  /** Shows the collapse button (desktop only). */
  onToggleCollapse?: () => void;
  /** Project's active-route rule. */
  isActive: (to: string, end?: boolean) => boolean;
  /** Called after any link is clicked (closes the mobile drawer). */
  onNavigate?: () => void;
  /** Shows a close button (mobile drawer). */
  onClose?: () => void;
  className?: string;
}

/** "⌘" on Apple devices, "Ctrl" elsewhere (shortcut hints). */
const MOD_KEY = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl ";

const focusRing = "outline-hidden focus-visible:shadow-[0_0_0_2px_var(--zc-nav-border)]";

const rowBase = cx(
  "flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-label font-medium transition-colors duration-instant ease-standard",
  focusRing,
);

const rowIdle = "text-nav-fg hover:bg-nav-hover hover:text-nav-fg-strong [&_svg]:text-nav-icon hover:[&_svg]:text-nav-fg-strong";
const rowActive = "bg-nav-active text-nav-fg-strong [&_svg]:text-nav-fg-strong";

function initialsOf(user: SidebarUser): string {
  if (user.initials) return user.initials;
  const parts = user.name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
}

function WithTooltip({ show, label, children }: { show: boolean; label: string; children: ReactNode }) {
  return show ? (
    <Tooltip content={label} placement="right">
      {children}
    </Tooltip>
  ) : (
    <>{children}</>
  );
}

export function Sidebar({
  items,
  secondaryItems = [],
  settingsItem,
  productLabel,
  searchPlaceholder = "Search",
  onOpenSearch,
  unreadCount = 0,
  renderNotifications,
  user,
  userMenu = [],
  userMenuFooter,
  collapsed = false,
  onToggleCollapse,
  isActive,
  onNavigate,
  onClose,
  className,
}: SidebarProps) {
  const notificationsRow = (
    <button type="button" aria-label={collapsed ? "Notifications" : undefined} className={cx(rowBase, rowIdle, collapsed && "justify-center px-0")}>
      <span className="relative">
        <IconNotifications aria-hidden className="size-4 shrink-0" />
        {collapsed && unreadCount > 0 ? (
          <span aria-hidden className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-nav-count" />
        ) : null}
      </span>
      {collapsed ? null : <span className="flex-1 truncate text-left">Notifications</span>}
      {!collapsed && unreadCount > 0 ? (
        <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-nav-count px-1.5 text-[11px] font-semibold leading-none text-brand-on num">
          {unreadCount > 99 ? "99+" : unreadCount}
          <span className="sr-only"> unread</span>
        </span>
      ) : null}
    </button>
  );

  const userMenuItems = userMenu.filter((item) => !item.danger);
  const dangerItems = userMenu.filter((item) => item.danger);

  return (
    <aside
      aria-label="Sidebar"
      className={cx(
        "flex h-full flex-col bg-nav transition-[width] duration-base ease-standard",
        collapsed ? "w-sidebar-collapsed px-2" : "w-sidebar px-3",
        className,
      )}
    >
      {/* Wordmark */}
      <div className={cx("flex items-center gap-2 pb-3.5 pt-4", collapsed ? "justify-center" : "px-2.5")}>
        <span aria-hidden className="flex size-[22px] shrink-0 items-center justify-center rounded-[6px] bg-surface text-[13px] font-semibold text-fg">
          Z
        </span>
        {collapsed ? <span className="sr-only">zcommerce</span> : (
          <span className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="text-[15px] font-semibold text-nav-fg-strong">zcommerce</span>
            {productLabel ? <span className="truncate text-caption font-medium text-nav-fg-muted">{productLabel}</span> : null}
          </span>
        )}
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Close menu" className={cx("rounded-lg p-1 text-nav-fg hover:bg-nav-hover hover:text-nav-fg-strong", focusRing)}>
            <IconClose aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>

      {/* Search */}
      {onOpenSearch ? (
        <WithTooltip show={collapsed} label={`${searchPlaceholder} (${MOD_KEY}K)`}>
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label={collapsed ? searchPlaceholder : undefined}
            className={cx(
              "mb-3 flex h-8 w-full items-center gap-2 rounded-lg border border-nav-border bg-nav-surface text-label text-nav-fg-muted transition-colors duration-instant hover:bg-nav-hover",
              collapsed ? "justify-center" : "px-2.5",
              focusRing,
            )}
          >
            <IconSearch aria-hidden className="size-[15px] shrink-0" />
            {collapsed ? null : (
              <>
                <span className="flex-1 truncate text-left">{searchPlaceholder}</span>
                <Kbd dark>{MOD_KEY}K</Kbd>
              </>
            )}
          </button>
        </WithTooltip>
      ) : null}

      {/* Navigation */}
      <nav aria-label="Main" className="no-scrollbar -mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        <NavList items={items} collapsed={collapsed} isActive={isActive} onNavigate={onNavigate} />
        {secondaryItems.length ? (
          <>
            <div aria-hidden className="my-2 h-px bg-nav-divider" />
            <NavList items={secondaryItems} collapsed={collapsed} isActive={isActive} onNavigate={onNavigate} />
          </>
        ) : null}
      </nav>

      {/* Bottom: notifications, settings */}
      <div className="flex flex-col gap-0.5 pb-2 pt-2">
        {renderNotifications ? (
          <WithTooltip show={collapsed} label="Notifications">
            {renderNotifications(notificationsRow)}
          </WithTooltip>
        ) : null}
        {settingsItem ? <NavList items={[settingsItem]} collapsed={collapsed} isActive={isActive} onNavigate={onNavigate} /> : null}
      </div>

      {/* User row */}
      {user ? (
        <div className={cx("flex items-center gap-1 border-t border-nav-divider py-2.5", collapsed && "flex-col")}>
          <Dropdown placement="top-start">
            <DropdownTrigger>
              <button
                type="button"
                aria-label={`Account menu for ${user.name}`}
                className={cx("flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 text-left hover:bg-nav-hover", focusRing)}
              >
                <span aria-hidden className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-nav-active text-[11px] font-semibold text-nav-fg-strong">
                  {initialsOf(user)}
                </span>
                {collapsed ? null : (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-label font-medium text-nav-fg-strong">{user.name}</span>
                    {user.email ? <span className="block truncate text-caption text-nav-fg-muted">{user.email}</span> : null}
                  </span>
                )}
              </button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Account"
              onAction={(key) => userMenu.find((item) => item.key === key)?.onAction()}
              bottomContent={userMenuFooter ? <p className="px-2.5 pb-1.5 pt-1 text-caption text-fg-subtle">{userMenuFooter}</p> : undefined}
            >
              <DropdownSection showDivider={dangerItems.length > 0} aria-label="Account">
                {userMenuItems.map((item) => (
                  <DropdownItem key={item.key}>{item.label}</DropdownItem>
                ))}
              </DropdownSection>
              <DropdownSection aria-label="Session">
                {dangerItems.map((item) => (
                  <DropdownItem key={item.key} className={menuItemDangerClasses}>
                    {item.label}
                  </DropdownItem>
                ))}
              </DropdownSection>
            </DropdownMenu>
          </Dropdown>
          {onToggleCollapse ? (
            <Tooltip content={`${collapsed ? "Expand" : "Collapse"} sidebar (${MOD_KEY}\\)`} placement="right">
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className={cx("shrink-0 rounded-lg p-1.5 text-nav-icon hover:bg-nav-hover hover:text-nav-fg-strong", focusRing)}
              >
                <IconCollapseSidebar aria-hidden className={cx("size-4 transition-transform duration-base", collapsed && "rotate-180")} />
              </button>
            </Tooltip>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

interface NavListProps {
  items: NavItem[];
  collapsed: boolean;
  isActive: SidebarProps["isActive"];
  onNavigate?: () => void;
}

function NavList({ items, collapsed, isActive, onNavigate }: NavListProps) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => (
        <li key={item.key}>
          <NavEntry item={item} collapsed={collapsed} isActive={isActive} onNavigate={onNavigate} />
        </li>
      ))}
    </ul>
  );
}

function NavEntry({ item, collapsed, isActive, onNavigate }: { item: NavItem } & Omit<NavListProps, "items">) {
  const Icon = item.icon;
  const children = item.children ?? [];
  const sectionActive =
    children.some((child) => isActive(child.to)) || (item.to != null && isActive(item.to, item.end));
  const target = item.to && !children.length ? item.to : (children[0]?.to ?? item.to ?? "#");
  const count = item.count ?? 0;

  return (
    <>
      <WithTooltip show={collapsed} label={item.label}>
        <NavLink
          to={target}
          end={item.end}
          aria-current={sectionActive && !children.length ? "page" : undefined}
          onClick={() => onNavigate?.()}
          className={cx(rowBase, collapsed && "justify-center px-0", sectionActive ? rowActive : rowIdle)}
        >
          <Icon aria-hidden className="size-4 shrink-0" />
          {collapsed ? (
            <span className="sr-only">{item.label}</span>
          ) : (
            <>
              <span className="flex-1 truncate">{item.label}</span>
              {count > 0 ? <span className="text-caption font-normal text-nav-fg-muted num">{count}</span> : null}
            </>
          )}
        </NavLink>
      </WithTooltip>

      {sectionActive && children.length && !collapsed ? (
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {children.map((child) => {
            const active = isActive(child.to);
            return (
              <li key={child.to}>
                <NavLink
                  to={child.to}
                  aria-current={active ? "page" : undefined}
                  onClick={() => onNavigate?.()}
                  className={cx(
                    "flex h-7 items-center rounded-lg pl-9 pr-2.5 text-label transition-colors duration-instant",
                    focusRing,
                    active ? "bg-nav-active text-nav-fg-strong" : "text-nav-fg hover:bg-nav-hover hover:text-nav-fg-strong",
                  )}
                >
                  <span className="truncate">{child.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      ) : null}
    </>
  );
}
