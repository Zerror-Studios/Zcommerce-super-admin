/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Modal as HeroModal } from "@heroui/react";
import type { ModalProps as HeroModalProps } from "@heroui/react";
import { cx } from "./cx";
import { IconClose } from "./icons";

export interface ModalProps extends HeroModalProps {
  /** Design-system width (docs/design/02-components.md §11): sm 480px, md 640px, lg 720px. Overrides HeroUI size. */
  width?: "sm" | "md" | "lg";
}

const widthClasses = {
  sm: "w-full !max-w-modal-sm",
  md: "w-full !max-w-modal-md",
  lg: "w-full !max-w-modal-lg",
} as const;

/**
 * Modal (docs/design/02-components.md §11): white, 16px radius, large shadow, 40% ink backdrop,
 * title 16/600 + ghost close button, footer right-aligned (ghost Cancel + one primary/destructive).
 * Focus trap, Escape and focus return come from HeroUI.
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
        backdrop: cx("bg-overlay/40", classNames?.backdrop),
        base: cx("rounded-2xl border-0 bg-surface !shadow-modal", width && widthClasses[width], classNames?.base),
        // HeroUI slots: text-base / text-sm equal text-subtitle / text-body (tailwind-merge safe).
        header: cx("px-6 pt-5 pb-2 pr-14 text-base font-semibold text-fg", classNames?.header),
        body: cx("px-6 py-2 text-sm text-fg", classNames?.body),
        footer: cx("px-6 pt-3 pb-5 gap-2 justify-end", classNames?.footer),
        closeButton: cx(
          "top-4 end-4 size-8 rounded-lg text-fg-muted transition-colors duration-instant ease-standard hover:bg-surface-sunken hover:text-fg",
          classNames?.closeButton,
        ),
      }}
      {...rest}
    />
  );
}
