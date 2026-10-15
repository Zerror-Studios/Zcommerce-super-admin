/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { ToastProvider } from "@heroui/react";
import { IconClose } from "./icons";

/** One toast setup for both dashboards: top-right, flat, 2s, with a close button. */
export function AppToastProvider() {
  return (
    <ToastProvider
      placement="top-right"
      toastOffset={5}
      toastProps={{
        variant: "flat",
        classNames: {
          description: "rounded-none",
          base: "rounded-md",
          wrapper: "rounded-none",
          closeButton: "opacity-100 absolute right-4 top-1/2 -translate-y-1/2",
        },
        closeIcon: <IconClose className="text-3xl" />,
        timeout: 2000,
      }}
    />
  );
}
