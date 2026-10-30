import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { allNavItems, mainNavItems, visibleNavItems } from "../../config/navigation";
import { APP_VERSION } from "../../config/data-source";
import { ASSISTANT_SUGGESTIONS, sampleAssistantAnswer } from "../../lib/aiSamples";
import { client as apollo } from "../../lib/apollo-client";
import { toPickerDay } from "../../lib/api-report-adapters";
import { getPlatformRoleLabel } from "../../lib/display-labels.util";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { PLATFORM_REVENUE_OVERVIEW } from "../../graphql/reports";
import type { PlatformRevenueOverview } from "../../types/platform-api";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import { useNotificationCounts } from "../../hooks/use-platform-notifications";
import { useAiTopUpRequests } from "../../hooks/use-platform-ai";
import { latestSubscriptionByClient } from "../../lib/subscription-lookup.util";
import { usePlatformSettings } from "../../providers/SettingsProvider";
import { subscriptionsNeedingAction } from "../billing/subscription-rows";
import { IconAdd, IconNotifications, IconStore } from "../ui/icons";
import { AppShell } from "./AppShell";
import { AskBar, AssistantPanel } from "./Assistant";
import { readStoredFlag, storeFlag, useShellHotkeys } from "./shell-utils";
import { CommandPalette } from "./CommandPalette";
import { PlatformNotificationsPanel } from "./PlatformNotificationsPanel";
import { Sidebar } from "./Sidebar";
import { AiSpectrumDefs } from "../ui/Ai";
import { ConfirmDialog, cx, toneTextClasses } from "../ui";
import type { CommandGroup } from "./types";

const COLLAPSE_KEY = "zcommerce-sidebar-collapsed";

/** Menu items that open a page's first tab or section stay lit on its other tabs ("/analytics/revenue" → "/analytics"). */
function sectionRoot(href: string): string {
  if (href.startsWith("/analytics/")) return "/analytics";
  if (href.startsWith("/settings/")) return "/settings";
  return href;
}

function pathMatches(pathname: string, href: string, end = false): boolean {
  if (end) return pathname === href;
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
  // Sign out asks first (04 S-07i).
  const [signOutOpen, setSignOutOpen] = useState(false);
  const navigate = useNavigate();
  // PRD-024 FR-4.1.5: the server feed; the bell's count is polled while the browser tab is visible.
  const notificationCounts = useNotificationCounts();

  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => {
      storeFlag(COLLAPSE_KEY, !prev);
      return !prev;
    });
  }, []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);

  // AI layer: Ask bar, assistant panel, ⌘J and "Ask AI" in ⌘K (same as the Merchant dashboard).
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | undefined>();
  const openAssistant = useCallback((question?: string) => {
    setPendingQuestion(question);
    setIsAssistantOpen(true);
  }, []);
  const askHotkey = useCallback(() => openAssistant(), [openAssistant]);
  const askAssistant = useCallback(
    (question: string) =>
      sampleAssistantAnswer(question, {
        clients,
        subscriptions,
        // Money comes from the server rollup, fetched only when asked (root CLAUDE.md §4).
        loadMonthSummary: async () => {
          const now = new Date();
          const { data } = await apollo.query<{ platformRevenueOverview: PlatformRevenueOverview }>({
            query: PLATFORM_REVENUE_OVERVIEW,
            variables: { range: { start: toPickerDay(new Date(now.getFullYear(), now.getMonth(), 1)), end: toPickerDay(now) } },
            fetchPolicy: "network-only",
          });
          const summary = data.platformRevenueOverview.summary;
          return { earnedMonth: summary.earnedMonth, paidStoresMonth: summary.paidStoresMonth };
        },
      }),
    [clients, subscriptions],
  );
  useShellHotkeys({ onSearch: openPalette, onToggleSidebar: toggleSidebar, onAsk: askHotkey });

  const pageLabel = pageLabelFor(location.pathname);
  useEffect(() => {
    document.title = pageLabel ? `${pageLabel} · Zcom Super admin` : "Zcom Super admin";
  }, [pageLabel]);

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
        if (item.key === "ai") return { ...item, count: openTopUps };
        return item;
      }),
    [can, totalCount, subscriptionCount, openTopUps],
  );

  const commandGroups = useMemo<CommandGroup[]>(
    () => [
      {
        title: "Pages",
        items: visibleNavItems(allNavItems, can).flatMap((item) =>
          item.children?.length
            ? item.children.map((child) => ({ id: `page-${child.to}`, label: child.label, hint: item.label, keywords: item.label, icon: item.icon, href: child.to }))
            : [{ id: `page-${item.key}`, label: item.label, icon: item.icon, href: item.to }],
        ),
      },
      {
        title: "Stores",
        items: clients.map((client) => ({
          id: `store-${client.id}`,
          label: client.storeName,
          hint: client.ownerEmail,
          keywords: `${client.ownerName} ${client.ownerEmail}`,
          icon: IconStore,
          href: `/stores/${client.id}`,
        })),
      },
      ...(canAddStore
        ? [{ title: "Actions", items: [{ id: "add-store", label: "Add store", icon: IconAdd, href: "/stores/new" }] }]
        : []),
    ],
    [can, canAddStore, clients],
  );

  const unreadCount = notificationCounts.total;
  const panel = (trigger: ReactNode) => <PlatformNotificationsPanel trigger={trigger} counts={notificationCounts} />;

  const isActive = (to: string, end?: boolean) => pathMatches(location.pathname, to, end);
  const sidebarProps = {
    items,
    productLabel: "Super admin",
    productVersion: APP_VERSION,
    searchPlaceholder: "Search stores",
    onOpenSearch: openPalette,
    unreadCount,
    renderNotifications: (row: ReactNode) => panel(row),
    // PRD-024 FR-1.5 (P-06): the signed-in platform user (platformMe) and their role.
    user: user ? { name: user.name || user.email, email: user.email, subtitle: getPlatformRoleLabel(user.role) } : undefined,
    // Account menu (02 §3.6): Profile & security, then Sign out (red, after a divider, confirms first).
    userMenu: [
      { key: "profile", label: "Profile & security", onAction: () => navigate("/settings/profile") },
      { key: "logout", label: "Sign out", onAction: () => setSignOutOpen(true), danger: true },
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
        floating={(hidden) => <AskBar placeholder="Ask anything about your stores…" hidden={hidden} onOpen={openAssistant} />}
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
        <Outlet />
      </AppShell>

      <ConfirmDialog
        isOpen={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        onConfirm={() => {
          setSignOutOpen(false);
          handleLogout();
        }}
        title="Sign out of Zcom?"
        description="You'll need to sign in again to use the console."
        confirmLabel="Sign out"
      />
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        groups={commandGroups}
        placeholder="Search stores, pages and actions"
        onAskAi={openAssistant}
      />
      <AiSpectrumDefs />
      <AssistantPanel
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        pendingQuestion={pendingQuestion}
        onPendingConsumed={() => setPendingQuestion(undefined)}
        onAsk={askAssistant}
        suggestions={ASSISTANT_SUGGESTIONS}
        thinkingLabel="Looking at your stores…"
      />
    </>
  );
}
