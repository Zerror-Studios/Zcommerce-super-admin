/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import {
  Children,
  Fragment,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { Button, ButtonLink } from "../ui/Button";
import { ButtonShortLabelContext } from "../ui/short-label";
import { IconTile, sectionClass, type SectionColor } from "../ui/IconTile";
import { cx } from "../ui/cx";
import { IconButton } from "../ui/IconButton";
import { IconMore, IconPrevPage } from "../ui/icons";
import { RowMenu, type RowMenuItem } from "../ui/RowMenu";
import { useViewportBand } from "../ui/use-media";
import type { Crumb } from "./types";
import { PageIconContext } from "./page-icon";

/**
 * Page headers (01 §6.4, §7.27). Plain, straight on the page, no card:
 * - "list" / "page": top-level pages (v2 §4.1). A 44px ink tile with a white glyph (hidden on phone), the title
 *   (22/600, 20 on phone) with its count (14px muted) 8px after it, one line of plain-language status (14px muted),
 *   and on the right at most one secondary and one primary button, then the ⋯ menu (`more`) that holds Export,
 *   Import, Print and Choose columns. No Export or Import buttons anywhere else.
 * - "detail": records with a parent (order, product, customer, store). Round 2 G12: the text breadcrumb
 *   "‹ Orders" above the title (13px muted, ink on hover; no round back button), an optional leading visual, the
 *   title with its badges, one meta line (13px muted); sticky on the page background. The breadcrumb never points
 *   to the page itself, and menu-level pages have none.
 * 20px between the header and the content.
 *
 * Responsive (v2 §10). The primary action is `primaryAction`, or else found in `actions`: a kit <Button> with the
 * primary variant (its default), any element with `variant="primary"` or `data-primary`, or a wrapper (tooltip,
 * permission gate, dropdown) around one. Then:
 * - 1024px and up: everything inline, as designed.
 * - Tablet (768–1023): the secondary buttons move into ⋯ with the `more` items; other controls (a date range, the
 *   wallet capsule) stay inline.
 * - Phone: title and count on one line (truncated), the status line under it; only the primary stays (with
 *   `primaryShortLabel` when given), everything else goes into ⋯.
 * `primaryShortLabel` reaches the primary Button however it is wrapped (a dropdown trigger, "New campaign ▾", a
 * refund button component) through ButtonShortLabelContext. An element marked `data-slot` (a portal target that
 * other code fills, such as a settings section's Save) always stays inline.
 * Moved actions are the page's own elements, kept mounted inside the ⋯ panel (so their dialogs keep working).
 * The same right-hand group is `TitleActions`, used by the settings section title row (PaneHeader).
 * `collapseActions={false}` keeps the old behaviour (everything inline, wrapping under the title on phone).
 */
export type PageHeaderType = "list" | "page" | "detail";

export interface PageHeaderProps {
  type?: PageHeaderType;
  title?: ReactNode;
  /** Muted count after the title ("Products 248"). Hidden when 0. Never in brackets. */
  count?: ReactNode;
  /** One line under the title: the live summary on A ("12 to ship today · 2 awaiting payment"), meta on C. */
  description?: ReactNode;
  /** 40px tile on list and page headers: a stroke icon from ui/icons. */
  icon?: ReactNode;
  /** Drop the icon tile (boards 03, 43: Analytics overview, Help), even when the section supplies one. */
  hideTile?: boolean;
  /** A small mono label above the title, shown in capitals ("Analytics · 6 Oct – 4 Nov", boards 03 and 43). */
  eyebrow?: ReactNode;
  /** Section colour of the tile and the A tint. */
  section?: SectionColor;
  /**
   * Route trail. Top-level pages show no breadcrumbs; on a detail/edit page (deeper than Home › Section › Page)
   * the nearest linked parent becomes the back link ("← Products").
   */
  breadcrumbs?: Crumb[];
  /** Explicit back link for detail pages; wins over breadcrumbs. */
  back?: { href: string; label: ReactNode };
  /** Detail pages: a 40px thumbnail, logo tile or avatar between the back button and the title. */
  leading?: ReactNode;
  /** Status badge(s) next to the title on detail pages. */
  badges?: ReactNode;
  /**
   * Right side: at most one secondary and ONE primary button (v2 §4.1). Under 1024px the secondary buttons move into
   * ⋯ (see the responsive notes above).
   */
  actions?: ReactNode;
  /** The one primary action, rendered last. When set, `actions` holds only the rest. */
  primaryAction?: ReactNode;
  /** Phone label for the primary kit Button ("Add" for "Add product"); its icon stays. */
  primaryShortLabel?: string;
  /** Move secondary actions into ⋯ under 1024px (default true). */
  collapseActions?: boolean;
  /** The ⋯ menu after the actions: Export, Import, Print, Choose columns… (v2 §4.1). */
  more?: RowMenuItem[];
  /** Names the ⋯ button ("More order actions"). */
  moreLabel?: string;
  /** Extra row under the header (e.g. a date-range control). */
  children?: ReactNode;
  /** Stick to the top of the scrolling content area. Detail headers with actions stick by default. */
  sticky?: boolean;
  /** LEGACY: ignored. Every page title is 22/600 (docs/design/01-foundations.md §5). */
  titleClassName?: string;
  className?: string;
}

function backFromCrumbs(breadcrumbs?: Crumb[]): PageHeaderProps["back"] {
  if (!breadcrumbs || breadcrumbs.length < 4) return undefined;
  const parent = [...breadcrumbs.slice(0, -1)].reverse().find((crumb) => crumb.href);
  return parent?.href ? { href: parent.href, label: parent.label } : undefined;
}

function isZero(count: ReactNode): boolean {
  return count === 0 || count === "0";
}

// ─── Actions: primary, buttons, the rest ──────────────────────────────────────

type ElementProps = { variant?: string; "data-primary"?: unknown; "data-slot"?: unknown; children?: ReactNode };

/** The action nodes with fragments opened up (empty ones dropped). */
function flattenActions(node: ReactNode): ReactNode[] {
  const out: ReactNode[] = [];
  Children.forEach(node, (child) => {
    if (child == null || typeof child === "boolean" || child === "") return;
    if (isValidElement<ElementProps>(child) && child.type === Fragment) out.push(...flattenActions(child.props.children));
    else out.push(child);
  });
  return out;
}

/** Wrappers (tooltip, permission gate, dropdown and its trigger) are looked through, three levels deep. */
function matchesDeep(node: ReactNode, test: (element: ReactElement<ElementProps>) => boolean, depth = 0): boolean {
  if (!isValidElement<ElementProps>(node)) return false;
  if (test(node)) return true;
  return depth < 3 && flattenActions(node.props.children).some((child) => matchesDeep(child, test, depth + 1));
}

const isPrimaryNode = (node: ReactNode) =>
  matchesDeep(node, (element) => {
    const { variant } = element.props;
    const marked = element.props["data-primary"];
    if (marked != null && marked !== false) return true;
    if (element.type === Button) return (variant ?? "primary") === "primary";
    return variant === "primary";
  });

const isButtonNode = (node: ReactNode) =>
  matchesDeep(node, (element) => element.type === Button || element.type === ButtonLink);

/** A portal target filled from elsewhere (`data-slot`): its contents can't be sorted, so it stays inline. */
const isSlotNode = (node: ReactNode) => {
  if (!isValidElement<ElementProps>(node)) return false;
  const marked = node.props["data-slot"];
  return marked != null && marked !== false;
};

/** Portalled layers opened from the ⋯ panel (a dropdown, a date picker, a dialog) keep it open. */
const LAYER_SELECTOR = '[role="menu"], [role="listbox"], [role="dialog"]:not(.zc-rail-overlay), [role="alertdialog"]';

/**
 * The title row's ⋯ when actions moved into it: the page's own action elements (kept mounted while closed), then
 * the `more` items. A press on a plain button or link inside closes it; one that opens a menu doesn't.
 */
function ActionsOverflow({ nodes, more, label }: { nodes: ReactNode[]; more: RowMenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target || rootRef.current?.contains(target) || target.closest(LAYER_SELECTOR)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector(LAYER_SELECTOR)) return;
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    const frame = window.requestAnimationFrame(() =>
      rootRef.current?.querySelector<HTMLElement>(`[id="${panelId}"] :is(button, a[href]):not(:disabled)`)?.focus({ preventScroll: true }),
    );
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.cancelAnimationFrame(frame);
    };
  }, [open, panelId]);

  const onNodesClick = (event: MouseEvent) => {
    const pressed = (event.target as Element).closest("button, a");
    if (!pressed || pressed.hasAttribute("aria-haspopup") || pressed.getAttribute("aria-expanded") != null) return;
    // After the page's own handler ran.
    window.setTimeout(() => setOpen(false), 0);
  };

  const regular = more.filter((item) => !item.destructive);
  const destructive = more.filter((item) => item.destructive);
  const renderItem = (item: RowMenuItem) => {
    const Icon = item.icon;
    const body = (
      <>
        {Icon ? <Icon aria-hidden /> : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate">{item.label}</span>
          {item.description ? <span className="block truncate text-caption text-fg-muted">{item.description}</span> : null}
        </span>
      </>
    );
    return item.href && !item.disabled ? (
      <Link key={item.key} to={item.href} className="zc-overflow__item" data-danger={item.destructive || undefined} onClick={() => setOpen(false)}>
        {body}
      </Link>
    ) : (
      <button
        key={item.key}
        type="button"
        className="zc-overflow__item"
        data-danger={item.destructive || undefined}
        disabled={item.disabled}
        onClick={() => {
          setOpen(false);
          item.onSelect?.();
        }}
      >
        {body}
      </button>
    );
  };

  return (
    <div ref={rootRef} className="zc-overflow">
      <IconButton
        ref={triggerRef}
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        variant="default"
        showTooltip={false}
        onPress={() => setOpen((value) => !value)}
      >
        <IconMore aria-hidden />
      </IconButton>
      <div id={panelId} role="group" aria-label={label} hidden={!open} className="zc-overflow__panel">
        {nodes.length ? (
          <div className="zc-overflow__nodes" onClickCapture={onNodesClick}>
            {nodes.map((node, index) => (
              <Fragment key={index}>{node}</Fragment>
            ))}
          </div>
        ) : null}
        {nodes.length && more.length ? <div aria-hidden className="zc-overflow__divider" /> : null}
        {regular.map(renderItem)}
        {regular.length && destructive.length ? <div aria-hidden className="zc-overflow__divider" /> : null}
        {destructive.map(renderItem)}
      </div>
    </div>
  );
}

