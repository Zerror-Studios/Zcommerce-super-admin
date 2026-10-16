import { addToast } from "@heroui/react";
import type { Client } from "../../types";
import { useClients } from "../../providers/ClientsProvider";
import { ConfirmModal } from "../common/ConfirmModal";
import { confirms, toasts } from "../../copy";

export type StoreAction = "suspend" | "reactivate" | "delete";

export interface StoreActionDialogProps {
  client: Client | null;
  action: StoreAction | null;
  onClose: () => void;
  /** Runs after the store was deleted (e.g. leave the detail page). */
  onDeleted?: () => void;
}

/**
 * Confirm dialogs for the existing store actions (suspend, reactivate, delete), shared by the stores table
 * row menu and the store detail page. Wording from docs/design/05-wording.md §7–8.
 */
export function StoreActionDialog({ client, action, onClose, onDeleted }: StoreActionDialogProps) {
  const { setClientStatus, deleteClient } = useClients();
  const name = client?.storeName ?? "";

  return (
    <>
      <ConfirmModal
        isOpen={client != null && action === "suspend"}
        onClose={onClose}
        {...confirms.suspendStore(name)}
        confirmColor="warning"
        onConfirm={() => {
          if (!client) return;
          setClientStatus(client.id, "suspended");
          addToast({ title: toasts.storeSuspended(client.storeName) });
        }}
      />
      <ConfirmModal
        isOpen={client != null && action === "reactivate"}
        onClose={onClose}
        {...confirms.reactivateStore(name)}
        confirmColor="primary"
        onConfirm={() => {
          if (!client) return;
          setClientStatus(client.id, "active");
          addToast({ title: toasts.storeReactivated(client.storeName) });
        }}
      />
      <ConfirmModal
        isOpen={client != null && action === "delete"}
        onClose={onClose}
        {...confirms.deleteStore(name)}
        confirmColor="danger"
        onConfirm={() => {
          if (!client) return;
          deleteClient(client.id);
          // No Undo: deleting has no restore path yet (docs/design/05-wording.md §7, "Undo" only where possible).
          addToast({ title: toasts.storeDeleted(client.storeName) });
          onDeleted?.();
        }}
      />
    </>
  );
}
