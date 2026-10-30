/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ReactNode } from "react";
import { Button } from "./Button";
import { cx } from "./cx";
import { IconError } from "./icons";

export interface ErrorStateProps {
  /** "Couldn't load products." */
  title?: ReactNode;
  description?: ReactNode;
  /** The screen's existing refetch handler. No new fetching logic here. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Single line inside a table or card ("Couldn't load products. Retry") instead of the centred block. */
  inline?: boolean;
  className?: string;
}

/**
 * Error state (docs/design/02-components.md §6, §15): an inline message with Retry, not only a toast.
 * Never shows error codes or developer wording.
 */
export function ErrorState({
  title = "Couldn't load this.",
  description,
  onRetry,
  retryLabel = "Retry",
  inline = false,
  className,
}: ErrorStateProps) {
  if (inline) {
    return (
      <div role="alert" className={cx("flex items-center justify-center gap-2 py-6 text-body text-fg-muted", className)}>
        <IconError aria-hidden className="size-4 shrink-0 text-tone-danger-text" />
        <span>{title}</span>
        {onRetry ? (
          <Button variant="tertiary" size="sm" onPress={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div role="alert" className={cx("flex flex-col items-center justify-center px-4 py-12 text-center", className)}>
      <span aria-hidden className="flex size-10 items-center justify-center rounded-tile bg-tone-danger-soft text-tone-danger-text">
        <IconError className="size-5" />
      </span>
      <p className="mt-3 text-body font-semibold text-fg">{title}</p>
      {description ? <p className="mt-1 max-w-80 text-body text-fg-muted">{description}</p> : null}
      {onRetry ? (
        <Button variant="secondary" className="mt-4" onPress={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
