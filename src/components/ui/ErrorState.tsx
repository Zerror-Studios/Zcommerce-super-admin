/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ReactNode } from "react";
import { Button } from "./Button";
import { cx } from "./cx";
import { IconError } from "./icons";

export interface ErrorStateProps {
  title?: ReactNode;
  description?: ReactNode;
  /** The screen's existing refetch handler. No new fetching logic here. */
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/** Error state (component-specs §23): danger icon, title, description, outline "Try Again". */
export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  retryLabel = "Try Again",
  className,
}: ErrorStateProps) {
  return (
    <div role="alert" className={cx("flex flex-col items-center justify-center gap-2 py-12 text-center", className)}>
      <IconError aria-hidden className="mb-2 size-10 text-tone-danger-text" />
      <p className="text-subtitle font-medium text-fg">{title}</p>
      {description ? <p className="max-w-md text-body text-fg-muted">{description}</p> : null}
      {onRetry ? (
        <Button variant="outline" className="mt-4" onPress={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
