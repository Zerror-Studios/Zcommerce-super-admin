/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type CardPadding = "none" | "sm" | "md";

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  /** Right-aligned header action: a link or a ghost button. */
  actions?: ReactNode;
  /** Body padding: md = 20px (default), sm = 16px (compact), none = 0 (tables, lists). */
  padding?: CardPadding;
}

const paddingClasses: Record<CardPadding, string> = {
  none: "p-0",
  sm: "p-4",
  md: "p-5",
};

/**
 * Card (docs/design/02-components.md §4): white, 1px border, 12px radius, no shadow.
 * Header 16px 20px with a 14/600 title and an optional action on the right. No nested cards, no icon tiles.
 */
export function Card({ title, description, actions, padding = "md", className, children, ...rest }: CardProps) {
  const hasHeader = title != null || description != null || actions != null;
  return (
    <section className={cx("rounded-card border border-line bg-surface", className)} {...rest}>
      {hasHeader ? (
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4">
          <div className="min-w-0">
            {title != null ? <h3 className="text-body font-semibold text-fg">{title}</h3> : null}
            {description != null ? <p className="mt-0.5 text-label text-fg-muted">{description}</p> : null}
          </div>
          {actions != null ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children != null ? (
        <div className={cx(paddingClasses[padding], hasHeader && padding !== "none" && "pt-0")}>{children}</div>
      ) : null}
    </section>
  );
}
