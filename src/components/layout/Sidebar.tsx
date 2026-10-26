/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Dark sidebar (docs/design/02-components.md §1, ref 01/05/07). Top to bottom: wordmark → search (⌘K) →
 * navigation → divider + secondary items → spacer → Notifications → Settings → user row (avatar, name,
 * "{Store} · {Role}"; no email) or a plain red Log out row.
 * 248px, or a 64px icon rail when collapsed. Only the active section shows its children. No blue except
 * the unread count pill.
 */
import { DropdownItem, DropdownSection, DropdownTrigger } from "@heroui/react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { cx } from "../ui/cx";
import { Avatar } from "../ui/Media";
import { Dropdown, DropdownMenu } from "../ui/Dropdown";
import { IconCaret, IconClose, IconCollapseSidebar, IconLogout, IconNotifications, IconSearch } from "../ui/icons";
import { menuItemDangerClasses } from "../ui/menu-styles";
import { Kbd } from "../ui/Primitives";
import { Tooltip } from "../ui/Tooltip";
import type { NavItem, UserMenuItem } from "./types";

export interface SidebarUser {
  name: string;
  /** Shown at the top of the account menu only; never in the sidebar row (08 §1.4). */
  email?: string;
  /** Second line of the row: "{Store} · {Role}". */
  subtitle?: string;
  /** Profile photo; gradient initials when missing. */
  avatarUrl?: string | null;
}

