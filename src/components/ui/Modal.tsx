/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Modal as HeroModal } from "@heroui/react";
import type { ModalProps as HeroModalProps } from "@heroui/react";
import { cx } from "./cx";
import { IconClose } from "./icons";

export interface ModalProps extends HeroModalProps {
  /** Design-system width (component-specs §11): sm 400px, md 560px, lg 720px. Overrides HeroUI size. */
  width?: "sm" | "md" | "lg";
}

const widthClasses = {
  sm: "w-full !max-w-modal-sm",
  md: "w-full !max-w-modal-md",
  lg: "w-full !max-w-modal-lg",
} as const;

/**
 * Modal (component-specs §11): white surface, 16px radius, modal shadow, 24px padding,
 * overlay at 50%, ghost close button. Focus trap, Escape and focus return come from HeroUI.
 * Use with ModalContent / ModalHeader / ModalBody / ModalFooter from this folder's index.
 */
export function Modal({ classNames, placement = "center", scrollBehavior = "inside", closeButton, width, ...rest }: ModalProps) {
  return (
    <HeroModal
      placement={placement}
      scrollBehavior={scrollBehavior}
      closeButton={closeButton ?? <IconClose aria-hidden className="size-4" />}
      classNames={{
        ...classNames,
        backdrop: cx("bg-overlay/50", classNames?.backdrop),
        base: cx("rounded-2xl border-0 bg-surface !shadow-modal", width && widthClasses[width], classNames?.base),
        // HeroUI slots: text-2xl / text-sm equal text-title / text-body (tailwind-merge safe).
        header: cx("px-6 pt-6 pb-2 text-2xl font-bold text-fg", classNames?.header),
        body: cx("px-6 py-2 text-sm text-fg", classNames?.body),
        footer: cx("px-6 pt-2 pb-6 gap-3", classNames?.footer),
        closeButton: cx(
          "top-4 end-4 size-8 rounded-full text-fg-muted transition-colors duration-fast ease-standard hover:bg-tone-neutral-soft hover:text-fg",
          classNames?.closeButton,
        ),
      }}
      {...rest}
    />
  );
}
