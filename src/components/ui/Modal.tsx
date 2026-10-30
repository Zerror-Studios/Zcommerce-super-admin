/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Modal as HeroModal } from "@heroui/react";
import type { ModalProps as HeroModalProps } from "@heroui/react";
import { useEffect, useState } from "react";
import { cx } from "./cx";
import { IconClose } from "./icons";

export type ModalWidth = "sm" | "md" | "lg";

export interface ModalProps extends HeroModalProps {
  /**
   * sm 480 (confirmations, up to 4 fields), md 640 (5–10 fields, connect pop-ups), lg 720 (multi-section forms).
   * Bigger than lg means it should be its own page. Without it, HeroUI sizes map onto these (xs–md → sm,
   * lg–xl → md, 2xl–3xl → lg); 4xl and up keep their own width (the media dialog).
   */
  width?: ModalWidth;
  /** Phone: a bottom sheet of its own height instead of a full-screen sheet (confirm dialogs). */
  sheet?: boolean;
}

const sizeToWidth: Partial<Record<NonNullable<HeroModalProps["size"]>, ModalWidth>> = {
  xs: "sm",
  sm: "sm",
  md: "sm",
  lg: "md",
  xl: "md",
  "2xl": "lg",
  "3xl": "lg",
};

const PHONE_QUERY = "(max-width: 767px)";

/** Desktop: fade + scale(.98 → 1) in 220ms, exit fade 140ms. Phone: the sheet slides up in 320ms, down in 220ms. */
const centerMotion = {
  variants: {
    enter: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.22, ease: [0, 0, 0.2, 1] as const } },
    exit: { opacity: 0, scale: 1, y: 0, transition: { duration: 0.14, ease: [0.4, 0, 1, 1] as const } },
  },
};
const sheetMotion = {
  variants: {
    enter: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0, 0, 0.2, 1] as const } },
    exit: { opacity: 1, y: "100%", transition: { duration: 0.22, ease: [0.4, 0, 1, 1] as const } },
  },
};

function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(PHONE_QUERY).matches : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia(PHONE_QUERY);
    const onChange = () => setPhone(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return phone;
}

/**
 * Modal (01 §7.16, `.zc-modal` in src/styles/components.css): white, radius 20, padding 24, centred, max height
 * 100dvh − 64. Title 18/600 with an optional description (`<p className="zc-modal__desc">`) 4px under it; ghost
 * circle close 16px from the top and right; footer right-aligned (secondary Cancel, then the primary). Escape and
 * the overlay close it; focus is trapped and returns to the trigger (HeroUI). Selects, menus and tooltips opened
 * inside render in its layer. Phone: a full-screen sheet with a sticky footer (or a bottom sheet with `sheet`).
 * Use with ModalContent / ModalHeader / ModalBody / ModalFooter from this folder's index.
 */
export function Modal({
  classNames,
  placement,
  scrollBehavior = "inside",
  closeButton,
  width,
  sheet = false,
  size,
  motionProps,
  ...rest
}: ModalProps) {
  const isPhone = useIsPhone();
  const resolved = width ?? (size ? sizeToWidth[size] : "sm");
  return (
    <HeroModal
      placement={placement ?? (isPhone ? "bottom" : "center")}
      scrollBehavior={scrollBehavior}
      size={resolved ? undefined : size}
      motionProps={motionProps ?? (isPhone ? sheetMotion : centerMotion)}
      closeButton={closeButton ?? <IconClose aria-hidden />}
      classNames={{
        ...classNames,
        wrapper: cx(isPhone && "items-end", classNames?.wrapper),
        backdrop: cx("zc-modal-backdrop", classNames?.backdrop),
        base: cx("zc-modal", resolved && `zc-modal--${resolved}`, sheet && "zc-modal--sheet", classNames?.base),
        header: cx("zc-modal__header", classNames?.header),
        body: cx("zc-modal__body", classNames?.body),
        footer: cx("zc-modal__footer", classNames?.footer),
        closeButton: cx("zc-modal__close", classNames?.closeButton),
      }}
      {...rest}
    />
  );
}
