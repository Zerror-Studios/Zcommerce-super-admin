import { addToast } from "@heroui/react";
import { useEffect, useState } from "react";
import type { Client } from "../../types";
import { isUserInputError, mutationFailureCopy } from "../../lib/mutation-errors";
import { useClients } from "../../providers/ClientsProvider";
import { confirms, toasts } from "../../copy";
import {
  Button as UiButton,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
  toastError,
} from "../ui";

export type StoreAction = "suspend" | "reactivate" | "delete";

export interface StoreActionDialogProps {
  client: Client | null;
  action: StoreAction | null;
  onClose: () => void;
  /** Runs after the store was deleted (e.g. leave the detail page). */
  onDeleted?: () => void;
}

/**
 * Confirm dialogs for the store actions (suspend, reactivate, delete), shared by the stores table row
 * menu and the store detail page. Wording from docs/design/05-wording.md §7–8. Suspend
 * records a reason and delete asks for the slug (PRD-005 FR-3.4).
 */
export function StoreActionDialog({ client, action, onClose, onDeleted }: StoreActionDialogProps) {
  const { setClientStatus, deleteClient } = useClients();
  const [reason, setReason] = useState("");
  const [confirmSlug, setConfirmSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = client?.storeName ?? "";
  const open = client != null && action != null;

  useEffect(() => {
    setReason("");
    setConfirmSlug("");
    setError(null);
  }, [client?.id, action]);

  if (!client || !action) return null;

  const copy =
    action === "suspend"
      ? confirms.suspendStore(name)
      : action === "reactivate"
        ? confirms.reactivateStore(name)
        : confirms.deleteStore(name);
  const needsSlug = action === "delete" && !!client.slug;
  const slugMatches = !needsSlug || confirmSlug.trim() === client.slug;

  const run = async () => {
    if (action === "suspend" && !reason.trim()) {
      setError("Give a reason; the owner and the audit log see it.");
      return;
    }
    if (!slugMatches) {
      setError("Type the slug exactly to confirm.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (action === "suspend") {
        await setClientStatus(client.id, "suspended", reason);
        addToast({ title: toasts.storeSuspended(client.storeName) });
      } else if (action === "reactivate") {
        await setClientStatus(client.id, "active");
        addToast({ title: toasts.storeReactivated(client.storeName) });
      } else {
        await deleteClient(client.id, confirmSlug.trim());
        // No Undo: deleting has no restore path (docs/design/05-wording.md §7).
        addToast({ title: toasts.storeDeleted(client.storeName) });
        onDeleted?.();
      }
      onClose();
    } catch (err) {
      // FORBIDDEN and MFA_REQUIRED are reported once by the Apollo link (review C-M5).
      const message = mutationFailureCopy(err);
      if (message && isUserInputError(err)) setError(message);
      else if (message) toastError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} width="sm">
      <ModalContent>
        <ModalHeader>{copy.title}</ModalHeader>
        <ModalBody>
          <p className="text-body text-fg-muted">{copy.description}</p>
          {action === "suspend" ? (
            <Textarea
              label="Reason"
              placeholder="Unpaid for 60 days"
              value={reason}
              onValueChange={setReason}
              isInvalid={!!error}
              errorMessage={error ?? undefined}
              className="mt-3"
            />
          ) : null}
          {needsSlug ? (
            <Input
              label={`Type ${client.slug} to confirm`}
              value={confirmSlug}
              onValueChange={setConfirmSlug}
              isInvalid={!!error}
              errorMessage={error ?? undefined}
              autoComplete="off"
              className="mt-3"
            />
          ) : null}
        </ModalBody>
        <ModalFooter>
          <UiButton variant="ghost" onPress={onClose} isDisabled={busy}>
            Cancel
          </UiButton>
          <UiButton
            variant={action === "reactivate" ? "primary" : "danger"}
            isLoading={busy}
            isDisabled={!slugMatches}
            onPress={() => void run()}
          >
            {copy.confirmLabel}
          </UiButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
