/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { addToast } from "@heroui/react";
import type { ReactNode } from "react";

type ToastOptions = Omit<Parameters<typeof addToast>[0], "title" | "color">;

/**
 * Error toast (docs/design/02-components.md §12): red dot, stays until closed (no auto-dismiss).
 * HeroUI exposes no hook to change toasts by colour centrally, so error toasts go through this helper
 * instead of addToast({ color: "danger" }). Pass an action ("Retry", "View") in endContent.
 */
export function toastError(title: ReactNode, options: ToastOptions = {}) {
  return addToast({
    timeout: 0,
    icon: (
      <span aria-hidden className="flex size-4 items-center justify-center">
        <span className="size-2 rounded-full bg-tone-danger-dot" />
      </span>
    ),
    ...options,
    title,
    color: "danger",
  });
}
