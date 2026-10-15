import { addToast } from "@heroui/react";
import { useState } from "react";
import type { Client, ClientStatus } from "../../types";
import { ConfirmModal } from "../common/ConfirmModal";
import { Button as UiButton } from "../ui";
import { CardWrapper } from "../ui/CardWrapper";

export interface ClientDangerZoneProps {
  client: Client;
  onStatusChange: (status: ClientStatus) => void;
  onDelete: () => void;
}

export function ClientDangerZone({
  client,
  onStatusChange,
  onDelete,
}: ClientDangerZoneProps) {
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isSuspended = client.status === "suspended";

  return (
    <>
      <CardWrapper title={<span className="text-danger">Danger zone</span>} description="Destructive account actions. Confirm carefully — demo only updates local state." bodyClassName="p-8 py-6 flex flex-col gap-4" className="!bg-danger-50/40">
          <div className="flex flex-col gap-3 rounded-xl border border-default-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-body font-bold">
                {isSuspended ? "Reactivate store" : "Suspend store"}
              </p>
              <p className="text-caption text-default-500">
                {isSuspended
                  ? "Restore access for the merchant admin panel."
                  : "Block storefront and merchant dashboard access."}
              </p>
            </div>
            {isSuspended ? (
              <UiButton variant="primary" size="sm" onPress={() => setActivateOpen(true)}>
                Reactivate
              </UiButton>
            ) : (
              <UiButton variant="outline" size="sm" onPress={() => setSuspendOpen(true)}>
                Suspend
              </UiButton>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-danger-200 p-4 sm:flex-row sm:items-center sm:justify-between ">
            <div>
              <p className="text-body font-bold text-danger">Delete client</p>
              <p className="text-caption text-default-500">
                Permanently remove this client from the admin panel list.
              </p>
            </div>
            <UiButton variant="danger-outline" size="sm" onPress={() => setDeleteOpen(true)}>
              Delete
            </UiButton>
          </div>
      </CardWrapper>

      <ConfirmModal
        isOpen={suspendOpen}
        onClose={() => setSuspendOpen(false)}
        title={`Suspend ${client.storeName}?`}
        description="The merchant will lose access until reactivated. Orders and data remain intact."
        confirmLabel="Suspend client"
        confirmColor="warning"
        onConfirm={() => {
          onStatusChange("suspended");
          addToast({
            title: "Client suspended",
            description: `${client.storeName} has been suspended.`,
            color: "warning",
          });
        }}
      />

      <ConfirmModal
        isOpen={activateOpen}
        onClose={() => setActivateOpen(false)}
        title={`Reactivate ${client.storeName}?`}
        description="Store access will be restored immediately for the merchant team."
        confirmLabel="Reactivate"
        confirmColor="success"
        onConfirm={() => {
          onStatusChange("active");
          addToast({
            title: "Client reactivated",
            description: `${client.storeName} is active again.`,
            color: "success",
          });
        }}
      />

      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete ${client.storeName}?`}
        description="This removes the client from the demo list. No backend delete is performed."
        confirmLabel="Delete permanently"
        confirmColor="danger"
        onConfirm={() => {
          onDelete();
          addToast({
            title: "Client deleted",
            description: `${client.storeName} was removed from local state.`,
            color: "danger",
          });
        }}
      />
    </>
  );
}