// ─── The right-hand group ────────────────────────────────────────────────────

export interface TitleActionsProps {
  /** At most one secondary and ONE primary button (v2 §4.1); the primary is found as described above. */
  actions?: ReactNode;
  /** The one primary action, rendered last. When set, `actions` holds only the rest. */
  primaryAction?: ReactNode;
  /** Phone label for the primary ("Add" for "Add product"); its icon stays. */
  primaryShortLabel?: string;
  /** Move secondary actions into ⋯ under 1024px (default true). */
  collapse?: boolean;
  /** The ⋯ menu after the actions: Export, Import, Print, Choose columns… */
  more?: RowMenuItem[];
  /** Names the ⋯ button ("More order actions"). */
  moreLabel?: string;
  className?: string;
}

/**
 * A title row's actions (v2 §4.1, §10): from 1024px everything inline; on tablet the secondary buttons move into ⋯;
 * on phone only the primary (with its short label) and `data-slot` elements stay, the rest goes into ⋯.
 */
export function TitleActions({
  actions,
  primaryAction,
  primaryShortLabel,
  collapse = true,
  more,
  moreLabel = "More actions",
  className,
}: TitleActionsProps) {
  const band = useViewportBand();
  const nodes = flattenActions(actions);
  const sortable = nodes.map((node) => !isSlotNode(node));
  const primaryIndex =
    primaryAction != null ? -1 : nodes.map((node, index) => sortable[index] && isPrimaryNode(node)).lastIndexOf(true);
  const primary = primaryAction ?? (primaryIndex >= 0 ? nodes[primaryIndex] : null);
  const rest = nodes.filter((_, index) => index !== primaryIndex);
  const isPhone = band === "phone";
  const compact = collapse && (isPhone || band === "tablet");
  const moved = compact ? rest.filter((node) => !isSlotNode(node) && (isPhone || isButtonNode(node))) : [];
  const inline = compact ? rest.filter((node) => !moved.includes(node)) : rest;
  const menuItems = more ?? [];
  if (primary == null && !rest.length && !menuItems.length) return null;
  return (
    <div className={cx("flex items-center gap-2", compact ? "shrink-0" : "flex-wrap", className)}>
      {inline.map((node, index) => (
        <Fragment key={index}>{node}</Fragment>
      ))}
      {primary != null ? (
        <ButtonShortLabelContext.Provider value={isPhone ? primaryShortLabel : undefined}>{primary}</ButtonShortLabelContext.Provider>
      ) : null}
      {moved.length ? (
        <ActionsOverflow nodes={moved} more={menuItems} label={moreLabel} />
      ) : menuItems.length ? (
        <RowMenu items={menuItems} label={moreLabel} size="md" />
      ) : null}
    </div>
  );
}

