/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { ToastProvider } from "@heroui/react";
import { IconClose } from "./icons";

/**
 * One toast setup for both dashboards (01 §7.19, `.zc-toast`): bottom centre, 24px above the edge, ink background,
 * white 14px; a capsule for one line, radius 16 for two; max 560px; 4s (6s with an action, errors stay); the timer
 * pauses on hover; up to 3 stack. Status colour only on the small leading icon. Use the `toast` helpers in toast.tsx.
 */
export function AppToastProvider() {
  return (
    <ToastProvider
      placement="bottom-center"
      toastOffset={24}
      maxVisibleToasts={3}
      toastProps={{
        variant: "flat",
        radius: "full",
        timeout: 4000,
        shouldShowTimeoutProgress: false,
        classNames: {
          base: "zc-toast",
          wrapper: "gap-0.5",
          title: "zc-toast__title",
          description: "zc-toast__desc",
          icon: "zc-toast__icon",
          closeButton: "zc-toast__close",
        },
        closeIcon: <IconClose aria-hidden className="size-4" />,
      }}
    />
  );
}
