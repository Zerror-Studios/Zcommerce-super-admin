/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * The black menu (docs/design-v2/README.md §3.1). Top to bottom: the store switcher (neutral initials badge, store
 * name, domain, switch chevron), or the brand block in the Super Admin (round 2 §6.1: Z tile, "Zcom", "Platform
 * admin" in purple) → the search box with the ⌘K hint
 * (search only, it never asks AI) → one flat list with no group headings → pushed to the bottom: Notifications (red
 * count), Settings → one divider → the profile row, whose menu ends with the Zcom version and a What's new link.
 * 240px, or a 72px icon rail when collapsed (labels as tooltips, counts as 8px dots). A chevron opens a section in
 * place; only the open section shows its sub-items, one level deep.
 */
import { DropdownItem, DropdownSection, DropdownTrigger } from "@heroui/react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { cx } from "../ui/cx";
import { Avatar } from "../ui/Media";
import { Dropdown, DropdownMenu } from "../ui/Dropdown";
import { IconButton } from "../ui/IconButton";
import { IconCaret, IconClose, IconCollapseSidebar, IconLogout, IconNotifications, IconSearch } from "../ui/icons";
import { menuItemDangerClasses, menuSectionClasses } from "../ui/menu-styles";
import { Kbd } from "../ui/Primitives";
import { Tooltip } from "../ui/Tooltip";
import type { NavItem, UserMenuItem } from "./types";

export interface SidebarUser {
  name: string;
  /** Shown at the top of the account menu only; never in the sidebar row (08 §1.4). */
  email?: string;
  /** Second line of the row: "{Store} · {Role}" (admin) or "Owner" (super admin). */
  subtitle?: string;
  /** Profile photo; gradient initials when missing. */
  avatarUrl?: string | null;
}

/** The store switcher at the top of the menu (v2 §3.1). */
export interface SidebarStore {
  name: string;
  /** "kesarandkin.com" */
  domain?: string;
  /** Two letters for the badge; taken from the name when missing. */
  initials?: string;
  /** Opens the store chooser. Without it (and without `switchItems`) the switcher is a plain label. */
  onSwitch?: () => void;
  /**
   * A small menu instead of a jump to the chooser (developer, 2026-11-06): "Switch to Nahara", "Sign in to another
   * store". The chevron shows only when the menu has items.
   */
  switchItems?: { key: string; label: string; onSelect: () => void }[];
}

export interface SidebarProps {
  /** Main navigation. */
  items: NavItem[];
  /** LEGACY: shown after the main items without a divider (v2 has one list). */
  secondaryItems?: NavItem[];
  /** Settings: the last item of the main list (v2, 02 §3.2). */
  settingsItem?: NavItem;
  /** Muted links in the bottom zone, right after Notifications (admin: Help & learn). */
  bottomItems?: NavItem[];
  /** One-line label at the right of the wordmark ("Platform"). Hidden when `store` is set. */
  productLabel?: string;
  /** The store switcher; replaces the wordmark (merchant admin). */
  store?: SidebarStore;
  /** App version: shown in the profile menu with the What's new link (v2 §3.1). */
  productVersion?: string;
  /** "What's new" link next to the version in the profile menu. */
  whatsNewHref?: string;
  searchPlaceholder?: string;
  /** Opens the command palette. */
  onOpenSearch?: () => void;
  /** Unread notifications; the bell row shows a red count pill (an 8px dot when collapsed). */
  unreadCount?: number;
  /** Renders the notifications row; receives the row so the pop-up can open from it. */
  renderNotifications?: (row: ReactNode) => ReactNode;
  user?: SidebarUser;
  userMenu?: UserMenuItem[];
  /** LEGACY single-account apps: without `user`, the bottom row is a plain "Log out" row. */
  onLogout?: () => void;
  /** Icons only (72px rail) when true. */
  collapsed?: boolean;
  /** Shows the collapse button. In the 768–1279 rail AppShell replaces it with "open the full menu". */
  onToggleCollapse?: () => void;
  /** Project's active-route rule. */
  isActive: (to: string, end?: boolean) => boolean;
  /** Called after any link is clicked (closes the menu drawer). */
  onNavigate?: () => void;
  /**
   * Round 2 §2 prefetch: called with a menu link's path when the pointer rests on it or it takes focus, so the
   * layout can warm the page's code and its first list query (Apollo cache-first) before the click.
   */
  onPrefetch?: (path: string) => void;
  /** Shows a close button (menu drawer under 1024px). */
  onClose?: () => void;
  className?: string;
}

/** "⌘" on Apple devices, "Ctrl" elsewhere (shortcut hints). */
const MOD_KEY = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl ";

/** Focus on the black menu: the strong ring with its inner ring in the menu colour (01 §6.3). */
const focusRing = "outline-hidden focus-visible:shadow-[0_0_0_2px_var(--zc-nav-bg),0_0_0_4px_rgba(31,94,255,0.55)]";

/** v2 §3.1: 34px rows, radius 9, padding 0 10, 10px gap, 16px icon, 13/500 label. */
const rowBase = cx(
  "flex h-8.5 w-full items-center gap-2.5 rounded-thumb px-2.5 text-label font-medium transition-colors duration-fast ease-standard",
  focusRing,
);

const rowIdle = "text-nav-fg hover:bg-nav-hover hover:text-nav-fg-strong [&_svg]:text-nav-icon hover:[&_svg]:text-nav-fg-strong";
const rowActive = "bg-nav-active text-nav-fg-strong [&_svg]:text-nav-fg-strong";
/** Bottom zone (Notifications, Help & learn): 13/500 in the muted grey, quieter than the main menu. */
const rowMuted =
  "text-label text-nav-fg-muted [&_svg]:text-nav-fg-muted hover:bg-nav-hover hover:text-nav-fg hover:[&_svg]:text-nav-fg";

function WithTooltip({ show, label, children }: { show: boolean; label: string; children: ReactNode }) {
  return show ? (
    <Tooltip content={label} placement="right">
      {children}
    </Tooltip>
  ) : (
    <>{children}</>
  );
}

/** Count pill (02 §3.4): min 20×20 capsule, 11/600; blue with white text, orange with dark text. Hidden at 0. */
function CountPill({ count, tone }: { count: number; tone: "blue" | "orange" }) {
  return (
    <span
      className={cx(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none num",
        tone === "orange" ? "bg-tone-warning-dot text-fg" : "bg-nav-count text-brand-on",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** The collapsed rail's 8px dot on the icon's top right. */
function CountDot({ tone }: { tone: "blue" | "orange" }) {
  return (
    <span
      aria-hidden
      className={cx("absolute -right-1 -top-1 size-2 rounded-full", tone === "orange" ? "bg-tone-warning-dot" : "bg-nav-count")}
    />
  );
}

export function Sidebar({
  items,
  secondaryItems = [],
  settingsItem,
  bottomItems = [],
  productLabel,
  store,
  productVersion,
  whatsNewHref,
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
  onPrefetch,
}: SidebarProps) {
  const mainItems = [...items, ...secondaryItems];
  // v2 §3.1: Settings sits at the bottom with Notifications, not in the main list.
  const bottomLinks = [...bottomItems, ...(settingsItem ? [settingsItem] : [])];

  const notificationsRow = (
    <button
      type="button"
      aria-label={collapsed ? `Notifications${unreadCount ? `, ${unreadCount} unread` : ""}` : undefined}
      className={cx(rowBase, rowIdle, collapsed && "justify-center px-0")}
    >
      <span className="relative">
        <IconNotifications aria-hidden className="size-4 shrink-0" />
        {collapsed && unreadCount > 0 ? <CountDot tone="blue" /> : null}
      </span>
      {collapsed ? null : <span className="flex-1 truncate text-left">Notifications</span>}
      {!collapsed && unreadCount > 0 ? (
        <>
          <CountPill count={unreadCount} tone="blue" />
          <span className="sr-only"> unread</span>
        </>
      ) : null}
    </button>
  );

  const collapseButton =
    onToggleCollapse && !onClose ? (
      <Tooltip content={`${collapsed ? "Expand" : "Collapse"} menu (${MOD_KEY}\\)`} placement="right">
        <IconButton
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          variant="on-dark"
          size="xs"
          showTooltip={false}
          onPress={onToggleCollapse}
        >
          <IconCollapseSidebar aria-hidden className={cx("transition-transform duration-base", collapsed && "rotate-180")} />
        </IconButton>
      </Tooltip>
    ) : null;

  const userMenuItems = userMenu.filter((item) => !item.danger);
  const dangerItems = userMenu.filter((item) => item.danger);

  return (
    <aside
      aria-label="Sidebar"
      className={cx(
        // v2 §2.4: transform and opacity only, so the width snaps between the rail and the full menu.
        "zc-sidebar flex h-full flex-col border-r border-nav-border bg-nav pb-3 pt-4",
        collapsed ? "w-sidebar-collapsed px-2" : "w-sidebar px-3",
        className,
      )}
      onPointerOver={onPrefetch ? (event) => prefetchFromEvent(event.target, onPrefetch) : undefined}
      onFocus={onPrefetch ? (event) => prefetchFromEvent(event.target, onPrefetch) : undefined}
    >
      {/* The store switcher (merchant admin) or the wordmark with its label (Super Admin "Platform"). */}
      <div className={cx("flex min-h-9 items-center gap-2 pb-3", collapsed ? "justify-center" : store ? "px-0.5" : "px-2.5")}>
        {store ? (
          <StoreSwitcher store={store} collapsed={collapsed} />
        ) : collapsed ? (
          <span aria-label="Zcom" className="zc-brand-tile">Z</span>
        ) : (
          // Round 2 §6.1: the Z tile, "Zcom", and the product label ("Platform admin") in the console purple, 12px.
          <span className="flex min-w-0 flex-1 items-center gap-2.5">
            <span aria-hidden className="zc-brand-tile">Z</span>
            <span className="flex min-w-0 flex-col leading-none">
              <span className="zc-brand-word">Zcom</span>
              {productLabel ? <span className="mt-1 truncate text-caption text-nav-product">{productLabel}</span> : null}
            </span>
          </span>
        )}
        {onClose ? (
          <IconButton aria-label="Close menu" variant="on-dark" size="sm" showTooltip={false} onPress={onClose}>
            <IconClose aria-hidden />
          </IconButton>
        ) : null}
      </div>

      {/* Search (v2 §3.1): a 38px box with the ⌘K hint, search only; a circle in the rail. */}
      {onOpenSearch ? (
        <WithTooltip show={collapsed} label={`${searchPlaceholder} (${MOD_KEY}K)`}>
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label={collapsed ? searchPlaceholder : undefined}
            className={cx(
              "mb-2.5 flex h-9.5 items-center gap-2.5 border border-nav-border bg-nav-surface text-label text-nav-fg-muted transition-colors duration-fast hover:bg-nav-hover",
              collapsed ? "mx-auto w-10 justify-center rounded-full" : "w-full rounded-field pl-2.5 pr-2",
              focusRing,
            )}
          >
            <IconSearch aria-hidden className="size-4 shrink-0" />
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
        <NavList items={mainItems} collapsed={collapsed} isActive={isActive} onNavigate={onNavigate} />
      </nav>

      {/* Bottom zone (v2 §3.1): Notifications, then Settings */}
      <div className="flex flex-col gap-0.5 pt-2">
        {renderNotifications ? (
          <WithTooltip show={collapsed} label="Notifications">
            {renderNotifications(notificationsRow)}
          </WithTooltip>
        ) : null}
        {bottomLinks.length ? (
          <NavList items={bottomLinks} collapsed={collapsed} isActive={isActive} onNavigate={onNavigate} />
        ) : null}
      </div>

      {/* One divider, then the owner row */}
      <div aria-hidden className="my-2 h-px bg-nav-divider" />
      {user ? (
        <div className={cx("group/owner flex items-center gap-1", collapsed && "flex-col gap-2")}>
          <Dropdown placement="top-start">
            <DropdownTrigger>
              <button
                type="button"
                aria-label={`Account menu for ${user.name}`}
                className={cx(
                  "flex min-w-0 flex-1 items-center gap-2.5 rounded-[var(--zc-radius-field)] p-1.5 text-left transition-colors duration-fast hover:bg-nav-hover",
                  collapsed && "justify-center",
                  focusRing,
                )}
              >
                <Avatar name={user.name} src={user.avatarUrl} size="sm28" />
                {collapsed ? null : (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-label font-medium text-nav-fg transition-colors duration-fast group-hover/owner:text-nav-fg-strong">
                      {user.name}
                    </span>
                    {user.subtitle ? <span className="block truncate text-caption text-nav-fg-muted">{user.subtitle}</span> : null}
                  </span>
                )}
              </button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Account"
              className="min-w-60"
              onAction={(key) => userMenu.find((item) => item.key === key)?.onAction()}
              topContent={
                <div className="px-2.5 pb-1.5 pt-1.5">
                  <p className="truncate text-label font-medium text-fg">{user.name}</p>
                  <p className="truncate text-caption text-fg-muted">{user.email || user.subtitle}</p>
                  {productVersion ? (
                    <p className="mt-0.5 flex items-center gap-1.5 text-caption text-fg-muted">
                      <span>Zcom {productVersion}</span>
                      {whatsNewHref ? (
                        <>
                          <span aria-hidden>·</span>
                          <NavLink to={whatsNewHref} onClick={() => onNavigate?.()} className="font-medium text-brand-text hover:underline">
                            What&apos;s new
                          </NavLink>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              }
            >
              {/* An empty section would still draw a divider and padding, so it's left out when unused. */}
              {[
                ...(userMenuItems.length
                  ? [
                      <DropdownSection
                        key="account"
                        showDivider={dangerItems.length > 0}
                        aria-label="Account"
                        classNames={menuSectionClasses}
                      >
                        {userMenuItems.map((item) => (
                          <DropdownItem key={item.key}>{item.label}</DropdownItem>
                        ))}
                      </DropdownSection>,
                    ]
                  : []),
                <DropdownSection key="session" aria-label="Session" classNames={menuSectionClasses}>
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
        <div className={cx("flex items-center gap-1", collapsed && "flex-col gap-2")}>
          <WithTooltip show={collapsed} label="Log out">
            <button
              type="button"
              onClick={onLogout}
              aria-label={collapsed ? "Log out" : undefined}
              className={cx(rowBase, rowMuted, "min-w-0 flex-1", collapsed && "justify-center px-0")}
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

function storeInitials(name: string): string {
  const words = name.replace(/&/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : (words[0][1] ?? ""))).toUpperCase();
}

/**
 * v2 §3.1: a neutral badge with the initials, the store name and the domain. Opens the store chooser when it can.
 * Also the start of the phone top row (AppShell, v2 §10).
 */
export function StoreSwitcher({ store, collapsed = false, className: extra }: { store: SidebarStore; collapsed?: boolean; className?: string }) {
  const badge = (
    <span aria-hidden className="inline-grid size-8 shrink-0 place-items-center rounded-thumb bg-nav-store-badge text-caption-strong text-nav-fg-strong">
      {store.initials ?? storeInitials(store.name)}
    </span>
  );
  const body = collapsed ? (
    badge
  ) : (
    <>
      {badge}
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-label-strong text-nav-fg-strong">{store.name}</span>
        {store.domain ? <span className="block truncate text-caption text-nav-fg-muted">{store.domain}</span> : null}
      </span>
      {store.onSwitch || store.switchItems?.length ? <IconCaret aria-hidden className="size-3.5 shrink-0 text-nav-icon" /> : null}
    </>
  );
  const className = cx("flex min-w-0 flex-1 items-center gap-2.5 rounded-field p-1", collapsed && "justify-center", extra);
  if (store.switchItems?.length) {
    const items = store.switchItems;
    return (
      <Dropdown placement="bottom-start">
        <DropdownTrigger>
          <button
            type="button"
            aria-label={`Switch store, current: ${store.name}`}
            className={cx(className, "transition-colors duration-fast hover:bg-nav-hover", focusRing)}
          >
            {body}
          </button>
        </DropdownTrigger>
        <DropdownMenu aria-label="Switch store" onAction={(key) => items.find((item) => item.key === String(key))?.onSelect()}>
          {items.map((item) => (
            <DropdownItem key={item.key}>{item.label}</DropdownItem>
          ))}
        </DropdownMenu>
      </Dropdown>
    );
  }
  return store.onSwitch ? (
    <WithTooltip show={collapsed} label={`Switch store (${store.name})`}>
      <button
        type="button"
        onClick={store.onSwitch}
        aria-label={`Switch store, current: ${store.name}`}
        className={cx(className, "transition-colors duration-fast hover:bg-nav-hover", focusRing)}
      >
        {body}
      </button>
    </WithTooltip>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** The menu link under the pointer or in focus → its in-app path (round 2 §2 prefetch). */
function prefetchFromEvent(target: EventTarget, onPrefetch: (path: string) => void) {
  const link = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
  if (!link || link.origin !== window.location.origin) return;
  onPrefetch(link.pathname);
}

interface NavListProps {
  items: NavItem[];
  collapsed: boolean;
  isActive: SidebarProps["isActive"];
  onNavigate?: () => void;
  /** Bottom-zone links: muted grey, 13px. */
  muted?: boolean;
}

function NavList({ items, collapsed, isActive, onNavigate, muted = false }: NavListProps) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => (
        <li key={item.key}>
          <NavEntry item={item} collapsed={collapsed} isActive={isActive} onNavigate={onNavigate} muted={muted} />
        </li>
      ))}
    </ul>
  );
}

function NavEntry({ item, collapsed, isActive, onNavigate, muted }: { item: NavItem } & Omit<NavListProps, "items">) {
  const Icon = item.icon;
  const children = item.children ?? [];
  const sectionActive =
    children.some((child) => isActive(child.to)) || (item.to != null && isActive(item.to, item.end));
  const target = item.to && !children.length ? item.to : (children[0]?.to ?? item.to ?? "#");
  const count = item.count ?? 0;
  const tone = item.countTone ?? "plain";
  // The active section opens by itself; a click on its row folds it. Leaving the section resets that.
  const [folded, setFolded] = useState(false);
  useEffect(() => {
    if (!sectionActive) setFolded(false);
  }, [sectionActive]);
  const open = sectionActive && !folded;
  const toggles = sectionActive && children.length > 0 && !collapsed;

  return (
    <>
      <WithTooltip show={collapsed} label={item.label}>
        <NavLink
          to={target}
          end={item.end}
          aria-current={sectionActive && !children.length ? "page" : undefined}
          aria-expanded={toggles ? open : undefined}
          onClick={(event) => {
            if (toggles) {
              event.preventDefault();
              setFolded((value) => !value);
              return;
            }
            onNavigate?.();
          }}
          className={cx(
            rowBase,
            collapsed && "mx-auto h-10 w-10 justify-center px-0",
            sectionActive ? rowActive : muted ? rowMuted : rowIdle,
          )}
        >
          <span className="relative inline-flex">
            <Icon aria-hidden className="size-4 shrink-0" />
            {collapsed && count > 0 && tone !== "plain" ? <CountDot tone={tone} /> : null}
          </span>
          {collapsed ? (
            <span className="sr-only">{item.label}</span>
          ) : (
            <>
              <span className="flex-1 truncate">{item.label}</span>
              {count > 0 ? (
                tone === "plain" ? (
                  <span className="text-caption font-normal text-nav-fg-muted num">{count}</span>
                ) : (
                  <CountPill count={count} tone={tone} />
                )
              ) : null}
              {/* Sections with sub-pages show a 14px chevron: right when closed, down when open. */}
              {children.length ? (
                <IconCaret
                  aria-hidden
                  className={cx("size-3.5 shrink-0 transition-transform duration-fast", !open && "-rotate-90")}
                />
              ) : null}
            </>
          )}
        </NavLink>
      </WithTooltip>

      {/* Sub-items on the inset panel. They open in place and fade in (v2 §2.4: no height animation). */}
      {children.length && !collapsed ? (
        <div
          className={cx(
            "grid transition-opacity duration-base ease-standard",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <ul className="mt-0.5 flex flex-col gap-0.5 rounded-field bg-nav-sub" aria-hidden={!open}>
              {children.map((child) => {
                const active = isActive(child.to);
                return (
                  <li key={child.to}>
                    <NavLink
                      to={child.to}
                      tabIndex={open ? undefined : -1}
                      aria-current={active ? "page" : undefined}
                      onClick={() => onNavigate?.()}
                      className={cx(
                        "flex h-7.5 items-center rounded-lg pl-9 pr-2.5 text-label font-medium transition-colors duration-fast",
                        focusRing,
                        active
                          ? "bg-nav-sub-active text-nav-fg-strong"
                          : "text-nav-fg-muted hover:bg-nav-sub-hover hover:text-nav-fg-strong",
                      )}
                    >
                      <span className="truncate">{child.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
