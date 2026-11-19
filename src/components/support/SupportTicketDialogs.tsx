/**
 * The support drawer's two pop-ups (PRD-049 step A1):
 * - Resolve (FR-A13): how it was resolved (outcome) and a note, both required; the note is posted to the store's
 *   thread, and the store then confirms or says it's still a problem.
 * - Lower the priority (FR-A10): below the store's own impact the store is told why, so a note is required.
 */
import { useState } from "react";
import { useMutation } from "@apollo/client";
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, PopupTitle, Select, SelectItem, Textarea, toastError } from "../ui";
import { IconCheck, IconFlag } from "../ui/icons";
import { RESOLVE_PLATFORM_SUPPORT_TICKET } from "../../graphql/support";
import { errorCodeOf, errorReasonOf } from "../../lib/apollo-client";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import { OUTCOME_OPTIONS, PRIORITY_LABEL, type SupportOutcome, type SupportPriority } from "./support.util";

const NOTE_MAX = 5000;

// ─── Resolve ──────────────────────────────────────────────────────────────

interface ResolveErrors {
  outcome?: string;
  note?: string;
}

export interface ResolveTicketDialogProps {
  ticketId: string;
  isOpen: boolean;
  onClose: () => void;
  refetchQueries: string[];
}

export function ResolveTicketDialog({ ticketId, isOpen, onClose, refetchQueries }: ResolveTicketDialogProps) {
  const [outcome, setOutcome] = useState<SupportOutcome | null>(null);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<ResolveErrors>({});
  const [resolve, { loading }] = useMutation(RESOLVE_PLATFORM_SUPPORT_TICKET, { refetchQueries });

  const close = () => {
    setOutcome(null);
    setNote("");
    setErrors({});
    onClose();
  };

  const submit = async () => {
    const missing: ResolveErrors = {};
    if (!outcome) missing.outcome = "Pick how it was resolved.";
    if (!note.trim()) missing.note = "Write a note for the store.";
    if (missing.outcome || missing.note) {
      setErrors(missing);
      return;
    }
    try {
      await resolve({ variables: { id: ticketId, input: { outcome, note: note.trim() } } });
      close();
    } catch (error) {
      const reason = errorReasonOf(error);
      if (reason === "OUTCOME_REQUIRED") setErrors({ outcome: "Pick how it was resolved." });
      else if (reason === "REQUIRED" || (errorCodeOf(error) === "BAD_USER_INPUT" && !reason)) {
        setErrors({ note: (error as Error).message || "Write a note for the store." });
      } else {
        // ALREADY_RESOLVED / TICKET_CLOSED: someone else moved it; the drawer refreshes.
        const message = mutationFailureCopy(error);
        if (message) toastError(message);
        if (errorCodeOf(error) === "CONFLICT") close();
      }
    }
  };

  const picked = OUTCOME_OPTIONS.find((option) => option.value === outcome);

  return (
    <Modal isOpen={isOpen} onClose={close} size="md">
      <ModalContent>
        <ModalHeader>
          <PopupTitle icon={<IconCheck aria-hidden />}>Resolve ticket</PopupTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <p className="text-label text-fg-muted">
              The store sees your note and confirms it's fixed, or tells you it's still a problem. If they don't answer,
              it closes by itself.
            </p>
            <Select
              label="Outcome"
              isRequired
              selectedKeys={outcome ? new Set([outcome]) : new Set()}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0];
                setOutcome(typeof value === "string" ? (value as SupportOutcome) : null);
                setErrors((current) => ({ ...current, outcome: undefined }));
              }}
              description={picked?.description}
              isInvalid={!!errors.outcome}
              errorMessage={errors.outcome}
            >
              {OUTCOME_OPTIONS.map((option) => (
                <SelectItem key={option.value}>{option.label}</SelectItem>
              ))}
            </Select>
            <Textarea
              label="Note to the store"
              isRequired
              minRows={4}
              maxLength={NOTE_MAX}
              placeholder="What we did, and anything the store should check"
              value={note}
              onValueChange={(value) => {
                setNote(value);
                setErrors((current) => ({ ...current, note: undefined }));
              }}
              isInvalid={!!errors.note}
              errorMessage={errors.note}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onPress={close}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={loading} onPress={() => void submit()}>
            Resolve
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── Lower the priority ──────────────────────────────────────────────────

export interface PriorityNoteDialogProps {
  isOpen: boolean;
  priority: SupportPriority | null;
  impact: SupportPriority | null;
  /** NOTE_REQUIRED from the server, shown on the field. */
  error: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (note: string) => void;
}

export function PriorityNoteDialog({ isOpen, priority, impact, error, isSaving, onClose, onSave }: PriorityNoteDialogProps) {
  const [note, setNote] = useState("");
  const [missing, setMissing] = useState(false);
  // Closed by a save the drawer confirmed (or Cancel): the next lowering starts empty.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (!isOpen) {
      setNote("");
      setMissing(false);
    }
  }

  const save = () => {
    if (!note.trim()) {
      setMissing(true);
      return;
    }
    onSave(note.trim());
  };

  const fieldError = missing ? "Tell the store why the priority is lower." : error;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalContent>
        <ModalHeader>
          <PopupTitle icon={<IconFlag aria-hidden />}>Lower the priority?</PopupTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-3">
            <p className="text-label text-fg-muted">
              The store said this is {impact ? PRIORITY_LABEL[impact].toLowerCase() : "more urgent"}. Moving it to{" "}
              {priority ? PRIORITY_LABEL[priority].toLowerCase() : "a lower priority"} posts your note to their thread.
            </p>
            <Textarea
              label="Note to the store"
              isRequired
              minRows={3}
              maxLength={NOTE_MAX}
              value={note}
              onValueChange={(value) => {
                setNote(value);
                setMissing(false);
              }}
              isInvalid={!!fieldError}
              errorMessage={fieldError ?? undefined}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={isSaving} onPress={save}>
            Change priority
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
