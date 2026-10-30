/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { addToast } from "@heroui/react";
import type { ReactNode } from "react";
import { IconCheck, IconClose, IconInfo } from "./icons";

type ToastOptions = Omit<Parameters<typeof addToast>[0], "title" | "color">;

export interface ToastAction {
  label: string;
  onPress: () => void;
}

/** Toasts with an action stay 6s, plain ones 4s (01 §7.19). */
const TIMEOUT_MS = 4000;
const TIMEOUT_WITH_ACTION_MS = 6000;

const actionButton = (action: ToastAction) => (
  <button type="button" className="zc-toast__action" onClick={action.onPress}>
    {action.label}
  </button>
);

const iconFor = {
  success: <IconCheck aria-hidden className="zc-toast__icon text-[var(--zc-toast-success)]" />,
  error: <IconClose aria-hidden className="zc-toast__icon text-[var(--zc-toast-error)]" />,
  info: <IconInfo aria-hidden className="zc-toast__icon text-[var(--zc-toast-info)]" />,
} as const;

function show(
  message: ReactNode,
  kind: keyof typeof iconFor | null,
  { action, ...options }: ToastOptions & { action?: ToastAction } = {},
) {
  return addToast({
    timeout: kind === "error" ? 0 : action ? TIMEOUT_WITH_ACTION_MS : TIMEOUT_MS,
    icon: kind ? iconFor[kind] : undefined,
    hideIcon: !kind,
    endContent: action ? actionButton(action) : undefined,
    ...options,
    title: message,
    color: kind === "error" ? "danger" : "default",
  });
}

/**
 * Toasts (01 §7.19): `toast("Order archived", { action: { label: "Undo", onPress } })`, `toast.success("Changes
 * saved")`, `toast.error("Couldn't save. Try again.", { action: { label: "Retry", onPress } })`, `toast.info(…)`.
 * Errors stay until closed; the rest leave after 4s (6s with an action).
 */
export const toast = Object.assign(
  (message: ReactNode, options?: ToastOptions & { action?: ToastAction }) => show(message, null, options),
  {
    success: (message: ReactNode, options?: ToastOptions & { action?: ToastAction }) => show(message, "success", options),
    error: (message: ReactNode, options?: ToastOptions & { action?: ToastAction }) => show(message, "error", options),
    info: (message: ReactNode, options?: ToastOptions & { action?: ToastAction }) => show(message, "info", options),
  },
);

/**
 * Error toast: red icon, stays until closed (no auto-dismiss). HeroUI exposes no hook to change toasts by colour
 * centrally, so error toasts go through this helper instead of addToast({ color: "danger" }). Pass an action
 * ("Retry", "View") in endContent, or use toast.error(message, { action }).
 */
export function toastError(title: ReactNode, options: ToastOptions = {}) {
  return show(title, "error", options);
}
