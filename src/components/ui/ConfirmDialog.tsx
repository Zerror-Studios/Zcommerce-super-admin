/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { IconDelete, IconWarning } from "./icons";
import { Modal, PopupTitle } from "./Modal";

export interface ConfirmDialogProps {
  isOpen: boolean;
  /** Called when the dialog should close (Cancel, Escape, overlay). Not called while loading. */
  onClose: () => void;
  onConfirm: () => void;
  /** Names the thing and asks one question: "Delete this product?", "Log out of Kesar & Kin?". */
  title: ReactNode;
  /** One sentence of consequence. */
  description?: ReactNode;
  /** Names the action: "Delete product", "Discard changes". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Shows a spinner on the confirm button and blocks closing while the request runs. */
  isLoading?: boolean;
  /** The title-row icon (v2 §4.6). Defaults to the bin for destructive dialogs and a warning sign otherwise. */
  icon?: ReactNode;
  /** "destructive" (default): red tile and red action. "neutral": grey tile, dark action (Log out). */
  tone?: "destructive" | "neutral";
  /**
   * The title tile's colour, when it differs from the action's. Default: red for destructive, grey for neutral.
   * "Leave without saving?" (board 09) is tileTone="neutral" with tone="destructive": a grey tile with the warning
   * sign and a red "Discard changes".
   */
  tileTone?: "danger" | "neutral";
  /** Show the object (v2 §4.6): the product with its photo, name, price, stock and collections. */
  object?: ReactNode;
  /** A secondary link on the left, e.g. "Archive instead". */
  secondaryAction?: ReactNode;
  /** Extra content under the description (requirements, warnings). */
  children?: ReactNode;
}

/**
 * Confirmation pop-up (v2 §4.6): small (420), a title row with a 36px icon tile (red for delete), the title asks one
 * question, one sentence of consequence, the object itself, then right-aligned pills: Cancel first, the action last.
 * Focus starts on Cancel. Esc closes, except while the action runs. On phone it is a bottom sheet.
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
  tone = "destructive",
  tileTone,
  object,
  secondaryAction,
  children,
}: ConfirmDialogProps) {
  const destructive = tone === "destructive";
  const tile = tileTone ?? (destructive ? "danger" : "neutral");
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !isLoading) onClose();
      }}
      width="sm"
      sheet
      isDismissable={!isLoading}
      isKeyboardDismissDisabled={isLoading}
      hideCloseButton={isLoading}
      role="alertdialog"
    >
      <ModalContent>
        <ModalHeader>
          <PopupTitle tone={tile} icon={icon ?? (tile === "danger" ? <IconDelete aria-hidden /> : <IconWarning aria-hidden />)}>
            {title}
          </PopupTitle>
        </ModalHeader>
        <ModalBody>
          {description != null ? <p className="text-body text-fg-muted">{description}</p> : null}
          {object != null ? <div className="w-full rounded-card border border-line p-3">{object}</div> : null}
          {children != null ? <div className="w-full">{children}</div> : null}
        </ModalBody>
        <ModalFooter>
          {secondaryAction ? <div className="mr-auto">{secondaryAction}</div> : null}
          <Button variant="secondary" autoFocus isDisabled={isLoading} onPress={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? "destructive" : "dark"} isLoading={isLoading} onPress={onConfirm}>
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
