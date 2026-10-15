import {
  Button,
  ConfirmDialog,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "../ui";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * danger → destructive ConfirmDialog (component-specs §11).
   * warning → danger buttons (the design system has no warning button).
   * primary / success → primary confirm (the design system has no success button).
   */
  confirmColor?: "danger" | "primary" | "warning" | "success";
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmColor = "danger",
  isLoading = false,
}: ConfirmModalProps) {
  const confirmAndClose = () => {
    onConfirm();
    onClose();
  };

  if (confirmColor === "danger") {
    return (
      <ConfirmDialog
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={confirmAndClose}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        isLoading={isLoading}
      />
    );
  }

  const destructive = confirmColor === "warning";

  return (
    <Modal isOpen={isOpen} onClose={onClose} width="md">
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>
          <p className="text-fg-muted">{description}</p>
        </ModalBody>
        <ModalFooter>
          <Button
            variant={destructive ? "danger-outline" : "outline"}
            size="sm"
            onPress={onClose}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            size="sm"
            isLoading={isLoading}
            onPress={confirmAndClose}
          >
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
