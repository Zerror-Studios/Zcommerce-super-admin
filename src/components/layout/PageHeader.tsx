/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { useContext, useLayoutEffect, useRef, type ReactNode } from "react";
import { BackLink } from "../ui/Primitives";
import { IconTile, sectionClass, type SectionColor } from "../ui/IconTile";
import { cx } from "../ui/cx";
import type { Crumb } from "./types";
import { PageIconContext } from "./page-icon";

/**
 * The three headers (docs/design/09-settings-and-scale.md §2). Every page uses exactly one:
 * - "list"   A · top-level list pages: icon tile in the section colour, H1 + count, live line, actions.
 * - "page"   B · dashboards and utilities (Home, Analytics, Settings, Help): icon tile, H1, muted line, one control.
 *   Both sit straight on the page, no card (owner 2026-10-27; the tinted card was dropped).
 * - "detail" C · anything with a parent: "← Parent", H1 + badges, one-line meta, actions; sticky with a hairline.
 * Without a type, a header with a back link is "detail", one with an icon is "page", and the rest render the
 * v1.0 plain header until their page is moved over.
 */
export type PageHeaderType = "list" | "page" | "detail";

export interface PageHeaderProps {
  type?: PageHeaderType;
  title?: ReactNode;
  /** Muted count after the title ("Products 248"). Hidden when 0. Never in brackets. */
  count?: ReactNode;
  /** One line under the title: the live summary on A ("12 to ship today · 2 awaiting payment"), meta on C. */
  description?: ReactNode;
  /** 44px tile on A and B: a stroke icon from ui/icons. */
  icon?: ReactNode;
  /** Section colour of the tile and the A tint. */
  section?: SectionColor;
  /**
   * Route trail. Top-level pages show no breadcrumbs; on a detail/edit page (deeper than Home › Section › Page)
   * the nearest linked parent becomes the back link ("← Products").
   */
  breadcrumbs?: Crumb[];
  /** Explicit back link for detail pages; wins over breadcrumbs. */
  back?: { href: string; label: ReactNode };
  /** Status badge(s) next to the title on detail pages. */
  badges?: ReactNode;
  /** Right side: ghost secondary actions, then ONE primary button. Wraps below the title on small screens. */
  actions?: ReactNode;
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

/** H1 22/30/600 −0.01em, muted count, badges. */
function Title({ title, count, badges }: Pick<PageHeaderProps, "title" | "count" | "badges">) {
  if (title == null) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <h1 className="text-title font-semibold text-fg">
        {title}
        {count != null && !isZero(count) ? (
          <span className="ml-2 text-body font-normal text-fg-muted num">{count}</span>
        ) : null}
      </h1>
      {badges}
    </div>
  );
}

/**
 * Page header: one of A/B/C above. 16px between the header and the content; actions wrap under the title on
 * small screens.
 */
export function PageHeader({
  type,
  title,
  count,
  description,
  icon,
  section,
  breadcrumbs,
  back,
  badges,
  actions,
  children,
  sticky,
  className,
}: PageHeaderProps) {
  const backLink = back ?? backFromCrumbs(breadcrumbs);
  const kind: PageHeaderType | undefined = type ?? (backLink ? "detail" : icon ? "page" : undefined);
  const isSticky = sticky ?? (kind === "detail" && actions != null);
  // Every header has its icon box, detail pages too; without its own icon it takes the section's
  // (PageIconContext, owner 2026-10-29).
  const sectionIcon = useContext(PageIconContext);
  const tileIcon = icon ?? sectionIcon;
  const showTile = tileIcon != null;
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

  const body = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3.5">
        {showTile ? <IconTile section={section}>{tileIcon}</IconTile> : null}
        <div className="min-w-0">
          <Title title={title} count={count} badges={badges} />
          {description != null ? <div className="mt-0.5 text-body text-fg-muted">{description}</div> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );

  return (
    <div
      ref={ref}
      className={cx(
        "mb-4",
        sectionClass(section),
        isSticky &&
          "sticky top-0 z-30 -mx-4 bg-page px-4 py-4 sm:-mx-8 sm:px-8",
        isSticky && kind === "detail" && "border-b border-line",
        className,
      )}
    >
      {backLink && kind === "detail" ? (
        <BackLink to={backLink.href} className="mb-2">
          {backLink.label}
        </BackLink>
      ) : null}
      {body}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
