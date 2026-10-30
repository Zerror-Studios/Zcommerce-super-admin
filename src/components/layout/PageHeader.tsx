/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { useContext, useLayoutEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconTile, sectionClass, type SectionColor } from "../ui/IconTile";
import { cx } from "../ui/cx";
import { IconPrevPage } from "../ui/icons";
import { Tooltip } from "../ui/Tooltip";
import type { Crumb } from "./types";
import { PageIconContext } from "./page-icon";

/**
 * Page headers (01 §6.4, §7.27). Plain, straight on the page, no card:
 * - "list" / "page": top-level pages. A 40px tile in the section's solid colour with a white glyph (hidden on
 *   phone), the title (24/600, 20 on phone) with its count (14px muted) 8px after it, one line of description
 *   (14px muted), and the actions on the right (secondary first, then the one primary; a ⋯ circle may follow).
 * - "detail": records with a parent (order, product, customer, store). A 32px circle back button ("Back to
 *   Orders"), an optional leading visual, the title with its badges, one meta line (13px muted); sticky on the
 *   page background. The back button never points to the page itself.
 * 20px between the header and the content.
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

/** The title (title-1), its muted count 8px after it, and badges. Focus lands here after navigation (02 §8). */
function Title({ title, count, badges }: Pick<PageHeaderProps, "title" | "count" | "badges">) {
  if (title == null) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <h1 tabIndex={-1} className="text-title-1 text-fg outline-none">
        {title}
        {count != null && !isZero(count) ? (
          <span className="ml-2 text-body font-normal tracking-normal text-fg-muted num">{count}</span>
        ) : null}
      </h1>
      {badges}
    </div>
  );
}

/** The detail page's circle back button (01 §7.27): 32px, chevron-left, "Back to <parent>". */
function BackButton({ href, label }: { href: string; label: ReactNode }) {
  const name = `Back to ${typeof label === "string" ? label : "the list"}`;
  return (
    <Tooltip content={name}>
      <Link to={href} aria-label={name} className="zc-icon-btn zc-icon-btn--sm shrink-0">
        <IconPrevPage aria-hidden />
      </Link>
    </Tooltip>
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
  leading,
  badges,
  actions,
  children,
  sticky,
  className,
}: PageHeaderProps) {
  const backLink = back ?? backFromCrumbs(breadcrumbs);
  const kind: PageHeaderType | undefined = type ?? (backLink ? "detail" : icon ? "page" : undefined);
  const isSticky = sticky ?? (kind === "detail" && actions != null);
  // List and page headers carry the section's icon tile (PageIconContext supplies it when the page passes none);
  // detail headers have the back button instead (01 §6.4: one icon only).
  const sectionIcon = useContext(PageIconContext);
  const tileIcon = icon ?? sectionIcon;
  const showTile = tileIcon != null && kind !== "detail";
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

  const isDetail = kind === "detail";
  const body = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className={cx("flex min-w-0 items-center", isDetail ? "gap-3" : "gap-3.5")}>
        {isDetail && backLink ? <BackButton href={backLink.href} label={backLink.label} /> : null}
        {showTile ? <IconTile section={section} className="max-md:hidden">{tileIcon}</IconTile> : null}
        {isDetail && leading ? <span className="shrink-0">{leading}</span> : null}
        <div className="min-w-0">
          <Title title={title} count={count} badges={badges} />
          {description != null ? (
            <div className={cx("mt-0.5 text-fg-muted", isDetail ? "text-label" : "text-body")}>{description}</div>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );

  return (
    <div
      ref={ref}
      className={cx(
        "mb-5",
        sectionClass(section),
        isSticky && "sticky top-0 z-30 -mx-4 bg-page px-4 py-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8",
        className,
      )}
    >
      {body}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
