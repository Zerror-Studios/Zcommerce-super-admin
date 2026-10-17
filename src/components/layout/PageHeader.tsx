/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ReactNode } from "react";
import { BackLink } from "../ui/Primitives";
import { cx } from "../ui/cx";
import type { Crumb } from "./types";

export interface PageHeaderProps {
  title?: ReactNode;
  /** Muted count after the title ("Products 248"). Hidden when 0. Never in brackets. */
  count?: ReactNode;
  /** Optional one-line description: only when it tells the user something. */
  description?: ReactNode;
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
  /** Stick to the top of the scrolling content area (edit pages with Save actions). */
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

/**
 * Page header (docs/design/02-components.md §2): optional back link → H1 22/600 + muted count (+ badges),
 * optional description; actions on the right; 20px above the content.
 */
export function PageHeader({
  title,
  count,
  description,
  breadcrumbs,
  back,
  badges,
  actions,
  children,
  sticky = false,
  className,
}: PageHeaderProps) {
  const backLink = back ?? backFromCrumbs(breadcrumbs);
  return (
    <div
      className={cx(
        "mb-5",
        sticky && "sticky top-0 z-30 -mx-4 bg-page px-4 py-4 sm:-mx-8 sm:px-8",
        className,
      )}
    >
      {backLink ? (
        <BackLink to={backLink.href} className="mb-2">
          {backLink.label}
        </BackLink>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {title != null ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="text-title font-semibold text-fg">
                {title}
                {count != null && !isZero(count) ? (
                  <span className="ml-2 text-body font-normal text-fg-muted num">{count}</span>
                ) : null}
              </h1>
              {badges}
            </div>
          ) : null}
          {description != null ? <div className="mt-0.5 text-body text-fg-muted">{description}</div> : null}
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
