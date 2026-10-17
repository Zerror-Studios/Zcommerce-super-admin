/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { ToastProvider } from "@heroui/react";
import { IconClose } from "./icons";

/**
 * One toast setup for both dashboards (docs/design/02-components.md §12): bottom-centre, ink background,
 * white 14px, 12px radius, max 420px, 4s. The status colour stays only on the small leading icon.
 * Optional action ("Undo", "View") goes in the toast's endContent.
 */
export function AppToastProvider() {
  return (
    <ToastProvider
      placement="bottom-center"
      toastOffset={16}
      maxVisibleToasts={3}
      toastProps={{
        variant: "flat",
        radius: "lg",
        timeout: 4000,
        shouldShowTimeoutProgress: false,
        classNames: {
          base: "!bg-fg !border-0 rounded-xl !shadow-popover w-auto max-w-[420px] min-w-0 py-3 pl-4 pr-10",
          wrapper: "gap-0.5",
          title: "text-sm font-medium !text-brand-on",
          description: "text-label !text-nav-fg",
          icon: "size-4 shrink-0",
          closeButton: "opacity-100 absolute right-2 top-1/2 -translate-y-1/2 text-nav-fg hover:text-brand-on",
        },
        closeIcon: <IconClose aria-hidden className="size-4" />,
      }}
    />
  );
}
