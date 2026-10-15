/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Drawer, DrawerBody, DrawerContent } from "@heroui/react";
import type { ReactNode } from "react";
import { cx } from "../ui/cx";

export interface AppShellProps {
  /** The Topbar. */
  topbar: ReactNode;
  /** Desktop sidebar (lg and up). Omit to hide it (e.g. full-screen editors). */
  sidebar?: ReactNode;
  /** Sidebar rendered inside the mobile drawer (below lg). */
  drawerSidebar?: ReactNode;
  isDrawerOpen?: boolean;
  onDrawerOpenChange?: (open: boolean) => void;
  /** Extra classes for the content area (padding defaults to 24px, 32px from xl). */
  contentClassName?: string;
  children: ReactNode;
}

/**
 * App frame (component-specs §15–16): the shell fills the viewport; topbar on top, sidebar left,
 * and only the content area scrolls (same in both products).
 */
export function AppShell({
  topbar,
  sidebar,
  drawerSidebar,
  isDrawerOpen = false,
  onDrawerOpenChange,
  contentClassName,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-page">
      {topbar}
      <div className="flex min-h-0 flex-1">
        {sidebar ? <div className="relative z-30 hidden h-full shrink-0 lg:block">{sidebar}</div> : null}
        <main className={cx("custom-scroll relative min-h-0 min-w-0 flex-1 overflow-y-auto p-6 xl:p-8", contentClassName)}>
          {children}
        </main>
      </div>

      {drawerSidebar ? (
        <Drawer
          isOpen={isDrawerOpen}
          onOpenChange={onDrawerOpenChange}
          placement="left"
          hideCloseButton
          classNames={{ base: "w-drawer max-w-drawer rounded-none", backdrop: "bg-overlay/50" }}
        >
          <DrawerContent>
            <DrawerBody className="h-full p-0">{drawerSidebar}</DrawerBody>
          </DrawerContent>
        </Drawer>
      ) : null}
    </div>
  );
}
