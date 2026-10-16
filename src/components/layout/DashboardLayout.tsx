import { addToast } from "@heroui/react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { allNavItems, mainNavItems } from "../../config/navigation";
import { notifications as sampleNotifications } from "../../lib/mockData";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import type { Notification } from "../../types";
import { IconAdd, IconBilling, IconNotifications, IconStore, IconWarning } from "../ui/icons";
import { AppShell } from "./AppShell";
import { readStoredFlag, storeFlag, useShellHotkeys } from "./shell-utils";
import { CommandPalette } from "./CommandPalette";
import { NotificationsPanel } from "./NotificationsPanel";
import { Sidebar } from "./Sidebar";
import { AiSpectrumDefs } from "../ui/Ai";
import type { CommandGroup, NotificationEntry } from "./types";
import { toasts } from "../../copy";

const COLLAPSE_KEY = "zcommerce-sidebar-collapsed";

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

/** Sample notifications mapped to the Super Admin tabs (docs/design/02-components.md §12): Payments · Stores · Health. */
function toEntry(item: Notification): NotificationEntry {
  const payments = item.category === "Billing";
  const failed = /fail|overdue|suspend/i.test(item.description);
  return {
    id: item.id,
    category: payments ? "payments" : "stores",
    title: item.description,
    time: item.timestamp,
    unread: !item.read,
    icon: failed ? IconWarning : payments ? IconBilling : IconStore,
    critical: failed,
  };
}

const NOTIFICATION_TABS = [
  { key: "payments", label: "Payments" },
  { key: "stores", label: "Stores" },
  { key: "health", label: "Health" },
];

export function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { clients } = useClients();

  const [collapsed, setCollapsed] = useState(() => readStoredFlag(COLLAPSE_KEY));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationEntry[]>(() => sampleNotifications.map(toEntry));

  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => {
      storeFlag(COLLAPSE_KEY, !prev);
      return !prev;
    });
  }, []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  useShellHotkeys({ onSearch: openPalette, onToggleSidebar: toggleSidebar });

  const pageLabel = pageLabelFor(location.pathname);
  useEffect(() => {
    document.title = pageLabel ? `${pageLabel} · Zcommerce Super admin` : "Zcommerce Super admin";
  }, [pageLabel]);

  const handleLogout = () => {
    signOut();
    navigate("/sign-in", { replace: true });
    addToast({ title: toasts.loggedOut });
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
      { title: "Actions", items: [{ id: "add-store", label: "Add store", icon: IconAdd, href: "/stores/new" }] },
    ],
    [clients],
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
        <Outlet />
      </AppShell>

      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} groups={commandGroups} placeholder="Search stores, pages and actions" />
      <AiSpectrumDefs />
    </>
  );
}
