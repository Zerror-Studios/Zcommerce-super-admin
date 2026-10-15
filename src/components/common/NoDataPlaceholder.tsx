import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";

export interface NoDataPlaceholderProps {
  title?: string;
  description?: string;
  error?: string;
  icon?: ReactNode | string;
  /** LEGACY: ignored; illustrations are removed (docs/design/02-components.md §9). */
  iconHeight?: number | string;
  actionLabel?: string;
  actionTo?: string;
  buttonLabel?: string;
  onButtonClick?: () => void;
  className?: string;
  isLoading?: boolean;
}

/** Kept for existing call sites; renders the shared EmptyState (docs/design/02-components.md §9). */
export function NoDataPlaceholder({
  title = "Nothing here yet",
  description,
  error,
  icon,
  actionLabel,
  actionTo,
  buttonLabel,
  onButtonClick,
  isLoading,
  className,
}: NoDataPlaceholderProps) {
  const action =
    buttonLabel && onButtonClick ? (
      <Button variant="secondary" isLoading={isLoading} onPress={onButtonClick}>
        {buttonLabel}
      </Button>
    ) : actionLabel && actionTo ? (
      <Link to={actionTo} className="text-body font-medium text-brand hover:underline">
        {actionLabel}
      </Link>
    ) : undefined;

  return (
    <EmptyState
      title={title}
      description={description}
      error={error}
      media={typeof icon === "string" ? undefined : icon}
      action={action}
      className={className}
    />
  );
}