export interface SidebarProps {
  /** Main navigation. */
  items: NavItem[];
  /** Under a divider (Merchant: Apps & channels). */
  secondaryItems?: NavItem[];
  /** Settings, pinned to the bottom above the user row. */
  settingsItem?: NavItem;
  /** Links in the bottom group, right after Notifications (Merchant: Help & learn). */
  bottomItems?: NavItem[];
  /** Muted label at the right of the wordmark ("Super admin", "Admin"). */
  productLabel?: string;
  /** App version, shown under the product label. */
  productVersion?: string;
  searchPlaceholder?: string;
  /** Opens the command palette. */
  onOpenSearch?: () => void;
  /** Unread notifications; the bell row shows a count pill (a dot when collapsed). */
  unreadCount?: number;
  /** Renders the notifications row; receives the row so the panel can anchor to it. */
  renderNotifications?: (row: ReactNode) => ReactNode;
  user?: SidebarUser;
  userMenu?: UserMenuItem[];
  /** Single-account apps (Super admin): without `user`, the bottom row is a plain "Log out" row. */
  onLogout?: () => void;
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
  bottomItems = [],
  productLabel,
  productVersion,
  searchPlaceholder = "Search",
  onOpenSearch,
  unreadCount = 0,
  renderNotifications,
  user,
  userMenu = [],
  onLogout,
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
        <span className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-nav-count px-1.5 text-[11px] font-semibold leading-none text-brand-on num">
          {unreadCount > 99 ? "99+" : unreadCount}
          <span className="sr-only"> unread</span>
        </span>
      ) : null}
    </button>
  );

  const collapseButton = onToggleCollapse ? (
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
  ) : null;

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
      {/* Text-only logotype like the login page: "Zcom" left; product label and version stacked on the right. */}
      <div className={cx("flex min-h-9 items-center gap-2 pb-3.5 pt-4", collapsed ? "justify-center" : "px-2.5")}>
        {collapsed ? (
          <span aria-label="Zcom" className="text-[17px] font-bold leading-none tracking-[-0.04em] text-nav-fg-strong">Z</span>
        ) : (
          <span className="flex min-w-0 flex-1 items-baseline-last justify-between gap-2">
            <span className="text-[19px] font-bold leading-none tracking-[-0.04em] text-nav-fg-strong">Zcom</span>
            {productLabel || productVersion ? (
              <span className="flex min-w-0 flex-col items-end text-right leading-none">
                {productLabel ? <span className="truncate text-[11px] font-medium leading-[13px] text-nav-fg">{productLabel}</span> : null}
                {productVersion ? <span className="text-[10px] leading-3 text-nav-fg-muted">v{productVersion}</span> : null}
              </span>
            ) : null}
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

      {/* Bottom: notifications, bottom links, settings */}
      <div className="flex flex-col gap-0.5 pb-2 pt-2">
        {renderNotifications ? (
          <WithTooltip show={collapsed} label="Notifications">
            {renderNotifications(notificationsRow)}
          </WithTooltip>
        ) : null}
        {bottomItems.length ? <NavList items={bottomItems} collapsed={collapsed} isActive={isActive} onNavigate={onNavigate} /> : null}
        {settingsItem ? <NavList items={[settingsItem]} collapsed={collapsed} isActive={isActive} onNavigate={onNavigate} /> : null}
      </div>

      {/* User row */}
      {user ? (
        <div className={cx("flex items-center gap-1 border-t border-nav-divider pb-1 pt-2.5", collapsed && "flex-col")}>
          <Dropdown placement="top-start">
            <DropdownTrigger>
              <button
                type="button"
                aria-label={`Account menu for ${user.name}`}
                className={cx("flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 text-left hover:bg-nav-hover", focusRing)}
              >
                <Avatar name={user.name} src={user.avatarUrl} size="md" />
                {collapsed ? null : (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-label font-medium text-nav-fg-strong">{user.name}</span>
                    {user.subtitle ? <span className="block truncate text-caption text-nav-fg-muted">{user.subtitle}</span> : null}
                  </span>
                )}
              </button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Account"
              onAction={(key) => userMenu.find((item) => item.key === key)?.onAction()}
              topContent={
                <div className="px-2.5 pb-1 pt-1.5">
                  <p className="truncate text-label font-medium text-fg">{user.name}</p>
                  <p className="truncate text-caption text-fg-subtle">{user.email || user.subtitle}</p>
                </div>
              }
            >
              {/* An empty section would still draw a divider and padding, so it's left out when unused. */}
              {[
                ...(userMenuItems.length
                  ? [
                      <DropdownSection key="account" showDivider={dangerItems.length > 0} aria-label="Account">
                        {userMenuItems.map((item) => (
                          <DropdownItem key={item.key}>{item.label}</DropdownItem>
                        ))}
                      </DropdownSection>,
                    ]
                  : []),
                <DropdownSection key="session" aria-label="Session">
                  {dangerItems.map((item) => (
                    <DropdownItem key={item.key} className={menuItemDangerClasses}>
                      {item.label}
                    </DropdownItem>
                  ))}
                </DropdownSection>,
              ]}
            </DropdownMenu>
          </Dropdown>
          {collapseButton}
        </div>
      ) : onLogout ? (
        <div className={cx("flex items-center gap-1 border-t border-nav-divider py-2.5", collapsed && "flex-col")}>
          <WithTooltip show={collapsed} label="Log out">
            <button
              type="button"
              onClick={onLogout}
              aria-label={collapsed ? "Log out" : undefined}
              className={cx(
                rowBase,
                "min-w-0 flex-1 text-auth-error hover:bg-nav-hover [&_svg]:text-auth-error",
                collapsed && "justify-center px-0",
              )}
            >
              <IconLogout aria-hidden className="size-4 shrink-0" />
              {collapsed ? null : <span className="flex-1 truncate text-left">Log out</span>}
            </button>
          </WithTooltip>
          {collapseButton}
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
              {/* Sections with sub-pages show a chevron: right when closed, down when open. */}
              {children.length ? (
                <IconCaret
                  aria-hidden
                  className={cx("size-3.5 shrink-0 transition-transform duration-fast", !sectionActive && "-rotate-90")}
                />
              ) : null}
            </>
          )}
        </NavLink>
      </WithTooltip>

      {sectionActive && children.length && !collapsed ? (
        <ul className="mt-1 flex flex-col gap-0.5 rounded-lg bg-nav-sub p-1">
          {children.map((child) => {
            const active = isActive(child.to);
            return (
              <li key={child.to}>
                <NavLink
                  to={child.to}
                  aria-current={active ? "page" : undefined}
                  onClick={() => onNavigate?.()}
                  className={cx(
                    "flex h-7 items-center rounded-field pl-8 pr-2.5 text-label transition-colors duration-instant",
                    focusRing,
                    active
                      ? "bg-nav-sub-active font-medium text-nav-fg-strong"
                      : "text-nav-fg hover:bg-nav-sub-hover hover:text-nav-fg-strong",
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
