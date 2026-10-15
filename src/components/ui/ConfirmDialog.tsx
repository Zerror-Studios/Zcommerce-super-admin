/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { ModalBody, ModalContent, ModalFooter } from "@heroui/react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { IconDelete } from "./icons";
import { Modal } from "./Modal";

export interface ConfirmDialogProps {
  isOpen: boolean;
  /** Called when the dialog should close (Cancel, Escape, overlay). Not called while loading. */
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Shows a spinner on the confirm button and blocks closing while the request runs. */
  isLoading?: boolean;
  /** Hero icon inside the danger circle (default: trash). */
  icon?: ReactNode;
  /** Extra content under the description (requirements, warnings). */
  children?: ReactNode;
}

/**
 * Destructive confirmation (component-specs §11, "Delete Card"): danger icon circle, title,
 * muted body, equal-width Cancel (danger-outline) and Delete (danger) buttons. Cancel gets initial focus.
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  isLoading = false,
  icon,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !isLoading) onClose();
      }}
      width="sm"
      hideCloseButton
      isDismissable={!isLoading}
      isKeyboardDismissDisabled={isLoading}
      role="alertdialog"
    >
      <ModalContent>
        <ModalBody className="items-center pt-6 text-center">
          <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-tone-danger text-brand-on">
            {icon ?? <IconDelete className="size-6" />}
          </span>
          <h2 className="mt-2 text-title font-bold text-fg">{title}</h2>
          {description != null ? <p className="text-body text-fg-muted">{description}</p> : null}
          {children != null ? <div className="w-full text-left">{children}</div> : null}
        </ModalBody>
        <ModalFooter className="grid grid-cols-2 gap-2">
          <Button
            variant="danger-outline"
            size="sm"
            className="w-full"
            autoFocus
            isDisabled={isLoading}
            onPress={onClose}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="danger"
            size="sm"
            className="w-full"
            isLoading={isLoading}
            endIcon={isLoading ? undefined : <IconDelete aria-hidden className="size-4" />}
            onPress={onConfirm}
          >
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
