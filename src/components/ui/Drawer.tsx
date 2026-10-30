/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Drawer as HeroDrawer } from "@heroui/react";
import type { DrawerProps as HeroDrawerProps } from "@heroui/react";
import { cx } from "./cx";
import { IconClose } from "./icons";

export type DrawerSize = "sm" | "md" | "lg";

export interface DrawerProps extends Omit<HeroDrawerProps, "size"> {
  /** sm 400 (filters, small forms), md 560 (message, review, restock), lg 640 (history, tables). Full width on phone. */
  size?: DrawerSize;
  /** LEGACY (v1 widths): md → size md, lg → size lg. Use `size`. */
  width?: "md" | "lg";
}

/** Enter: slide from the right in 320ms; exit 220ms (01 §7.15). Reduced motion keeps only the fade. */
const drawerMotionProps = {
  variants: {
    enter: { x: 0, opacity: 1, transition: { x: { duration: 0.32, ease: [0, 0, 0.2, 1] as const }, opacity: { duration: 0.22 } } },
    exit: { x: "100%", opacity: 1, transition: { x: { duration: 0.22, ease: [0.4, 0, 1, 1] as const }, opacity: { duration: 0.22 } } },
  },
};

/**
 * Right-hand drawer (01 §7.15b, `.zc-drawer` in src/styles/components.css): full height, 20px radius on the left
 * corners, 64px header (title 18/600, optional meta line under it), ghost circle close, body padding 20 24,
 * optional sticky 72px footer with the buttons on the right (at most one primary). Escape and the overlay close
 * it; focus is trapped and returns to the trigger (HeroUI). Use with DrawerContent / DrawerHeader / DrawerBody /
 * DrawerFooter from @heroui/react. Menus, selects and tooltips inside render in its layer.
 */
export function Drawer({
  classNames,
  placement = "right",
  backdrop = "opaque",
  closeButton,
  size,
  width,
  motionProps,
  ...rest
}: DrawerProps) {
  const resolved: DrawerSize = size ?? width ?? "md";
  return (
    <HeroDrawer
      placement={placement}
      backdrop={backdrop}
      motionProps={motionProps ?? drawerMotionProps}
      closeButton={closeButton ?? <IconClose aria-hidden />}
      classNames={{
        ...classNames,
        backdrop: cx("zc-drawer-backdrop", classNames?.backdrop),
        base: cx("zc-drawer", `zc-drawer--${resolved}`, classNames?.base),
        header: cx("zc-drawer__header", classNames?.header),
        body: cx("zc-drawer__body custom-scroll", classNames?.body),
        footer: cx("zc-drawer__footer", classNames?.footer),
        closeButton: cx("zc-drawer__close", classNames?.closeButton),
      }}
      {...rest}
    />
  );
}
