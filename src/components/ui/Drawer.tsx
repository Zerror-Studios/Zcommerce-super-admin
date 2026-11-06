/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Drawer as HeroDrawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader } from "@heroui/react";
import type { DrawerProps as HeroDrawerProps } from "@heroui/react";
import { useCallback, useId, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { ButtonShortLabelContext } from "./short-label";
import { cx } from "./cx";
import { IconBack, IconClose, IconNextPage, IconPrevPage } from "./icons";
import { IconButton } from "./IconButton";
import { usePresetMotion } from "./motion";
import { sheetClassName, useSheetDrag } from "./sheet-drag";
import { useIsPhone } from "./use-media";

export type DrawerSize = "sm" | "md" | "lg";

type Slot = ReactNode | ((onClose: () => void) => ReactNode);

export interface DrawerProps extends Omit<HeroDrawerProps, "size" | "title" | "children"> {
  /** sm and md 440 (round 2 G6: every list/record drawer), lg 640 (history, tables). Full width on phone. */
  size?: DrawerSize;
  /** LEGACY (v1 widths): md → size md, lg → size lg. Use `size`. */
  width?: "md" | "lg";
  /**
   * Header (G6). With a title the drawer draws the whole frame: a 64px header (title and sub-line on the left;
   * `headerActions`, the prev/next arrows and the 36px close on the right), the scrolling body (children) and the
   * sticky `footer`. Without one, children are the usual DrawerContent / DrawerHeader / DrawerBody / DrawerFooter.
   */
  title?: ReactNode;
  /** One line under the title (order date, customer email, "3 filters applied"). */
  subtitle?: ReactNode;
  /** Browse the list behind the drawer: arrows with "Previous" / "Next" tooltips, left of the close. */
  onPrev?: () => void;
  onNext?: () => void;
  /** Disables an arrow at the start or end of the list. */
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  /** Extra controls in the header, left of the arrows (a status chip, a ⋯ menu). */
  headerActions?: ReactNode;
  /** The sticky footer (the primary action on the right). */
  footer?: Slot;
  children?: HeroDrawerProps["children"] | Slot;
  /**
   * Phone (round 2 §8.5): a right-hand drawer opens as a bottom sheet (grab handle, drag down to close, the 44px
   * close at the right of the title row, prev/next beside it, the footer sticky). Default true; false keeps the
   * full-screen page with a back arrow.
   */
  phoneSheet?: boolean;
}

/**
 * Right-hand drawer (round 2 G6, `.zc-drawer` in src/styles/components.css): full height, 440px (lg 640), radius 22 on
 * the open edge, the floating shadow; 64px header with 20px padding, title (and sub-line) on the left, prev/next
 * arrows and a 36px close on the right; the body scrolls; the footer (primary action) sticks to the bottom. Opens
 * with x 24px → 0 and a fade on the soft spring, leaves in 140ms (motion.ts). Escape and the scrim close it; focus
 * is trapped and returns to the trigger (HeroUI). Menus, selects and tooltips inside render in its layer.
 * Responsive (v2 §10): 440px on tablet (lg never covers the rail). Phone (round 2 §8.5): a bottom sheet of its own
 * height (at most the screen less 32px) with a grab handle; drag the handle or the header down to close it
 * (`useSheetDrag`). With `phoneSheet={false}` it is a full-screen page whose close becomes a back arrow.
 */
export function Drawer({
  classNames,
  placement = "right",
  backdrop = "opaque",
  closeButton,
  size,
  width,
  motionProps,
  title,
  subtitle,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  headerActions,
  footer,
  children,
  hideCloseButton,
  phoneSheet = true,
  ...rest
}: DrawerProps) {
  const resolved: DrawerSize = size ?? width ?? "md";
  const rightMotion = usePresetMotion("drawer");
  const leftMotion = usePresetMotion("drawer-left");
  const sheetMotion = usePresetMotion("sheet");
  const isPhone = useIsPhone();
  const reduced = useReducedMotion() ?? false;
  const asSheet = isPhone && phoneSheet && placement === "right";
  const sheetClass = sheetClassName(useId());
  const { onOpenChange, onClose, isOpen, isDismissable } = rest;
  const dismiss = useCallback(() => {
    onOpenChange?.(false);
    onClose?.();
  }, [onOpenChange, onClose]);
  useSheetDrag(asSheet && isOpen !== false && isDismissable !== false, sheetClass, dismiss, reduced);
  const framed = title != null;

  const content = framed ? (
    <DrawerContent>
      {(onClose) => (
        <>
          <DrawerHeader className="zc-drawer__header--frame">
            <div className="zc-drawer__titles">
              <h2 className="zc-drawer__title">{title}</h2>
              {subtitle != null ? <p className="zc-drawer__subtitle">{subtitle}</p> : null}
            </div>
            <div className="zc-drawer__tools">
              {headerActions}
              {onPrev || onNext ? (
                <>
                  <IconButton aria-label="Previous" isDisabled={!onPrev || prevDisabled} onPress={onPrev}>
                    <IconPrevPage aria-hidden />
                  </IconButton>
                  <IconButton aria-label="Next" isDisabled={!onNext || nextDisabled} onPress={onNext}>
                    <IconNextPage aria-hidden />
                  </IconButton>
                </>
              ) : null}
              <IconButton aria-label="Close" showTooltip={false} className="zc-drawer__head-close" onPress={onClose}>
                <IconClose aria-hidden className="zc-drawer__x" />
                <IconBack aria-hidden className="zc-drawer__back" />
              </IconButton>
            </div>
          </DrawerHeader>
          <DrawerBody>{typeof children === "function" ? (children as (close: () => void) => ReactNode)(onClose) : (children as ReactNode)}</DrawerBody>
          {footer != null ? <DrawerFooter>{typeof footer === "function" ? footer(onClose) : footer}</DrawerFooter> : null}
        </>
      )}
    </DrawerContent>
  ) : (
    (children as HeroDrawerProps["children"])
  );

  // A drawer opened from the title row's primary keeps its own button labels (ButtonShortLabelContext).
  return (
    <ButtonShortLabelContext.Provider value={undefined}>
      <HeroDrawer
        placement={asSheet ? "bottom" : placement}
        backdrop={backdrop}
        motionProps={motionProps ?? (asSheet ? sheetMotion : placement === "left" ? leftMotion : rightMotion)}
        hideCloseButton={framed || hideCloseButton}
        closeButton={
          closeButton ?? (
            <>
              <IconClose aria-hidden className="zc-drawer__x" />
              <IconBack aria-hidden className="zc-drawer__back" />
            </>
          )
        }
        classNames={{
          ...classNames,
          backdrop: cx("zc-drawer-backdrop", classNames?.backdrop),
          base: cx(
            "zc-drawer",
            `zc-drawer--${resolved}`,
            framed && "zc-drawer--framed",
            asSheet && `zc-drawer--sheet ${sheetClass}`,
            classNames?.base,
          ),
          header: cx("zc-drawer__header", classNames?.header),
          body: cx("zc-drawer__body custom-scroll", classNames?.body),
          footer: cx("zc-drawer__footer", classNames?.footer),
          closeButton: cx("zc-drawer__close", classNames?.closeButton),
        }}
        {...rest}
      >
        {content}
      </HeroDrawer>
    </ButtonShortLabelContext.Provider>
  );
}
