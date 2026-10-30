import { addToast } from "@heroui/react";
import { useState } from "react";
import { useRerunAnalyticsSync } from "../../hooks/use-platform-analytics";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import type { SyncMonitorRow } from "../../types/platform-api";
import { IconRefresh } from "../ui/icons";
import {
  Button as UiButton,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Tooltip,
  formatDateTime,
  toastError,
  type ButtonSize,
} from "../ui";

type RerunRow = Pick<SyncMonitorRow, "tenantId" | "connectionId" | "name" | "propertyId" | "rerunRequestedAt">;

export interface RerunSyncButtonProps {
  row: RerunRow;
  size?: ButtonSize;
}

export interface RerunSyncDialogProps {
  /** The connection to re-run; null keeps the dialog closed. */
  row: RerunRow | null;
  onClose: () => void;
}

/** The "Re-run the analytics sync?" confirm, for a button or a row ⋯ menu. */
export function RerunSyncDialog({ row, onClose }: RerunSyncDialogProps) {
  const { rerun, loading } = useRerunAnalyticsSync();

  const handleConfirm = async () => {
    if (!row) return;
    try {
      await rerun({ tenantId: row.tenantId, connectionId: row.connectionId });
      addToast({ title: `Sync re-run requested for ${row.name}.`, color: "success" });
      onClose();
    } catch (error: unknown) {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    }
  };

  return (
    <Modal
      isOpen={row != null}
      onOpenChange={(open) => {
        if (!open && !loading) onClose();
      }}
      width="sm"
      isDismissable={!loading}
      isKeyboardDismissDisabled={loading}
      hideCloseButton={loading}
    >
      <ModalContent>
        <ModalHeader>Re-run the analytics sync for {row?.name}?</ModalHeader>
        <ModalBody>
          <p className="text-body text-fg-muted">
            An incremental sync of property {row?.propertyId} runs within a minute. It uses the store's daily GA4
            quota; nothing is deleted.
          </p>
        </ModalBody>
        <ModalFooter>
          <UiButton variant="secondary" autoFocus isDisabled={loading} onPress={onClose}>
            Cancel
          </UiButton>
          <UiButton variant="primary" isLoading={loading} onPress={() => void handleConfirm()}>
            Re-run sync
          </UiButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/** The pending chip once a re-run is requested (everyone sees it until the scheduler picks it up). */
export function RerunPendingChip({ requestedAt }: { requestedAt: string }) {
  return (
    <Tooltip content={`Requested ${formatDateTime(requestedAt)}; the scheduler picks it up within a minute.`}>
      <Chip tone="info">Re-run pending</Chip>
    </Tooltip>
  );
}

/**
 * "Re-run sync" for one analytics connection (PRD-012 FR-8.3). Shown only to `platform:tenants:manage` roles
 * (the backend enforces it); once requested the row carries `rerunRequestedAt` and everyone sees a pending chip
 * until the scheduler picks the request up (within a minute).
 */
export function RerunSyncButton({ row, size = "sm" }: RerunSyncButtonProps) {
  const { can } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const canManage = can(PLATFORM_PERMISSIONS.TENANTS_MANAGE);

  if (row.rerunRequestedAt) return <RerunPendingChip requestedAt={row.rerunRequestedAt} />;
  if (!canManage) return null;

  return (
    <>
      <UiButton variant="secondary" size={size} startIcon={<IconRefresh aria-hidden />} onPress={() => setIsOpen(true)}>
        Re-run sync
      </UiButton>
      <RerunSyncDialog row={isOpen ? row : null} onClose={() => setIsOpen(false)} />
    </>
  );
}
