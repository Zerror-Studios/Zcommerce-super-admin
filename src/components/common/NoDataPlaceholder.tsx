import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { IconAdd } from "../ui/icons";

export interface NoDataPlaceholderProps {
  title?: string;
  description?: string;
  error?: string;
  icon?: ReactNode | string;
  /** LEGACY: ignored; EmptyState uses a fixed illustration size. */
  iconHeight?: number | string;
  actionLabel?: string;
  actionTo?: string;
  buttonLabel?: string;
  onButtonClick?: () => void;
  className?: string;
  isLoading?: boolean;
}

/** Kept for existing call sites; renders the shared EmptyState (component-specs §23). */
export function NoDataPlaceholder({
  title = "No data yet",
  description,
  error,
  icon = "/no-activity.svg",
  actionLabel,
  actionTo,
  buttonLabel,
  onButtonClick,
  isLoading,
  className,
}: NoDataPlaceholderProps) {
  const action =
    buttonLabel && onButtonClick ? (
      <Button
        variant="outline"
        size="sm"
        startIcon={<IconAdd aria-hidden className="size-3" />}
        isLoading={isLoading}
        onPress={onButtonClick}
      >
        {buttonLabel}
      </Button>
    ) : actionLabel && actionTo ? (
      <Link to={actionTo} className="text-body font-medium text-brand-text hover:underline">
        {actionLabel} →
      </Link>
    ) : undefined;

  return (
    <EmptyState
      title={title}
      description={description}
      error={error}
      illustration={typeof icon === "string" ? icon : undefined}
      media={typeof icon === "string" ? undefined : icon}
      action={action}
      className={className}
    />
  );
}
