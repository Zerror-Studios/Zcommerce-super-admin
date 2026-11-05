/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * App frame (v2 §3, §10): the black menu on the left (sticky, never scrolls) and `main`, the only thing that scrolls
 * (stable scrollbar gutter). No top bar from 768px up: each page starts with its own title row.
 * - Desktop (1280px and up): the menu as the layout passes it (240px, or the 72px rail when the user collapsed it;
 *   that choice belongs to the layout and is kept).
 * - Laptop and tablet (768–1279): always the 72px icon rail. Hovering it (mouse), tapping a rail link (touch), its
 *   expand button or ⌘\ opens the full menu (`drawerSidebar`) as an overlay over the content, never pushing it.
 * - Phone (under 768): a 56px row with the store switcher, search, the layout's extra icons (`mobileActions`, the
 *   bell) and the menu icon; the menu opens as a full-height drawer from the left.
 * Page padding: 32px (≥1024), 24px (768–1023), 16px (<768). "Skip to content" is the first focusable element.
 *
 * `sidebar` must be a <Sidebar> element (or a wrapper that passes its props through): in the rail band its
 * `collapsed` and `onToggleCollapse` are overridden, and the phone row reads its `store`.
 */
import { Drawer, DrawerBody, DrawerContent } from "@heroui/react";
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { cx } from "../ui/cx";
import { IconButton } from "../ui/IconButton";
import { IconMenu, IconSearch } from "../ui/icons";
import { Kbd } from "../ui/Primitives";
import { useViewportBand } from "../ui/use-media";
import { StoreSwitcher, type SidebarProps } from "./Sidebar";

export interface AppShellProps {
  /** The menu from 768px up (always the rail under 1280px). Omit to hide it (e.g. full-screen editors). */
  sidebar?: ReactNode;
  /** The full menu: the phone drawer and the laptop/tablet overlay. Pass `onClose` and `onNavigate` on it. */
  drawerSidebar?: ReactNode;
  /** Phone drawer or rail overlay open. */
  isDrawerOpen?: boolean;
  onDrawerOpenChange?: (open: boolean) => void;
  /** Phone row, first line, when the menu has no store switcher: "Zcom" (super admin). Falls back to mobileTitle. */
  topBarTitle?: ReactNode;
  /** Phone row, second line: "Zcom admin" / "Super admin". */
  topBarSubtitle?: ReactNode;
  /** LEGACY: the page title; used as the phone row's first line when topBarTitle is missing. */
  mobileTitle?: ReactNode;
  /** Phone row search button (opens the palette as a full-screen sheet). */
  onOpenSearch?: () => void;
  /** Phone row icons between search and the menu icon (the bell). */
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

/** How the rail overlay was opened: hover closes when the pointer leaves; tap (and keyboard) shows a scrim. */
type OverlayMode = "hover" | "tap";

const HOVER_OPEN_MS = 120;
const HOVER_CLOSE_MS = 240;
/** Portalled layers opened from the menu (account menu, notifications drawer) keep the overlay open. */
const LAYER_SELECTOR = '[role="menu"], [role="dialog"]:not(.zc-rail-overlay), [role="alertdialog"], [role="listbox"]';

const sidebarProps = (node: ReactNode): Partial<SidebarProps> | undefined =>
  isValidElement<Partial<SidebarProps>>(node) ? node.props : undefined;

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
  const sidebarRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const lastPointer = useRef("mouse");

  const band = useViewportBand();
  const isPhone = band === "phone";
  const isRail = band === "tablet" || band === "laptop";
  const hasOverlay = isRail && drawerSidebar != null;
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("tap");
  const overlayOpen = hasOverlay && isDrawerOpen;

  const setOpen = useCallback((open: boolean) => onDrawerOpenChange?.(open), [onDrawerOpenChange]);
  const openOverlay = useCallback(
    (mode: OverlayMode) => {
      window.clearTimeout(hoverTimer.current);
      setOverlayMode(mode);
      setOpen(true);
    },
    [setOpen],
  );

