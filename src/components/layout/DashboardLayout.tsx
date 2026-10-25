import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { allNavItems, mainNavItems } from "../../config/navigation";
import { ASSISTANT_SUGGESTIONS, sampleAssistantAnswer } from "../../lib/aiSamples";
import { client as apollo } from "../../lib/apollo-client";
import { toPickerDay } from "../../lib/api-report-adapters";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { PLATFORM_REVENUE_OVERVIEW } from "../../graphql/reports";
import type { PlatformRevenueOverview } from "../../types/platform-api";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import { IconAdd, IconNotifications, IconStore } from "../ui/icons";
import { AppShell } from "./AppShell";
import { AskBar, AssistantPanel } from "./Assistant";
import { readStoredFlag, storeFlag, useShellHotkeys } from "./shell-utils";
import { CommandPalette } from "./CommandPalette";
import { NotificationsPanel } from "./NotificationsPanel";
import { Sidebar } from "./Sidebar";
import { AiSpectrumDefs } from "../ui/Ai";
import { cx, toneTextClasses } from "../ui";
import type { CommandGroup, NotificationEntry } from "./types";

const COLLAPSE_KEY = "zcommerce-sidebar-collapsed";
const APP_VERSION = "1.0.0";

function pathMatches(pathname: string, href: string, end = false): boolean {
  if (end) return pathname === href;
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

const NOTIFICATION_TABS = [
  { key: "payments", label: "Payments" },
  { key: "stores", label: "Stores" },
  { key: "health", label: "Health" },
];

export function DashboardLayout() {
  const location = useLocation();
  const { signOut, can } = useAuth();
  const { clients, subscriptions, incomplete, pageGuardReached, loadRemaining, totalCount } = useClients();
  const canAddStore = can(PLATFORM_PERMISSIONS.TENANTS_MANAGE);

  const [collapsed, setCollapsed] = useState(() => readStoredFlag(COLLAPSE_KEY));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // No notifications feed exists yet (PRD-005 §8 Q14: the sample data went with mock mode); the panel shows its empty state.
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);

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

  const items = useMemo(
    () => mainNavItems.map((item) => (item.key === "stores" ? { ...item, count: clients.length } : item)),
    [clients.length],
  );

  const commandGroups = useMemo<CommandGroup[]>(
    () => [
      {
        title: "Pages",
        items: allNavItems.flatMap((item) =>
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
    [canAddStore, clients],
  );

  const unreadCount = notifications.filter((item) => item.unread).length;
  const panel = (trigger: ReactNode) => (
    <NotificationsPanel
      trigger={trigger}
      items={notifications}
      tabs={NOTIFICATION_TABS}
      onMarkAllRead={() => setNotifications((list) => list.map((item) => ({ ...item, unread: false })))}
      onItemOpen={(entry) =>
        setNotifications((list) => list.map((item) => (item.id === entry.id ? { ...item, unread: false } : item)))
      }
    />
  );

  const isActive = (to: string, end?: boolean) => pathMatches(location.pathname, to, end);
  const sidebarProps = {
    items,
    productLabel: "Super admin",
    productVersion: APP_VERSION,
    searchPlaceholder: "Search stores",
    onOpenSearch: openPalette,
    unreadCount,
    renderNotifications: (row: ReactNode) => panel(row),
    // One shared Super admin account: no name/email card, just Log out.
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
        floating={(hidden) => <AskBar placeholder="Ask anything about your stores…" hidden={hidden} onOpen={openAssistant} />}
        mobileActions={panel(
          <button
            type="button"
            aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
            className="relative flex size-9 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-sunken hover:text-fg"
          >
            <IconNotifications aria-hidden className="size-5" />
            {unreadCount > 0 ? <span aria-hidden className="absolute right-2 top-2 size-1.5 rounded-full bg-brand" /> : null}
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
