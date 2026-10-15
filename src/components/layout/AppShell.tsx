/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * App frame (docs/design/02-components.md §1–2): dark sidebar on the left, no top bar; only the content area
 * scrolls. Below 1024px the sidebar becomes an off-canvas drawer and a 52px light header shows a menu button,
 * the page title and the bell.
 */
import { Drawer, DrawerBody, DrawerContent, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import type { ReactNode } from "react";
import { cx } from "../ui/cx";
import { IconMenu } from "../ui/icons";
import { Modal } from "../ui/Modal";
import { Kbd } from "../ui/Primitives";

export interface AppShellProps {
  /** Desktop sidebar (1024px and up). Omit to hide it (e.g. full-screen editors). */
  sidebar?: ReactNode;
  /** Sidebar rendered inside the mobile drawer. */
  drawerSidebar?: ReactNode;
  isDrawerOpen?: boolean;
  onDrawerOpenChange?: (open: boolean) => void;
  /** Page title in the mobile header. */
  mobileTitle?: ReactNode;
  /** Right side of the mobile header (the bell). */
  mobileActions?: ReactNode;
  /** Extra classes for the content area. */
  contentClassName?: string;
  /** Content above the page inside the main area (e.g. the support-session banner). */
  banner?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  sidebar,
  drawerSidebar,
  isDrawerOpen = false,
  onDrawerOpenChange,
  mobileTitle,
  mobileActions,
  contentClassName,
  banner,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-dvh overflow-hidden bg-page">
      {sidebar ? <div className="relative z-20 hidden h-full shrink-0 lg:block">{sidebar}</div> : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {drawerSidebar ? (
          <header className="flex h-13 shrink-0 items-center gap-2 border-b border-line bg-surface px-2 lg:hidden">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => onDrawerOpenChange?.(true)}
              className="flex size-9 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-sunken hover:text-fg"
            >
              <IconMenu aria-hidden className="size-5" />
            </button>
            <p className="min-w-0 flex-1 truncate text-body font-semibold text-fg">{mobileTitle}</p>
            {mobileActions}
          </header>
        ) : null}

        <main
          className={cx(
            "custom-scroll relative min-h-0 flex-1 overflow-y-auto",
            contentClassName,
          )}
        >
          {banner}
          <div className="mx-auto w-full max-w-content-wide px-4 pb-16 pt-5 sm:px-8 sm:pt-7">{children}</div>
        </main>
      </div>

      {drawerSidebar ? (
        <Drawer
          isOpen={isDrawerOpen}
          onOpenChange={onDrawerOpenChange}
          placement="left"
          hideCloseButton
          classNames={{ base: "w-sidebar max-w-sidebar rounded-none bg-nav", backdrop: "bg-overlay/40" }}
        >
          <DrawerContent>
            <DrawerBody className="h-full p-0">{drawerSidebar}</DrawerBody>
          </DrawerContent>
        </Drawer>
      ) : null}
    </div>
  );
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["⌘", "K"], label: "Search and go to" },
  { keys: ["⌘", "\\"], label: "Collapse or expand the sidebar" },
  { keys: ["Esc"], label: "Close a dialog or menu" },
];

/** Keyboard shortcuts (user menu › Keyboard shortcuts). Ctrl replaces ⌘ on Windows. */
export function ShortcutsDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} width="sm">
      <ModalContent>
        <ModalHeader>Keyboard shortcuts</ModalHeader>
        <ModalBody className="pb-6">
          <ul className="flex flex-col divide-y divide-line-subtle">
            {SHORTCUTS.map((shortcut) => (
              <li key={shortcut.label} className="flex items-center justify-between py-2.5">
                <span className="text-body text-fg">{shortcut.label}</span>
                <span className="flex gap-1">
                  {shortcut.keys.map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-caption text-fg-subtle">On Windows, use Ctrl instead of ⌘.</p>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