  // A band change (rotation, resize) closes the drawer or the overlay rather than swapping one for the other.
  const firstBand = useRef(true);
  useEffect(() => {
    if (firstBand.current) {
      firstBand.current = false;
      return;
    }
    setOpen(false);
    // Only the band matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [band]);

  // The Zcom AI sheet covers the content area, not the menu (v2 §3.3): publish where the content starts. The menu
  // isn't rendered on phone, so the offset is 0 there.
  useEffect(() => {
    const node = sidebarRef.current;
    const root = document.documentElement;
    if (!node || typeof ResizeObserver === "undefined") {
      root.style.removeProperty("--zc-shell-left");
      return undefined;
    }
    const update = () => root.style.setProperty("--zc-shell-left", `${node.offsetWidth}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--zc-shell-left");
    };
  }, [sidebar, isPhone]);

  // Rail band: ⌘\ opens or closes the overlay instead of changing the desktop collapse choice (the layout's own
  // hotkey listener never sees it).
  useEffect(() => {
    if (!hasOverlay) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key !== "\\") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (isDrawerOpen) setOpen(false);
      else openOverlay("tap");
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [hasOverlay, isDrawerOpen, openOverlay, setOpen]);

  // Open overlay: Esc and a press outside it (but not inside a layer it opened) close it; a tap or keyboard open
  // moves focus into it.
  useEffect(() => {
    if (!overlayOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector(LAYER_SELECTOR)) setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target || sidebarRef.current?.contains(target) || target.closest(LAYER_SELECTOR)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    const frame =
      overlayMode === "tap"
        ? window.requestAnimationFrame(() => overlayRef.current?.querySelector<HTMLElement>("a[href], button")?.focus())
        : undefined;
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
      if (frame != null) window.cancelAnimationFrame(frame);
    };
  }, [overlayOpen, overlayMode, setOpen]);

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const sidebarElement = isValidElement<Partial<SidebarProps>>(sidebar) ? sidebar : null;
  // Rail band: always the rail; its expand button opens the overlay (the saved collapse choice is for desktop).
  const menu =
    isRail && sidebarElement
      ? cloneElement(sidebarElement, {
          collapsed: true,
          onToggleCollapse: hasOverlay ? () => openOverlay("tap") : undefined,
        })
      : sidebar;
  const store = sidebarProps(drawerSidebar)?.store ?? sidebarProps(sidebar)?.store;

  const railHandlers = hasOverlay
    ? {
        onPointerDownCapture: (event: ReactPointerEvent) => {
          lastPointer.current = event.pointerType;
        },
        onPointerEnter: (event: ReactPointerEvent) => {
          if (event.pointerType !== "mouse" || isDrawerOpen) return;
          window.clearTimeout(hoverTimer.current);
          hoverTimer.current = window.setTimeout(() => openOverlay("hover"), HOVER_OPEN_MS);
        },
        onPointerLeave: (event: ReactPointerEvent) => {
          if (event.pointerType !== "mouse") return;
          window.clearTimeout(hoverTimer.current);
          if (!isDrawerOpen || overlayMode !== "hover") return;
          hoverTimer.current = window.setTimeout(() => {
            if (!document.querySelector(LAYER_SELECTOR)) setOpen(false);
          }, HOVER_CLOSE_MS);
        },
        // Touch: a tap on a rail link opens the full menu instead of navigating (v2 §10). Keyboard presses
        // (detail 0) and the mouse go straight through.
        onClickCapture: (event: ReactMouseEvent) => {
          if (isDrawerOpen || event.detail === 0 || lastPointer.current === "mouse") return;
          if (overlayRef.current?.contains(event.target as Node)) return;
          if (!(event.target as Element).closest("a")) return;
          event.preventDefault();
          event.stopPropagation();
          openOverlay("tap");
        },
      }
    : {};

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
        {sidebar && !isPhone ? (
          <div
            ref={sidebarRef}
            className={cx(
              "relative h-full shrink-0",
              overlayOpen ? "z-[var(--zc-z-popover)]" : "z-[var(--zc-z-sidebar)]",
            )}
            {...railHandlers}
          >
            {menu}
            {hasOverlay ? (
              <>
                {overlayOpen && overlayMode === "tap" ? (
                  <div aria-hidden className="zc-drawer-backdrop fixed inset-0" onClick={() => setOpen(false)} />
                ) : null}
                {/* Kept mounted while hidden, so a layer opened from it (the notifications drawer) stays open. */}
                <div
                  ref={overlayRef}
                  role="dialog"
                  aria-label="Menu"
                  aria-hidden={overlayOpen ? undefined : true}
                  inert={!overlayOpen}
                  className={cx(
                    "zc-rail-overlay absolute inset-y-0 left-0 shadow-modal [&_.zc-sidebar]:w-sidebar",
                    overlayOpen && "is-open",
                  )}
                >
                  {drawerSidebar}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
        <div className="relative flex min-w-0 flex-1 flex-col">
          {isPhone && drawerSidebar ? (
            <header className="sticky top-0 z-[var(--zc-z-sidebar)] flex h-[var(--zc-topbar-h-mobile)] shrink-0 items-center gap-1 bg-topbar pl-2 pr-1">
              <div className="flex min-w-0 flex-1 items-center">
                {store ? (
                  <StoreSwitcher store={store} className="min-h-11" />
                ) : (
                  <div className="min-w-0 flex-1 px-1 leading-none">
                    <p className="truncate text-label-strong text-topbar-fg">{topBarTitle ?? mobileTitle}</p>
                    {topBarSubtitle ? <p className="mt-0.5 truncate text-caption text-nav-fg-muted">{topBarSubtitle}</p> : null}
                  </div>
                )}
              </div>
              {onOpenSearch ? (
                <IconButton aria-label="Search" variant="on-dark" size="lg" showTooltip={false} onPress={onOpenSearch}>
                  <IconSearch aria-hidden />
                </IconButton>
              ) : null}
              {mobileActions}
              <IconButton
                aria-label="Open menu"
                aria-expanded={isDrawerOpen}
                variant="on-dark"
                size="lg"
                showTooltip={false}
                onPress={() => setOpen(true)}
              >
                <IconMenu aria-hidden />
              </IconButton>
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
                // v2 §3.3: 120px under the content so the Zcom AI bar never hides the last row or the pagination.
                floating ? "pb-ask-clearance" : "pb-16",
              )}
            >
              {children}
            </div>
          </main>
          {floating ? (
            <div className="zc-askbar-slot pointer-events-none absolute inset-x-0 bottom-4 z-[var(--zc-z-ask)] flex justify-center px-4 md:bottom-[var(--zc-ask-bottom)]">
              <div className="w-full max-w-[var(--zc-ask-w)]">{floating(floatingHidden)}</div>
            </div>
          ) : null}
        </div>
      </div>
      {drawerSidebar && isPhone ? (
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
            base: "h-dvh max-h-dvh w-[var(--zc-sidebar-drawer-w)] max-w-[var(--zc-sidebar-drawer-w)] rounded-none bg-nav",
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
