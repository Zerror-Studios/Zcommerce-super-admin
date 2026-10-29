/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Drawer as HeroDrawer } from "@heroui/react";
import type { DrawerProps as HeroDrawerProps } from "@heroui/react";
import { cx } from "./cx";
import { IconClose } from "./icons";

export interface DrawerProps extends Omit<HeroDrawerProps, "size"> {
  /**
   * md 480px (default: forms, details, the assistant); lg 560px (tables, image settings, variant editing).
   * Full width on phones.
   */
  width?: "md" | "lg";
}

const widthClasses = {
  md: "w-full max-w-modal-sm",
  lg: "w-full max-w-drawer-image",
} as const;

/**
 * Right drawer (docs/design/02-components.md §11, owner 2026-10-29: every drawer the same): square corners,
 * full height, 40% ink backdrop, title 16/600 with a bottom border, ghost close button, 220ms slide from
 * HeroUI. Use with DrawerContent / DrawerHeader / DrawerBody / DrawerFooter from @heroui/react.
 */
export function Drawer({ classNames, placement = "right", backdrop = "opaque", closeButton, width = "md", ...rest }: DrawerProps) {
  return (
    <HeroDrawer
      placement={placement}
      backdrop={backdrop}
      closeButton={closeButton ?? <IconClose aria-hidden className="size-4" />}
      classNames={{
        ...classNames,
        backdrop: cx("bg-overlay/40", classNames?.backdrop),
        base: cx("h-dvh max-h-dvh rounded-none bg-surface", widthClasses[width], classNames?.base),
        header: cx("border-b border-line px-5 py-4 pr-14 text-base font-semibold text-fg", classNames?.header),
        body: cx("custom-scroll px-5 py-4 text-sm text-fg", classNames?.body),
        footer: cx("gap-2 border-t border-line px-5 py-3", classNames?.footer),
        closeButton: cx(
          "top-4 end-4 size-8 rounded-lg text-fg-muted transition-colors duration-instant ease-standard hover:bg-surface-sunken hover:text-fg",
          classNames?.closeButton,
        ),
      }}
      {...rest}
    />
  );
}
