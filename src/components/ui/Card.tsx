/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type CardPadding = "none" | "sm" | "md";

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  /** A visual left of the title: a health ring, an icon tile or a logo (board 60). Decorative or self-labelled. */
  leading?: ReactNode;
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
 * Card (01 §7.13): white, 1px border, 16px radius, no shadow, padding 20. Header: a 15/600 title with an optional
 * 13px muted line under it, and one action on the right (a tertiary sm link or a ghost circle); 16px to the body.
 * `leading` sits left of the title, centred on the title block (12px gap). Photos inside cards and mosaics use
 * `rounded-photo` (14px, --zc-radius-photo).
 */
export function Card({ title, description, leading, actions, padding = "md", className, children, ...rest }: CardProps) {
  const hasHeader = title != null || description != null || actions != null || leading != null;
  return (
    <section className={cx("rounded-[var(--zc-radius-card)] border border-line bg-surface", className)} {...rest}>
      {hasHeader ? (
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 pb-4 pt-5">
          <div className="flex min-w-0 items-center gap-3">
            {leading != null ? <div className="flex shrink-0 items-center">{leading}</div> : null}
            <div className="min-w-0">
              {title != null ? <h3 className="text-title-3 text-fg">{title}</h3> : null}
              {description != null ? <p className="mt-0.5 text-label text-fg-muted">{description}</p> : null}
            </div>
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