// ─── Parts ───────────────────────────────────────────────────────────────────

/** The title (title-1), its muted count 8px after it, and badges. Focus lands here after navigation (02 §8). */
function Title({ title, count, badges }: Pick<PageHeaderProps, "title" | "count" | "badges">) {
  if (title == null) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {/* Phone: title and count on one line (v2 §10). */}
      <h1 tabIndex={-1} className="min-w-0 text-title-1 text-fg outline-none max-md:max-w-full max-md:truncate">
        {title}
        {count != null && !isZero(count) ? (
          <span className="ml-2 text-body font-normal tracking-normal text-fg-muted num">{count}</span>
        ) : null}
      </h1>
      {badges}
    </div>
  );
}

/** The detail page's breadcrumb (round 2 G12): "‹ Orders" above the title, 13px muted, ink on hover. */
function Breadcrumb({ href, label }: { href: string; label: ReactNode }) {
  return (
    <Link
      to={href}
      aria-label={typeof label === "string" ? `Back to ${label}` : undefined}
      className="zc-crumb mb-1.5 inline-flex max-w-full items-center gap-0.5 rounded-sm text-label text-fg-muted transition-colors duration-1 hover:text-fg focus-visible:shadow-focus-strong focus-visible:outline-none"
    >
      <IconPrevPage aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

/**
 * Page header: one of A/B/C above. 16px between the header and the content; under 1024px the secondary actions
 * fold into ⋯ (v2 §10).
 */
export function PageHeader({
  type,
  title,
  count,
  description,
  icon,
  hideTile = false,
  eyebrow,
  section,
  breadcrumbs,
  back,
  leading,
  badges,
  actions,
  primaryAction,
  primaryShortLabel,
  collapseActions = true,
  more,
  moreLabel = "More actions",
  children,
  sticky,
  className,
}: PageHeaderProps) {
  const backLink = back ?? backFromCrumbs(breadcrumbs);
  const kind: PageHeaderType | undefined = type ?? (backLink ? "detail" : icon ? "page" : undefined);
  const hasActions = actions != null || primaryAction != null;
  // Round 2 §8.2: on a phone only the 56px top bar stays; the title row scrolls with the page.
  const isPhone = useViewportBand() === "phone";
  const isSticky = !isPhone && (sticky ?? (kind === "detail" && hasActions));
  // List and page headers carry the section's icon tile (PageIconContext supplies it when the page passes none);
  // detail headers have the breadcrumb instead (01 §6.4: one icon only).
  const sectionIcon = useContext(PageIconContext);
  const tileIcon = icon ?? sectionIcon;
  const showTile = tileIcon != null && kind !== "detail" && !hideTile;
  const ref = useRef<HTMLDivElement>(null);

  // A sticky header publishes its height as --zc-sticky-header-h, so other sticky parts (the two-pane list)
  // stop below it instead of sliding under it (owner 2026-10-29: store detail's list lost its top rows).
  useLayoutEffect(() => {
    const node = ref.current;
    if (!isSticky || !node) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty("--zc-sticky-header-h", `${node.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--zc-sticky-header-h");
    };
  }, [isSticky]);

  const menuItems = more ?? [];

  const isDetail = kind === "detail";
  const body = (
    <div
      className={cx(
        "flex gap-3",
        collapseActions
          ? "flex-row items-start justify-between md:items-center"
          : "flex-col sm:flex-row sm:items-center sm:justify-between",
      )}
    >
      <div className={cx("flex min-w-0 items-center", collapseActions && "flex-1", isDetail ? "gap-3" : "gap-3.5")}>
        {showTile ? <IconTile className="max-md:hidden">{tileIcon}</IconTile> : null}
        {isDetail && leading ? <span className="shrink-0">{leading}</span> : null}
        <div className="min-w-0">
          {eyebrow != null ? <div className="zc-page-eyebrow">{eyebrow}</div> : null}
          <Title title={title} count={count} badges={badges} />
          {description != null ? (
            <div className={cx("mt-0.5 text-fg-muted", isDetail ? "text-label" : "text-body")}>{description}</div>
          ) : null}
        </div>
      </div>
      {hasActions || menuItems.length ? (
        <TitleActions
          actions={actions}
          primaryAction={primaryAction}
          primaryShortLabel={primaryShortLabel}
          collapse={collapseActions}
          more={menuItems}
          moreLabel={moreLabel}
        />
      ) : null}
    </div>
  );

  return (
    <div
      ref={ref}
      className={cx(
        "mb-4",
        sectionClass(section),
        isSticky && "sticky top-0 z-30 -mx-4 bg-page px-4 py-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8",
        className,
      )}
    >
      {isDetail && backLink ? <Breadcrumb href={backLink.href} label={backLink.label} /> : null}
      {body}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
