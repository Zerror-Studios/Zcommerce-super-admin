/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Modal as HeroModal } from "@heroui/react";
import type { ModalProps as HeroModalProps } from "@heroui/react";
import type { ReactNode } from "react";
import { ButtonShortLabelContext } from "./short-label";
import { cx } from "./cx";
import { IconClose } from "./icons";
import { IconTile, type IconTileTone } from "./IconTile";
import { useIsPhone } from "./use-media";

export type ModalWidth = "sm" | "md" | "lg";

export interface ModalProps extends HeroModalProps {
  /**
   * Three sizes only (v2 §4.6): sm 420 (yes/no), md 640 (short forms), lg 960 (builders, AI, app details).
   * Bigger than lg means it should be its own page. Without it, HeroUI sizes map onto these (xs–md → sm,
   * lg–xl → md, 2xl–3xl → lg); 4xl and up keep their own width (the media dialog).
   */
  width?: ModalWidth;
  /** Phone: a bottom sheet of its own height even for a large (lg) pop-up. sm and md always are (v2 §10). */
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

/** Desktop: fade in and rise 8px in 160ms (v2 §2.4), exit fade 140ms. Phone: the sheet slides up in 320ms, down in 220ms. */
const centerMotion = {
  variants: {
    // HeroUI starts from the exit variant, so the 8px offset there is the rise on open.
    enter: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.16, ease: [0, 0, 0.2, 1] as const } },
    exit: { opacity: 0, scale: 1, y: 8, transition: { duration: 0.14, ease: [0.4, 0, 1, 1] as const } },
  },
};
const sheetMotion = {
  variants: {
    enter: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0, 0, 0.2, 1] as const } },
    exit: { opacity: 1, y: "100%", transition: { duration: 0.22, ease: [0.4, 0, 1, 1] as const } },
  },
};

/**
 * Modal (v2 §4.6, `.zc-modal` in src/styles/components.css): white, radius 22, padding 22, centred, max height
 * 100dvh − 64. Title 18/600 with an optional description (`<p className="zc-modal__desc">`) 4px under it; ghost
 * circle close 16px from the top and right; footer right-aligned (secondary Cancel, then the primary). Escape and
 * the overlay close it; focus is trapped and returns to the trigger (HeroUI). Selects, menus and tooltips opened
 * inside render in its layer. Phone (v2 §10): a bottom sheet with a grab handle; sm and md take their own height,
 * lg the full height (unless `sheet`); the sticky footer stacks its buttons full width, the action on top and
 * Cancel under it. Tablet and up: unchanged.
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
  // A dialog opened from the title row's primary keeps its own button labels (ButtonShortLabelContext).
  return (
    <ButtonShortLabelContext.Provider value={undefined}>
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
    </ButtonShortLabelContext.Provider>
  );
}

export interface PopupTitleProps {
  /** A stroke icon from ./icons for the 36px tile. */
  icon: ReactNode;
  /** neutral grey (default) or danger red (delete, discard). */
  tone?: Extract<IconTileTone, "neutral" | "danger">;
  /** Names the thing and asks one question: "Delete this product?" Never "Are you sure?". */
  children: ReactNode;
  /** One line under the title. */
  description?: ReactNode;
}

/**
 * The pop-up title row (v2 §4.6): a 36px icon tile (grey, red for delete), the title, then the close button that
 * the Modal draws. Use inside <ModalHeader>.
 */
export function PopupTitle({ icon, tone = "neutral", children, description }: PopupTitleProps) {
  return (
    <div className="zc-popup-title">
      <IconTile size="md" tone={tone}>
        {icon}
      </IconTile>
      <div className="zc-popup-title__text">
        <span>{children}</span>
        {description != null ? <p className="zc-modal__desc">{description}</p> : null}
      </div>
    </div>
  );
}
