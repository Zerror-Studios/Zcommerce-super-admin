import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { mainNavItems } from "../../config/navigation";
import { currentAdmin } from "../../lib/mockData";
import { MessagesPopover } from "../common/MessagesPopover";
import { NotificationsPopover } from "../common/NotificationsPopover";
import { ProfileDropdown } from "../common/ProfileDropdown";
import { AppShell } from "./AppShell";
import { Sidebar } from "./Sidebar";
import type { SidebarProps } from "./Sidebar";
import { SidebarCredit } from "./SidebarFooter";
import { Topbar } from "./Topbar";

const COLLAPSE_KEY = "zcommerce-sidebar-collapsed";

function pathMatches(pathname: string, href: string, end = false): boolean {
  if (end) return pathname === href;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getActiveSectionKey(pathname: string): string | null {
  const match = mainNavItems.find(
    (item) => item.children?.length && item.to != null && pathMatches(pathname, item.to),
  );
  return match?.key ?? null;
}

export function DashboardLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(COLLAPSE_KEY) === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(() =>
    getActiveSectionKey(location.pathname),
  );

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const active = getActiveSectionKey(location.pathname);
    if (active) setOpenSection(active);
  }, [location.pathname]);

  const sidebarProps: SidebarProps = {
    items: mainNavItems,
    openKey: openSection,
    onGroupToggle: (item) => setOpenSection((prev) => (prev === item.key ? null : item.key)),
    isActive: (to, end) => pathMatches(location.pathname, to, end),
    credit: <SidebarCredit version="1.01.000" />,
  };

  return (
    <AppShell
      topbar={
        <Topbar
          badge={currentAdmin.role}
          onOpenMobileNav={() => setMobileOpen(true)}
          actions={
            <>
              <NotificationsPopover />
              <MessagesPopover />
              <ProfileDropdown />
            </>
          }
        />
      }
      sidebar={
        <Sidebar
          {...sidebarProps}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((prev) => !prev)}
        />
      }
      drawerSidebar={
        <Sidebar
          {...sidebarProps}
          onClose={() => setMobileOpen(false)}
          onNavigate={() => setMobileOpen(false)}
        />
      }
      isDrawerOpen={mobileOpen}
      onDrawerOpenChange={setMobileOpen}
    >
      <Outlet />
    </AppShell>
  );
}
