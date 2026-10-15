/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type CardPadding = "none" | "sm" | "md";

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  /** Right-aligned header actions. */
  actions?: ReactNode;
  /** md = 24px (default), sm = 16px (compact cards, toolbars), none = 0 (tables). */
  padding?: CardPadding;
}

const paddingClasses: Record<CardPadding, string> = {
  none: "p-0",
  sm: "p-4",
  md: "p-6",
};

/** Card (component-specs §9): white surface, 1px border, 16px radius, card shadow. */
export function Card({ title, description, actions, padding = "md", className, children, ...rest }: CardProps) {
  const hasHeader = title != null || description != null || actions != null;
  return (
    <section
      className={cx("rounded-card border border-line bg-surface shadow-card", paddingClasses[padding], className)}
      {...rest}
    >
      {hasHeader ? (
        <header className={cx("flex items-start justify-between gap-4", children != null && "mb-4")}>
          <div className="min-w-0">
            {title != null ? <h3 className="text-subtitle font-medium text-fg">{title}</h3> : null}
            {description != null ? <p className="mt-1 text-body text-fg-muted">{description}</p> : null}
          </div>
          {actions != null ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
