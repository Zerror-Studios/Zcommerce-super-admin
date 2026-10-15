import { addToast } from "@heroui/react";
import type { Client } from "../../types";
import { useClients } from "../../providers/ClientsProvider";
import { ConfirmModal } from "../common/ConfirmModal";

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
        title={`Suspend ${name}?`}
        description="The storefront goes offline and the owner can't log in until you reactivate it."
        confirmLabel="Suspend store"
        confirmColor="warning"
        onConfirm={() => {
          if (!client) return;
          setClientStatus(client.id, "suspended");
          addToast({ title: `${client.storeName} suspended.` });
        }}
      />
      <ConfirmModal
        isOpen={client != null && action === "reactivate"}
        onClose={onClose}
        title={`Reactivate ${name}?`}
        description="The storefront and the owner's dashboard come back online right away."
        confirmLabel="Reactivate store"
        confirmColor="primary"
        onConfirm={() => {
          if (!client) return;
          setClientStatus(client.id, "active");
          addToast({ title: `${client.storeName} reactivated.` });
        }}
      />
      <ConfirmModal
        isOpen={client != null && action === "delete"}
        onClose={onClose}
        title={`Delete ${name}?`}
        description="All store data will be permanently deleted. This can't be undone."
        confirmLabel="Delete store"
        confirmColor="danger"
        onConfirm={() => {
          if (!client) return;
          deleteClient(client.id);
          addToast({ title: `${client.storeName} deleted.` });
          onDeleted?.();
        }}
      />
    </>
  );
}
