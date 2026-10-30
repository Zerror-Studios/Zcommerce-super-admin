/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ComponentType, ReactNode } from "react";
import { Button } from "./Button";
import { cx } from "./cx";
import { IconFilters, IconOrders } from "./icons";

export interface EmptyStateProps {
  /** Short and specific: "No orders yet". */
  title?: ReactNode;
  /** One friendly sentence that says what happens next (max 360px wide). Never "No data". */
  description?: ReactNode;
  /** LEGACY: ignored. Illustrations (the cactus) are removed everywhere; pass the section's icon instead. */
  illustration?: string;
  /** The section's icon: 22px in a 48px circle tinted with the page's section colour (`.zc-sec-*`). */
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /** Custom media element (takes precedence over the icon circle). */
  media?: ReactNode;
  /** Error message shown under the description. */
  error?: ReactNode;
  /** One action: primary md for "nothing yet" ("Add your first product"). */
  action?: ReactNode;
  /**
   * "first-use" (default): nothing exists yet. "no-results": a search or filter matched nothing — the default
   * title and text become "No results" / "Try a different search or clear the filters." and `onClearFilters`
   * shows a tertiary "Clear filters". Never show first-use while filters are applied (01 §7.14).
   */
  kind?: "first-use" | "no-results";
  onClearFilters?: () => void;
  /** Inside small dashboard cards: one secondary line of text, no icon, no button. */
  compact?: boolean;
  className?: string;
}

/**
 * Empty state (01 §7.20): centred, padding 48 24 — 48px circle (section soft) with a 22px section glyph, title
 * 15/600 16px below, one line 13px muted (max 360px), one action 16px below.
 */
export function EmptyState({
  title,
  description,
  icon,
  media,
  error,
  action,
  kind = "first-use",
  onClearFilters,
  compact = false,
  className,
}: EmptyStateProps) {
  const noResults = kind === "no-results";
  const heading = title ?? (noResults ? "No results" : "Nothing here yet");
  const text = description ?? (noResults ? "Try a different search or clear the filters." : undefined);
  const Icon = icon ?? (noResults ? IconFilters : IconOrders);

  if (compact) {
    return <p className={cx("py-6 text-center text-label text-fg-muted", className)}>{text ?? heading}</p>;
  }
  return (
    <div className={cx("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {media ?? (
        <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-sec-soft text-sec-fg">
          <Icon aria-hidden className="size-5.5" />
        </span>
      )}
      {heading ? <p className="mt-4 text-title-3 text-fg">{heading}</p> : null}
      {text ? <p className="mt-1 max-w-90 text-label text-fg-muted">{text}</p> : null}
      {error ? <p className="mt-1 max-w-90 text-label text-tone-danger-text">{error}</p> : null}
      {action ? (
        <div className="mt-4">{action}</div>
      ) : noResults && onClearFilters ? (
        <div className="mt-4">
          <Button variant="tertiary" onPress={onClearFilters}>
            Clear filters
          </Button>
        </div>
      ) : null}
    </div>
  );
}
