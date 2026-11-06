/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Modal as HeroModal } from "@heroui/react";
import type { ModalProps as HeroModalProps } from "@heroui/react";
import { useCallback, useId, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { ButtonShortLabelContext } from "./short-label";
import { cx } from "./cx";
import { IconClose } from "./icons";
import { IconTile, type IconTileTone } from "./IconTile";
import { resolveModalSize, type LegacyModalSize, type ModalSize, type ModalWidth } from "./modal-size";
import { usePresetMotion } from "./motion";
import { sheetClassName, useSheetDrag } from "./sheet-drag";
import { useIsPhone } from "./use-media";

export type { LegacyModalSize, ModalSize, ModalWidth } from "./modal-size";

export interface ModalProps extends Omit<HeroModalProps, "size"> {
  /**
   * One of four sizes (round 2 G4):
   * - sm 420: yes/no, delete, discard, leave without saving, sign out
   * - md 640: short forms, search, notifications, new tag/category/author
   * - lg 960: builders and pickers (Choose media, customer group rules, app details, import)
   * - full 100vw − 64 × 100vh − 64: only the AI large view and the media editor (crop)
   * Default sm. LEGACY HeroUI sizes still compile (xs → sm, xl → md, 2xl and up → lg).
   */
  size?: ModalSize | LegacyModalSize;
  /** LEGACY alias of `size`. */
  width?: ModalWidth;
  /** Phone: a bottom sheet of its own height even for a large (lg) pop-up. sm and md always are (v2 §10). */
  sheet?: boolean;
}

/**
 * The one dialog (round 2 G4, `.zc-modal` in src/styles/components.css): white, radius 22, padding 22, scrim
 * rgba(11,12,16,.4) with no blur, centred, max height 86vh. Title row: a 36px icon tile (`PopupTitle`), the title,
 * then the 36px close. The body scrolls; header and footer stay fixed. Footer right-aligned: Cancel, then the
 * action; an optional secondary link on the left (`<div className="zc-modal__footer-start">`). Escape and the
 * scrim close it; focus is trapped and returns to the trigger (HeroUI). Selects, menus and tooltips opened inside
 * render in its layer. Motion: the pop-up preset (motion.ts). Phone (v2 §10): a bottom sheet with a grab handle;
 * sm and md take their own height, lg and full the full height (unless `sheet`); the sticky footer stacks its
 * buttons full width, the action on top and Cancel under it. Drag the handle or the title row down to close it
 * (round 2 §8.5, `useSheetDrag`); the 44px close sits at the right of the title row.
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
  const popupMotion = usePresetMotion("popup");
  const sheetMotion = usePresetMotion("sheet");
  const resolved = resolveModalSize(width ?? size);
  const reduced = useReducedMotion() ?? false;
  const sheetClass = sheetClassName(useId());
  const { onOpenChange, onClose, isOpen, isDismissable } = rest;
  const dismiss = useCallback(() => {
    onOpenChange?.(false);
    onClose?.();
  }, [onOpenChange, onClose]);
  useSheetDrag(isPhone && isOpen !== false && isDismissable !== false, sheetClass, dismiss, reduced);
  // A dialog opened from the title row's primary keeps its own button labels (ButtonShortLabelContext).
  return (
    <ButtonShortLabelContext.Provider value={undefined}>
      <HeroModal
        placement={placement ?? (isPhone ? "bottom" : "center")}
        scrollBehavior={scrollBehavior}
        motionProps={motionProps ?? (isPhone ? sheetMotion : popupMotion)}
        closeButton={closeButton ?? <IconClose aria-hidden />}
        classNames={{
          ...classNames,
          wrapper: cx(isPhone && "items-end", classNames?.wrapper),
          backdrop: cx("zc-modal-backdrop", classNames?.backdrop),
          base: cx("zc-modal", `zc-modal--${resolved}`, sheet && "zc-modal--sheet", sheetClass, classNames?.base),
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
