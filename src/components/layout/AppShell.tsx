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
 * Scroll (round 2 G9): `main` goes back to the top when a link or redirect changes the path (not on hash- or
 * query-only changes), and Back/Forward restore the position saved for that history entry.
 * Motion: framer-motion follows the user's reduced-motion setting inside the shell (MotionConfig).
 *
 * `sidebar` must be a <Sidebar> element (or a wrapper that passes its props through): in the rail band its
 * `collapsed` and `onToggleCollapse` are overridden, and the phone row reads its `store`.
 */
import { Drawer, DrawerBody, DrawerContent } from "@heroui/react";
import { MotionConfig } from "framer-motion";
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { cx } from "../ui/cx";
import { IconButton } from "../ui/IconButton";
import { IconMenu, IconSearch } from "../ui/icons";
import { usePresetMotion } from "../ui/motion";
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
   * Floating element fixed at the bottom centre of the viewport (the Zcom AI bar, round 2 G3). Receives `hidden`,
   * true while the user scrolls down (the slot slides it away). Pages get 112px bottom padding so it never covers
   * save bars, the last row or the pagination. Return null to hide it on a page (Inbox, editors, own composer).
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

/** Back/Forward: keep trying to restore the saved position for this many frames while the page loads its content. */
const RESTORE_MAX_FRAMES = 60;
/** A fresh load holds the top at most this long (until the user scrolls, taps, clicks or types first). */
const FIRST_LOAD_HOLD_MS = 8000;

const sidebarProps = (node: ReactNode): Partial<SidebarProps> | undefined =>
  isValidElement<Partial<SidebarProps>>(node) ? node.props : undefined;

/**
 * Round 2 G9: the app scrolls inside `main`, so the router's own restoration never touches it. A PUSH or REPLACE
 * that changes the pathname scrolls to the top; a POP (Back/Forward) restores the position saved for that history
 * entry (`location.key`), retrying for a few frames while lazy pages and data fill in. Hash- and query-only
 * changes leave the scroll alone. Returns the scroll handler that records the current entry's position.
 */
function useMainScrollRestoration(mainRef: { current: HTMLElement | null }) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef(new Map<string, number>());
  const currentKey = useRef(location.key);
  const lastPath = useRef(location.pathname);

  // A fresh load or reload always opens at the top: turn off the browser's own restoration (it would put the
  // page back mid-scroll), then hold the top while the lazy page, its cards and their data fill in, until the
  // user scrolls, taps, clicks or types (or FIRST_LOAD_HOLD_MS passes).
  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    const main = mainRef.current;
    const startedAt = performance.now();
    let handle = 0;
    const toTop = () => {
      if (window.scrollY !== 0) window.scrollTo(0, 0);
      if (main && main.scrollTop !== 0) main.scrollTop = 0;
      if (performance.now() - startedAt < FIRST_LOAD_HOLD_MS) handle = window.requestAnimationFrame(toTop);
    };
    toTop();
    const stop = () => window.cancelAnimationFrame(handle);
    const events = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    events.forEach((type) => window.addEventListener(type, stop, { passive: true, once: true, capture: true }));
    return () => {
      stop();
      events.forEach((type) => window.removeEventListener(type, stop, { capture: true }));
    };
    // Once per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const main = mainRef.current;
    const pathChanged = location.pathname !== lastPath.current;
    currentKey.current = location.key;
    lastPath.current = location.pathname;
    if (!main) return undefined;
    if (navigationType !== "POP") {
      if (pathChanged) main.scrollTop = 0;
      return undefined;
    }
    const saved = positions.current.get(location.key);
    if (saved == null) {
      if (pathChanged) main.scrollTop = 0;
      return undefined;
    }
    let frame = 0;
    let handle = 0;
    const restore = () => {
      main.scrollTop = saved;
      frame += 1;
      if (Math.abs(main.scrollTop - saved) > 1 && frame < RESTORE_MAX_FRAMES) handle = window.requestAnimationFrame(restore);
    };
    restore();
    // A wheel, touch or key press means the user took over: stop restoring.
    const stop = () => window.cancelAnimationFrame(handle);
    main.addEventListener("wheel", stop, { passive: true, once: true });
    main.addEventListener("touchstart", stop, { passive: true, once: true });
    main.addEventListener("keydown", stop, { once: true });
    return () => {
      stop();
      main.removeEventListener("wheel", stop);
      main.removeEventListener("touchstart", stop);
      main.removeEventListener("keydown", stop);
    };
    // Runs once per history entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  return useCallback((top: number) => {
    positions.current.set(currentKey.current, top);
  }, []);
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
  // Round 2 §8.2: the phone top bar turns white 92% with a 1px line once the page scrolls under it.
  const [scrolled, setScrolled] = useState(false);
  const lastScroll = useRef(0);
  const mainRef = useRef<HTMLElement>(null);
  const recordScroll = useMainScrollRestoration(mainRef);
  const menuDrawerMotion = usePresetMotion("drawer-left");
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

  const shell = (
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
            <header
              className={cx(
                "zc-topbar sticky top-0 z-[var(--zc-z-sidebar)] flex shrink-0 items-center gap-1 pl-2 pr-1",
                scrolled && "is-scrolled",
              )}
            >
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
            ref={mainRef}
            id="main-content"
            tabIndex={-1}
            className={cx(
              "zc-main custom-scroll relative min-h-0 flex-1 overflow-y-auto outline-none [scrollbar-gutter:stable]",
              contentClassName,
            )}
            onScroll={(event) => {
              const top = event.currentTarget.scrollTop;
              recordScroll(top);
              if (isPhone) setScrolled(top > 4);
              if (!floating) return;
              // Hide while scrolling down, show again on scroll up or at the end of the page (02 §6).
              const atEnd = top + event.currentTarget.clientHeight >= event.currentTarget.scrollHeight - 8;
              if (atEnd) setFloatingHidden(false);
              else if (Math.abs(top - lastScroll.current) > 8) setFloatingHidden(top > lastScroll.current && top > 80);
              lastScroll.current = top;
            }}
          >
            {banner}
            <div
              className={cx(
                "zc-page mx-auto w-full max-w-content-wide px-4 pt-4 md:px-6 md:pt-6 lg:px-8 lg:pt-7",
                // Round 2 G3: 112px under the content so the Zcom AI bar never hides the last row or the pagination.
                floating ? "pb-ask-clearance" : "pb-16",
              )}
            >
              {children}
            </div>
          </main>
          {floating ? (
            // Round 2 G3: fixed and centred on the whole viewport (`.zc-askbar-slot`), not on the content column.
            <div className={cx("zc-askbar-slot", floatingHidden && "is-hidden")}>{floating(floatingHidden)}</div>
          ) : null}
        </div>
      </div>
      {drawerSidebar && isPhone ? (
        <Drawer
          isOpen={isDrawerOpen}
          onOpenChange={onDrawerOpenChange}
          placement="left"
          hideCloseButton
          motionProps={menuDrawerMotion}
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

  return <MotionConfig reducedMotion="user">{shell}</MotionConfig>;
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
