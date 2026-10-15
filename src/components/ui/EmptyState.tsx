/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ComponentType, ReactNode } from "react";
import { cx } from "./cx";

export interface EmptyStateProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Illustration image URL (each project passes its own asset path). */
  illustration?: string;
  /** Or a 40px icon instead of an illustration. */
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /** Or any custom media element (takes precedence over illustration and icon). */
  media?: ReactNode;
  /** Error message shown under the description. */
  error?: ReactNode;
  /** Primary action, e.g. a Button. For search/filter results offer "Clear filters". */
  action?: ReactNode;
  className?: string;
}

/** Empty state (component-specs §23): centered, illustration or icon, subtitle title, muted description. */
export function EmptyState({
  title = "No data available",
  description,
  illustration,
  icon: Icon,
  media,
  error,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cx("flex flex-col items-center justify-center gap-2 py-12 text-center", className)}>
      {media ? (
        <div className="mb-2">{media}</div>
      ) : illustration ? (
        <img src={illustration} alt="" aria-hidden className="mb-2 h-32 w-auto max-w-full" />
      ) : Icon ? (
        <Icon aria-hidden className="mb-2 size-10 text-fg-muted" />
      ) : null}
      {title ? <p className="text-subtitle font-medium text-fg">{title}</p> : null}
      {description ? <p className="max-w-md text-body text-fg-muted">{description}</p> : null}
      {error ? <p className="text-body text-tone-danger-text">{error}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
