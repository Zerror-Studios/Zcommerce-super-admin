import { addToast } from "@heroui/react";
import { useState } from "react";
import type { Client } from "../../types";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import { toasts } from "../../copy";
import {
  Button as UiButton,
  Card,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
  toastError,
} from "../ui";

export interface NotesCardProps {
  client: Client;
  className?: string;
}

/**
 * Store detail › Notes (PRD-005 FR-3.5, 04 S-03a): platform-only notes about the store. The API keeps one note
 * text per store, so "Add note" (or "Edit note" once there is one) opens an sm pop-up with that text.
 */
export function NotesCard({ client, className }: NotesCardProps) {
  const { can } = useAuth();
  // Notes take notes:write (support agents) or tenants:manage (review C-M5).
  const canWrite = can(PLATFORM_PERMISSIONS.NOTES_WRITE) || can(PLATFORM_PERMISSIONS.TENANTS_MANAGE);
  const [open, setOpen] = useState(false);
  const hasNote = client.notes.trim().length > 0;

  return (
    <Card
      title="Notes"
      className={className}
      actions={
        canWrite ? (
          <UiButton variant="secondary" size="sm" onPress={() => setOpen(true)}>
            {hasNote ? "Edit note" : "Add note"}
          </UiButton>
        ) : undefined
      }
    >
      {hasNote ? (
        <p className="whitespace-pre-line text-body text-fg wrap-anywhere">{client.notes}</p>
      ) : (
        <p className="text-body text-fg-muted">No notes yet.</p>
      )}
      {/* Mounted only while open, so each opening starts from the saved text. */}
      {open ? <NoteDialog client={client} isEdit={hasNote} onClose={() => setOpen(false)} /> : null}
    </Card>
  );
}

function NoteDialog({ client, isEdit, onClose }: { client: Client; isEdit: boolean; onClose: () => void }) {
  const { updateNotes } = useClients();
  const [draft, setDraft] = useState(client.notes);
  const [busy, setBusy] = useState(false);
  const changed = draft.trim() !== client.notes.trim();

  const save = async () => {
    setBusy(true);
    try {
      await updateNotes(client.id, draft.trim());
      addToast({ title: toasts.changesSaved });
      onClose();
    } catch (error) {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !busy && onClose()} width="sm">
      <ModalContent>
        <ModalHeader>{isEdit ? "Edit note" : "Add note"}</ModalHeader>
        <ModalBody>
          <Textarea label="Note" value={draft} onValueChange={setDraft} maxLength={4000} autoFocus />
        </ModalBody>
        <ModalFooter>
          <UiButton variant="secondary" onPress={onClose} isDisabled={busy}>
            Cancel
          </UiButton>
          <UiButton variant="primary" isLoading={busy} isDisabled={!changed} onPress={() => void save()}>
            {isEdit ? "Save note" : "Add note"}
          </UiButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
