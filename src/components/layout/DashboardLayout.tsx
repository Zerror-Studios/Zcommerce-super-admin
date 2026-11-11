import { Suspense, useCallback, useMemo, useState, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { allNavItems, mainNavItems, settingsNavItem, settingsPages, visibleNavItems } from "../../config/navigation";
import { askSuggestionsFor } from "../../config/ask-suggestions";
import { APP_VERSION } from "../../config/data-source";
import { getPlatformRoleLabel } from "../../lib/display-labels.util";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import { useNotificationCounts } from "../../hooks/use-platform-notifications";
import { useWebPushRefresh } from "../../hooks/use-web-push";
import { useAiTopUpRequests } from "../../hooks/use-platform-ai";
import { latestSubscriptionByClient } from "../../lib/subscription-lookup.util";
import { usePlatformSettings } from "../../providers/SettingsProvider";
import { subscriptionsNeedingAction } from "../billing/subscription-rows";
import { IconAdd, IconHome, IconLogout, IconNotifications, IconPayments, IconSettings, IconStore } from "../ui/icons";
import { AppShell } from "./AppShell";
import { AskBar } from "./Assistant";
import { AskZcomPlatformPanel } from "../assistant/AskZcomPlatformPanel";
import { readStoredFlag, storeFlag, useShellHotkeys } from "./shell-utils";
import { useShellDocumentTitle } from "./document-title";
import { CommandPalette } from "./CommandPalette";
import { AskZcomAiContext } from "./ask-context";
import { PlatformNotificationsPanel } from "./PlatformNotificationsPanel";
import { Sidebar } from "./Sidebar";
import { AiSpectrumDefs } from "../ui/Ai";
import { RouteSkeleton } from "../ui/RouteSkeleton";
import { ConfirmDialog, cx, toneTextClasses } from "../ui";
import type { CommandGroup } from "./types";
import { prefetchRoute } from "../../lib/route-prefetch";

const COLLAPSE_KEY = "zcommerce-sidebar-collapsed";

/** Settings opens its first section and stays lit on the others ("/settings/profile" → "/settings"). */
function sectionRoot(href: string): string {
  if (href.startsWith("/settings/")) return "/settings";
  return href;
}

/**
 * Analytics ▸ Revenue and Stores each open a group of views (pages/Analytics.tsx GROUPS); the menu item stays lit on
 * every view of its group, and only that item. Analytics Level 1 §3.7: the old System item is gone; its integration,
 * sync and platform-health views light System health, and the old Performance URL (redirected) lights Stores.
 */
const NAV_GROUP_ALIASES: Record<string, string[]> = {
  "/analytics/revenue": ["/analytics/money", "/analytics/ai-cost"],
  "/analytics/store-sales": ["/analytics/performance", "/analytics/merchant-sales", "/analytics/retention", "/analytics/usage"],
  "/system-health": ["/analytics/integrations", "/analytics/sync", "/analytics/health"],
};

function pathMatches(pathname: string, href: string, end = false): boolean {
  if (end) return pathname === href;
  if ((NAV_GROUP_ALIASES[href] ?? []).some((alias) => pathname === alias || pathname.startsWith(`${alias}/`))) return true;
  href = sectionRoot(href);
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Label of the nav entry that owns the current path (mobile header and browser tab). */
function pageLabelFor(pathname: string): string | undefined {
  for (const item of allNavItems) {
    const child = item.children?.find((c) => pathMatches(pathname, c.to));
    if (child) return child.label;
    if (item.to && pathMatches(pathname, item.to, item.end)) return item.label;
  }
  return undefined;
}

export function DashboardLayout() {
  const location = useLocation();
  const { signOut, can, user } = useAuth();
  const { clients, subscriptions, incomplete, pageGuardReached, loadRemaining, totalCount } = useClients();
  const canAddStore = can(PLATFORM_PERMISSIONS.TENANTS_MANAGE);

  const [collapsed, setCollapsed] = useState(() => readStoredFlag(COLLAPSE_KEY));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Log out asks first (04 S-07i).
  const [signOutOpen, setSignOutOpen] = useState(false);
  // PRD-024 FR-4.1.5: the server feed; the bell's count is polled while the browser tab is visible.
  const notificationCounts = useNotificationCounts();
  // PRD-033 FR-2.2: keep this browser's push row fresh (silent, once per load).
  useWebPushRefresh();

  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => {
      storeFlag(COLLAPSE_KEY, !prev);
      return !prev;
    });
  }, []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);

  // AI layer (backend PRD-026 FR-7.2; v2 §3.3): the Zcom AI bar and its sheet (click or ⌘J), the only AI entry
  // point, only with platform:ai:ask (Owner and Admin); without it no entry point shows.
  const canAsk = can(PLATFORM_PERMISSIONS.AI_ASK);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | undefined>();
  const openAssistant = useCallback(
    (question?: string) => {
      if (!canAsk) return;
      setPendingQuestion(question);
      setIsAssistantOpen(true);
    },
    [canAsk],
  );
  const askHotkey = useCallback(() => openAssistant(), [openAssistant]);
  useShellHotkeys({ onSearch: openPalette, onToggleSidebar: toggleSidebar, onAsk: askHotkey });

  const pageLabel = pageLabelFor(location.pathname);
  const askSuggestions = askSuggestionsFor(location.pathname);
  // Round 2 G3: no bar on pages with their own composer (a support ticket's reply box).
  const hideAskBar = pathMatches(location.pathname, "/support/tickets");
  // Round 2 G14: "‹Record› · ‹Section› · Zcom Super admin"; record pages add theirs with useDocumentTitle.
  useShellDocumentTitle(pageLabel, "Zcom Super admin");

  // `signOut` ends with `clearAuth`, which hard-reloads to /sign-in; the
  // sign-in page shows the "logged out" notice itself (review C-L5).
  const handleLogout = () => {
    void signOut();
  };

  // Menu counts (04 S-00, 02 §3.4): stores owing now or due within 7 days, and open AI top-up requests.
  const { settings } = usePlatformSettings();
  const subscriptionCount = useMemo(
    () => subscriptionsNeedingAction(clients, latestSubscriptionByClient(subscriptions), settings.gracePeriodDays),
    [clients, subscriptions, settings.gracePeriodDays],
  );
  // One row is enough: only the total is read (skipped without platform:ai:read).
  const topUps = useAiTopUpRequests({ status: "OPEN", limit: 1, offset: 0 });
  const openTopUps = topUps.data?.totalCount ?? 0;

  const items = useMemo(
    () =>
      visibleNavItems(mainNavItems, can).map((item) => {
        // PRD-024 FR-1.6 (B-06): the server's store count, not the loaded rows.
        if (item.key === "stores") return { ...item, count: totalCount };
        if (item.key === "subscriptions") return { ...item, count: subscriptionCount };
        if (item.key === "analytics") return { ...item, count: openTopUps };
        return item;
      }),
    [can, totalCount, subscriptionCount, openTopUps],
  );

  // Round 2 G1: the console palette searches the loaded stores, the pages and the settings sections in the
  // browser (the store list is already loaded by ClientsProvider); Stores come first.
  const commandGroups = useMemo<CommandGroup[]>(
    () => [
      {
        title: "Stores",
        noun: "stores",
        showAllHref: "/stores",
        items: clients.map((client) => ({
          id: `store-${client.id}`,
          label: client.storeName,
          description: [client.ownerName, client.ownerEmail].filter(Boolean).join(" · ") || undefined,
          hint: "Store",
          keywords: `${client.ownerName} ${client.ownerEmail}`,
          icon: IconStore,
          href: `/stores/${client.id}`,
        })),
      },
      {
        title: "Pages",
        items: visibleNavItems(mainNavItems, can).flatMap((item) =>
          item.children?.length
            ? item.children.map((child) => ({ id: `page-${child.to}`, label: child.label, description: item.label, hint: "Page", keywords: item.label, icon: item.icon, href: child.to }))
            : [{ id: `page-${item.key}`, label: item.label, hint: "Page", icon: item.icon, href: item.to }],
        ),
      },
      {
        title: "Settings",
        items: settingsPages.map((page) => ({
          id: `settings-${page.to}`,
          label: page.label,
          hint: "Settings",
          keywords: "settings",
          icon: IconSettings,
          href: page.to,
        })),
      },
      ...(canAddStore
        ? [{ title: "Actions", items: [{ id: "add-store", label: "Create store", icon: IconAdd, href: "/stores/new" }] }]
        : []),
    ],
    [can, canAddStore, clients],
  );

  // The empty palette's "Jump to" (G1).
  const jumpTo = useMemo(
    () => [
      { id: "jump-home", label: "Home", icon: IconHome, href: "/" },
      { id: "jump-stores", label: "Stores", icon: IconStore, href: "/stores" },
      { id: "jump-billing", label: "Billing", icon: IconPayments, href: "/subscriptions" },
      { id: "jump-settings", label: "Settings", icon: IconSettings, href: "/settings/profile" },
    ],
    [],
  );

  const unreadCount = notificationCounts.total;
  const panel = (trigger: ReactNode) => <PlatformNotificationsPanel trigger={trigger} counts={notificationCounts} />;

  const isActive = (to: string, end?: boolean) => pathMatches(location.pathname, to, end);
  const sidebarProps = {
    items,
    // Round 2 §2: menu hover/focus loads the page's code before the click.
    onPrefetch: prefetchRoute,
    settingsItem: settingsNavItem,
    productLabel: "Platform admin",
    productVersion: APP_VERSION,
    searchPlaceholder: "Search stores",
    onOpenSearch: openPalette,
    unreadCount,
    renderNotifications: (row: ReactNode) => panel(row),
    // PRD-024 FR-1.5 (P-06): the signed-in platform user (platformMe) and their role.
    user: user ? { name: user.name || user.email, email: user.email, subtitle: getPlatformRoleLabel(user.role) } : undefined,
    // Account menu: name, email and version in its header, then only Log out (red, confirms first; owner,
    // 2026-11-04, like the store dashboard). Profile & security is in Settings.
    userMenu: [
      { key: "logout", label: "Log out", onAction: () => setSignOutOpen(true), danger: true },
    ],
    onLogout: handleLogout,
    isActive,
  };

  return (
    <>
      <AppShell
        sidebar={<Sidebar {...sidebarProps} collapsed={collapsed} onToggleCollapse={toggleSidebar} />}
        drawerSidebar={<Sidebar {...sidebarProps} onClose={() => setMobileOpen(false)} onNavigate={() => setMobileOpen(false)} />}
        isDrawerOpen={mobileOpen}
        onDrawerOpenChange={setMobileOpen}
        mobileTitle={pageLabel}
        topBarTitle="Zcom"
        topBarSubtitle="Super admin"
        onOpenSearch={openPalette}
        floating={
          // Round 2 G3: while the chat box is open the bar steps aside (the box grows out of it).
          canAsk && !hideAskBar
            ? (hidden) =>
                isAssistantOpen ? null : <AskBar placeholder="Ask Zcom AI about any store…" hidden={hidden} onOpen={openAssistant} />
            : undefined
        }
        mobileActions={panel(
          // Top bar bell (02 §4): circle on-dark 40px, an 8px blue dot when unread.
          <button
            type="button"
            aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
            className="zc-icon-btn zc-icon-btn--on-dark zc-icon-btn--lg relative"
          >
            <IconNotifications aria-hidden />
            {unreadCount > 0 ? <span aria-hidden className="absolute right-2.5 top-2.5 size-2 rounded-full bg-nav-count" /> : null}
          </button>,
        )}
      >
        {/* Every screen built on the store list is partial when paging stopped early (W2V-C-01); the Stores page says so itself. */}
        {incomplete && !pathMatches(location.pathname, "/stores", true) ? (
          <p role="status" className={cx("mb-3 text-label", toneTextClasses.warning)}>
            Store data is incomplete: {clients.length} of {totalCount} stores loaded, so totals here may be low.{" "}
            <button type="button" className="underline" onClick={loadRemaining}>
              {pageGuardReached ? "Load the next 5,000" : "Retry"}
            </button>
          </p>
        ) : null}
        <AskZcomAiContext.Provider value={canAsk ? openAssistant : null}>
          {/* Page chunks load inside the shell (board 47): the menu stays, the page frame shows at once. */}
          <Suspense fallback={<RouteSkeleton />}>
            <Outlet />
          </Suspense>
        </AskZcomAiContext.Provider>
      </AppShell>

      <ConfirmDialog
        isOpen={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        onConfirm={() => {
          setSignOutOpen(false);
          handleLogout();
        }}
        tone="neutral"
        icon={<IconLogout aria-hidden />}
        title="Log out of Zcom?"
        description="You'll need your password to come back in."
        confirmLabel="Log out"
      />
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        groups={commandGroups}
        placeholder="Search stores, pages and settings"
        recentKey="zc.console.palette.recent"
        jumpTo={jumpTo}
      />
      <AiSpectrumDefs />
      {canAsk ? (
        <AskZcomPlatformPanel
          isOpen={isAssistantOpen}
          onClose={() => setIsAssistantOpen(false)}
          pendingQuestion={pendingQuestion}
          onPendingConsumed={() => setPendingQuestion(undefined)}
          pageLabel={pageLabel}
          suggestions={askSuggestions}
        />
      ) : null}
    </>
  );
}
