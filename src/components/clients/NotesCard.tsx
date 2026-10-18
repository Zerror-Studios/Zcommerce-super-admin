import { addToast } from "@heroui/react";
import { useEffect, useState } from "react";
import type { Client } from "../../types";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import { toasts } from "../../copy";
import { Button as UiButton, Card, Textarea, toastError } from "../ui";

export interface NotesCardProps {
  client: Client;
  className?: string;
}

/** Store detail › Notes: platform-only notes about the store, editable in place (PRD-005 FR-3.5). */
export function NotesCard({ client, className }: NotesCardProps) {
  const { updateNotes } = useClients();
  const { can } = useAuth();
  // Notes take notes:write (support agents) or tenants:manage (review C-M5).
  const canWrite = can(PLATFORM_PERMISSIONS.NOTES_WRITE) || can(PLATFORM_PERMISSIONS.TENANTS_MANAGE);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(client.notes);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(client.notes);
  }, [client.notes, editing]);

  const save = async () => {
    setBusy(true);
    try {
      await updateNotes(client.id, draft.trim());
      addToast({ title: toasts.changesSaved });
      setEditing(false);
    } catch (error) {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Notes"
      className={className}
      actions={
        editing || !canWrite ? undefined : (
          <UiButton variant="ghost" size="sm" onPress={() => setEditing(true)}>
            {client.notes ? "Edit" : "Add note"}
          </UiButton>
        )
      }
    >
      {editing ? (
        <div className="flex flex-col gap-3">
          <Textarea aria-label="Notes" value={draft} onValueChange={setDraft} maxLength={4000} />
          <div className="flex justify-end gap-2">
            <UiButton variant="ghost" size="sm" onPress={() => setEditing(false)} isDisabled={busy}>
              Cancel
            </UiButton>
            <UiButton variant="primary" size="sm" isLoading={busy} onPress={() => void save()}>
              Save
            </UiButton>
          </div>
        </div>
      ) : client.notes ? (
        <p className="whitespace-pre-line text-body text-fg">{client.notes}</p>
      ) : (
        <p className="text-body text-fg-muted">No notes yet.</p>
      )}
    </Card>
  );
}
