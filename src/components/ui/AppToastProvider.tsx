/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { ToastProvider } from "@heroui/react";
import { useReducedMotion } from "framer-motion";
import { IconClose } from "./icons";
import { fadeVariants, toastMotionProps } from "./motion";
import { TOAST_TIMEOUT_MS } from "./toast";

/** Round 3 F1: 96px from the bottom, clear of the Zcom AI bar (52px at 24px) and its 2px hover lift. */
const TOAST_OFFSET_PX = 96;

/**
 * One toast setup for both dashboards (round 2 G7, `.zc-toast`): bottom centre, 96px up (above the AI bar), max
 * width 420, ink background, white 14px, radius 14; 3.2s (longer with an action, errors stay); the timer pauses on
 * hover; up to 3 stack. Enters y 12 → 0 with a fade on the snappy spring, leaves in 140ms (motion.ts). Status
 * colour only on the small leading icon. Use the `toast` helpers in toast.tsx.
 */
export function AppToastProvider() {
  const reduced = useReducedMotion() ?? false;
  return (
    <ToastProvider
      placement="bottom-center"
      toastOffset={TOAST_OFFSET_PX}
      maxVisibleToasts={3}
      toastProps={{
        variant: "flat",
        radius: "none",
        timeout: TOAST_TIMEOUT_MS,
        shouldShowTimeoutProgress: false,
        motionProps: reduced
          ? { initial: fadeVariants.initial, exit: fadeVariants.exit, transition: fadeVariants.enter.transition }
          : toastMotionProps,
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
