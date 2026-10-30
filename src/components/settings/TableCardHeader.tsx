import type { ReactNode } from "react";

/**
 * A card header (01 §7.13: title-3, one muted line, actions on the right) for a DataTable's toolbar slot, so a
 * table that is its own card reads like the other settings cards.
 */
export function TableCardHeader({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** A second row under the title (search, filter). */
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-line-subtle px-5 pb-4 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-title-3 text-fg">{title}</h3>
          {description != null ? <p className="mt-0.5 text-label text-fg-muted">{description}</p> : null}
        </div>
        {actions != null ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children != null ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
