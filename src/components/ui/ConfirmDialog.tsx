/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

export interface ConfirmDialogProps {
  isOpen: boolean;
  /** Called when the dialog should close (Cancel, Escape, overlay). Not called while loading. */
  onClose: () => void;
  onConfirm: () => void;
  /** A question naming the thing: "Delete Aura Apparel?" */
  title: ReactNode;
  /** One sentence of consequence. */
  description?: ReactNode;
  /** Names the action: "Delete store". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Shows a spinner on the confirm button and blocks closing while the request runs. */
  isLoading?: boolean;
  /** LEGACY: ignored. The spec has no icon tiles in dialogs. */
  icon?: ReactNode;
  /** Extra content under the description (requirements, warnings). */
  children?: ReactNode;
}

/**
 * Destructive confirmation (docs/design/02-components.md §11): title, one sentence of consequence,
 * footer with ghost Cancel and a filled red action on the right. Cancel gets initial focus.
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
  children,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !isLoading) onClose();
      }}
      width="sm"
      isDismissable={!isLoading}
      isKeyboardDismissDisabled={isLoading}
      hideCloseButton={isLoading}
      role="alertdialog"
    >
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>
          {description != null ? <p className="text-body text-fg-muted">{description}</p> : null}
          {children != null ? <div className="w-full">{children}</div> : null}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" autoFocus isDisabled={isLoading} onPress={onClose}>
            {cancelLabel}
          </Button>
          <Button variant="danger" isLoading={isLoading} onPress={onConfirm}>
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
