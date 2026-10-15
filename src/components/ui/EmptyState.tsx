/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ComponentType, ReactNode } from "react";
import { cx } from "./cx";
import { IconOrders } from "./icons";

export interface EmptyStateProps {
  /** Short and specific: "No orders yet". */
  title?: ReactNode;
  /** One sentence that says what happens next (max 320px wide). */
  description?: ReactNode;
  /** LEGACY: ignored. Illustrations (the cactus) are removed everywhere; pass the section's icon instead. */
  illustration?: string;
  /** The section's icon, shown at 20px in a 40px muted tile. */
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /** Custom media element (takes precedence over the icon tile). */
  media?: ReactNode;
  /** Error message shown under the description. */
  error?: ReactNode;
  /** One action, usually a secondary Button. */
  action?: ReactNode;
  /** Inside small dashboard cards: one secondary line of text, no icon, no button. */
  compact?: boolean;
  className?: string;
}

/**
 * Empty state (docs/design/02-components.md §9, ref 06): 40px muted tile with the section icon →
 * title 14/600 → one sentence 14px secondary → one button. Copy per page lives in docs/design/05-wording.md.
 */
export function EmptyState({
  title = "Nothing here yet",
  description,
  icon: Icon = IconOrders,
  media,
  error,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  if (compact) {
    return <p className={cx("py-6 text-center text-body text-fg-muted", className)}>{description ?? title}</p>;
  }
  return (
    <div className={cx("flex flex-col items-center justify-center px-4 py-12 text-center", className)}>
      {media ?? (
        <span aria-hidden className="flex size-10 items-center justify-center rounded-tile bg-surface-sunken text-fg-muted">
          <Icon aria-hidden className="size-5" />
        </span>
      )}
      {title ? <p className="mt-3 text-body font-semibold text-fg">{title}</p> : null}
      {description ? <p className="mt-1 max-w-80 text-body text-fg-muted">{description}</p> : null}
      {error ? <p className="mt-1 text-body text-tone-danger-text">{error}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
