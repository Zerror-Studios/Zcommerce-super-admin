/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * App frame (02 §1–2, §4): the black menu on the left (sticky, never scrolls) and `main`, the only thing that
 * scrolls (stable scrollbar gutter). No top bar at 1024px and up. Below 1024px a 56px black top bar shows a circle
 * menu button, the store name over the product line, and search and notifications; the menu opens as a 280px
 * drawer from the left. Page padding: 32px (≥1024), 24px (768–1023), 16px (<768). "Skip to content" is the first
 * focusable element.
 */
import { Drawer, DrawerBody, DrawerContent } from "@heroui/react";
import { useRef, useState, type ReactNode } from "react";
import { cx } from "../ui/cx";
import { IconButton } from "../ui/IconButton";
import { IconMenu, IconSearch } from "../ui/icons";
import { Kbd } from "../ui/Primitives";

export interface AppShellProps {
  /** Desktop menu (1024px and up). Omit to hide it (e.g. full-screen editors). */
  sidebar?: ReactNode;
  /** Menu rendered inside the drawer under 1024px. */
  drawerSidebar?: ReactNode;
  isDrawerOpen?: boolean;
  onDrawerOpenChange?: (open: boolean) => void;
  /** Top bar, first line: the store name (admin) or "Zcom" (super admin). Falls back to mobileTitle. */
  topBarTitle?: ReactNode;
  /** Top bar, second line: "Zcom admin" / "Super admin". */
  topBarSubtitle?: ReactNode;
  /** LEGACY: the page title; used as the top bar's first line when topBarTitle is missing. */
  mobileTitle?: ReactNode;
  /** Top bar search button (opens the palette as a full-screen sheet). */
  onOpenSearch?: () => void;
  /** Right side of the top bar (the bell). */
  mobileActions?: ReactNode;
  /** Extra classes for the content area. */
  contentClassName?: string;
  /** Content above the page inside the main area (support banner, billing notices). */
  banner?: ReactNode;
  /** Full-width strip at the very top of the window, above the menu and the page. */
  topBanner?: ReactNode;
  /**
   * Floating element at the bottom centre of `main` (the AI ask bar). Receives `hidden`, true while the user
   * scrolls down. Pages get bottom padding so it never covers save bars or table footers.
   */
  floating?: (hidden: boolean) => ReactNode;
  children: ReactNode;
}

export function AppShell({
  sidebar,
  drawerSidebar,
  isDrawerOpen = false,
  onDrawerOpenChange,
  topBarTitle,
  topBarSubtitle,
  mobileTitle,
  onOpenSearch,
  mobileActions,
  contentClassName,
  banner,
  topBanner,
  floating,
  children,
}: AppShellProps) {
  const [floatingHidden, setFloatingHidden] = useState(false);
  const lastScroll = useRef(0);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-page">
      <a
        href="#main-content"
        className="sr-only z-[var(--zc-z-toast)] rounded-full bg-surface px-4 py-2 text-body font-medium text-fg shadow-popover focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:shadow-focus-strong"
      >
        Skip to content
      </a>
      {topBanner}
      <div className="flex min-h-0 flex-1">
        {sidebar ? <div className="relative z-[var(--zc-z-sidebar)] hidden h-full shrink-0 lg:block">{sidebar}</div> : null}
        <div className="relative flex min-w-0 flex-1 flex-col">
          {drawerSidebar ? (
            <header className="sticky top-0 z-[var(--zc-z-sidebar)] flex h-[var(--zc-topbar-h-mobile)] shrink-0 items-center gap-1 bg-topbar px-2 lg:hidden">
              <IconButton
                aria-label="Open menu"
                variant="on-dark"
                size="lg"
                showTooltip={false}
                onPress={() => onDrawerOpenChange?.(true)}
              >
                <IconMenu aria-hidden />
              </IconButton>
              <div className="min-w-0 flex-1 px-1 leading-none">
                <p className="truncate text-label-strong text-topbar-fg">{topBarTitle ?? mobileTitle}</p>
                {topBarSubtitle ? <p className="mt-0.5 truncate text-caption text-nav-fg-muted">{topBarSubtitle}</p> : null}
              </div>
              {onOpenSearch ? (
                <IconButton aria-label="Search" variant="on-dark" size="lg" showTooltip={false} onPress={onOpenSearch}>
                  <IconSearch aria-hidden />
                </IconButton>
              ) : null}
              {mobileActions}
            </header>
          ) : null}
          {/* The scrollbar's space is always kept, so a page that starts or stops scrolling doesn't shift sideways. */}
          <main
            id="main-content"
            tabIndex={-1}
            className={cx(
              "zc-main custom-scroll relative min-h-0 flex-1 overflow-y-auto outline-none [scrollbar-gutter:stable]",
              contentClassName,
            )}
            onScroll={
              floating
                ? (event) => {
                    const top = event.currentTarget.scrollTop;
                    // Hide while scrolling down, show again on scroll up or at the end of the page (02 §6).
                    const atEnd = top + event.currentTarget.clientHeight >= event.currentTarget.scrollHeight - 8;
                    if (atEnd) setFloatingHidden(false);
                    else if (Math.abs(top - lastScroll.current) > 8) setFloatingHidden(top > lastScroll.current && top > 80);
                    lastScroll.current = top;
                  }
                : undefined
            }
          >
            {banner}
            <div
              className={cx(
                "zc-page mx-auto w-full max-w-content-wide px-4 pt-4 md:px-6 md:pt-6 lg:px-8 lg:pt-7",
                floating ? "pb-28" : "pb-16",
              )}
            >
              {children}
            </div>
          </main>
          {floating ? (
            <div className="zc-askbar-slot pointer-events-none absolute inset-x-0 bottom-4 z-[var(--zc-z-ask)] flex justify-center px-4 md:bottom-6">
              <div className="w-full max-w-[560px]">{floating(floatingHidden)}</div>
            </div>
          ) : null}
        </div>
      </div>
      {drawerSidebar ? (
        <Drawer
          isOpen={isDrawerOpen}
          onOpenChange={onDrawerOpenChange}
          placement="left"
          hideCloseButton
          motionProps={{
            variants: {
              enter: { x: 0, transition: { duration: 0.32, ease: [0, 0, 0.2, 1] } },
              exit: { x: "-100%", transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } },
            },
          }}
          classNames={{
            base: "w-[var(--zc-sidebar-drawer-w)] max-w-[var(--zc-sidebar-drawer-w)] rounded-none bg-nav",
            backdrop: "zc-drawer-backdrop",
          }}
        >
          <DrawerContent>
            <DrawerBody className="h-full p-0 [&_.zc-sidebar]:w-full">{drawerSidebar}</DrawerBody>
          </DrawerContent>
        </Drawer>
      ) : null}
    </div>
  );
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["⌘", "K"], label: "Search and go to" },
  { keys: ["⌘", "\\"], label: "Collapse or expand the menu" },
  { keys: ["Esc"], label: "Close a dialog or menu" },
];

/** The keyboard shortcuts as a list, shown in the Settings › Keyboard shortcuts pane. Ctrl replaces ⌘ on Windows. */
export function ShortcutsList() {
  return (
    <div className="flex flex-col gap-3">
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
    </div>
  );
}
