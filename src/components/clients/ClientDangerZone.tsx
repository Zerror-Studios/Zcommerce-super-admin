import { useState, type ReactNode } from "react";
import type { Client } from "../../types";
import { Button as UiButton, Card, cx } from "../ui";
import { StoreActionDialog, type StoreAction } from "./storeActions";

export interface ClientDangerZoneProps {
  client: Client;
  /** Runs after the store was deleted (leave the detail page). */
  onDeleted: () => void;
}

/** Store detail › Settings (docs/design/04-super-admin.md §3.4): suspend / reactivate and delete as settings rows with confirm modals. */
export function ClientDangerZone({ client, onDeleted }: ClientDangerZoneProps) {
  const [action, setAction] = useState<StoreAction | null>(null);
  const isSuspended = client.status === "suspended";

  return (
    <>
      <Card padding="none">
        <SettingsRow
          title={isSuspended ? "Reactivate store" : "Suspend store"}
          description={
            isSuspended
              ? "Bring the storefront and the owner's dashboard back online."
              : "Take the storefront offline and block the owner's dashboard. Orders and data are kept."
          }
          action={
            isSuspended ? (
              <UiButton variant="secondary" onPress={() => setAction("reactivate")}>
                Reactivate store
              </UiButton>
            ) : (
              <UiButton variant="destructive" onPress={() => setAction("suspend")}>
                Suspend store
              </UiButton>
            )
          }
        />
        <SettingsRow
          className="border-t border-line-subtle"
          title="Delete store"
          description="Permanently delete this store and all its data. This can't be undone."
          action={
            <UiButton variant="destructive" onPress={() => setAction("delete")}>
              Delete store
            </UiButton>
          }
        />
      </Card>

      <StoreActionDialog client={client} action={action} onClose={() => setAction(null)} onDeleted={onDeleted} />
    </>
  );
}

function SettingsRow({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="min-w-0">
        <p className="text-body font-medium text-fg">{title}</p>
        <p className="mt-0.5 text-body text-fg-muted">{description}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
