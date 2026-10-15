/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ReactNode } from "react";
import { Fragment } from "react";
import { Link } from "react-router-dom";
import { cx } from "../ui/cx";
import type { Crumb } from "./types";

export interface PageHeaderProps {
  title?: ReactNode;
  /** Shown after the title as "(12)" in muted text. */
  count?: ReactNode;
  description?: ReactNode;
  breadcrumbs?: Crumb[];
  /** Right-aligned actions (primary Button md). Wrap below the text on small screens. */
  actions?: ReactNode;
  /** Extra row under the header (e.g. a date-range control). */
  children?: ReactNode;
  /** Stick to the top of the scrolling content area (edit pages with Save actions). */
  sticky?: boolean;
  /** Replaces the default title size/weight (text-display bold). Migration only; remove in Phase 5. */
  titleClassName?: string;
  className?: string;
}

/** Page header (component-specs §17): breadcrumb → title (+count) → description, actions right, 24px below. */
export function PageHeader({
  title,
  count,
  description,
  breadcrumbs,
  actions,
  children,
  sticky = false,
  titleClassName,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cx(
        "mb-6",
        sticky && "sticky top-0 z-30 -mx-6 bg-page px-6 py-4 xl:-mx-8 xl:px-8",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-2 text-caption text-fg-muted">
                {breadcrumbs.map((crumb, index) => {
                  const last = index === breadcrumbs.length - 1;
                  return (
                    <Fragment key={`${crumb.label}-${index}`}>
                      <li>
                        {crumb.href && !last ? (
                          <Link
                            to={crumb.href}
                            className="rounded-sm outline-hidden transition-colors duration-fast ease-standard hover:text-fg focus-visible:ring-2 focus-visible:ring-focus"
                          >
                            {crumb.label}
                          </Link>
                        ) : (
                          <span className="text-fg" aria-current={last ? "page" : undefined}>
                            {crumb.label}
                          </span>
                        )}
                      </li>
                      {!last ? (
                        <li aria-hidden className="text-fg-muted">
                          /
                        </li>
                      ) : null}
                    </Fragment>
                  );
                })}
              </ol>
            </nav>
          ) : null}

          {title != null ? (
            <h1
              className={cx(
                titleClassName ?? "text-display font-bold",
                "text-fg",
                breadcrumbs && breadcrumbs.length > 0 && "mt-1",
              )}
            >
              {title}
              {count != null ? <span className="ml-2 font-normal text-fg-muted">({count})</span> : null}
            </h1>
          ) : null}

          {description != null ? <div className="mt-1 text-body text-fg-muted">{description}</div> : null}
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>

      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
