import type { ReactNode } from "react";
import { ConfirmDialog } from "../ui";
import { IconInfo, IconWarning } from "../ui/icons";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Names the thing and asks one question (v2 §4.6): "Revoke this session?". */
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * danger → destructive (red bin tile, red action).
   * warning → destructive action with a red warning tile (switching a safeguard off, cancelling).
   * primary / success → neutral (grey tile, dark action), for yes/no questions that change nothing irreversibly.
   * Cancel always comes first and is never red.
   */
  confirmColor?: "danger" | "primary" | "warning" | "success";
  /** The title-row icon; defaults by `confirmColor`. */
  icon?: ReactNode;
  isLoading?: boolean;
}

/**
 * The console's yes/no pop-up: always the kit ConfirmDialog (v2 §4.6: small 420, a 36px icon tile in the title
 * row, one sentence of consequence, Cancel then the action, focus on Cancel; a bottom sheet on phone).
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmColor = "danger",
  icon,
  isLoading = false,
}: ConfirmModalProps) {
  const confirmAndClose = () => {
    onConfirm();
    onClose();
  };
  const destructive = confirmColor === "danger" || confirmColor === "warning";
  const defaultIcon =
    confirmColor === "warning" ? <IconWarning aria-hidden /> : confirmColor === "danger" ? undefined : <IconInfo aria-hidden />;

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
      tone={destructive ? "destructive" : "neutral"}
      icon={icon ?? defaultIcon}
    />
  );
}
