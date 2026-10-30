import { useMutation } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useRef, useState } from "react";
import { GRANT_AI_TOP_UP } from "../../graphql/ai";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import {
  AI_NOTE_MAX_LENGTH,
  AI_TOPUP_MAX_QUESTIONS,
  aiFieldErrorsFromServer,
  aiTopUpVariables,
} from "../../lib/platform-ai.util";
import type { PlatformAiTopUpGrant } from "../../types/platform-api";
import {
  Button as UiButton,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
  formatCount,
  formatDate,
  toastError,
} from "../ui";

export interface GrantTopUpDialogProps {
  /** The store to grant to; null closes the dialog. */
  store: { tenantId: string; name: string } | null;
  onClose: () => void;
  /** Called after a grant (reload the list or the store's setting). */
  onGranted?: () => Promise<unknown>;
}

const DEFAULT_QUESTIONS = "50";

/**
 * Grant extra AI questions to one store (PRD-021 FR-6.4, Q7): they last
 * until the end of the store's current month and also close its open
 * top-up requests. `platform:ai:manage`; the server audits it.
 */
export function GrantTopUpDialog({ store, onClose, onGranted }: GrantTopUpDialogProps) {
  if (!store) return null;
  // A new store starts a fresh form (no state carried over).
  return <GrantTopUpForm key={store.tenantId} store={store} onClose={onClose} onGranted={onGranted} />;
}

function GrantTopUpForm({
  store,
  onClose,
  onGranted,
}: GrantTopUpDialogProps & { store: NonNullable<GrantTopUpDialogProps["store"]> }) {
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [grant] = useMutation<{ grantAiTopUp: PlatformAiTopUpGrant }>(GRANT_AI_TOP_UP);

  const run = async () => {
    const result = aiTopUpVariables(store.tenantId, questions, note);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await grant({ variables: result.variables });
      await onGranted?.().catch(() => undefined);
      const expiresAt = response.data?.grantAiTopUp.expiresAt;
      addToast({
        title: `${formatCount(result.variables.questions)} questions granted to ${store.name}.`,
        description: expiresAt ? `They expire on ${formatDate(expiresAt)}.` : undefined,
      });
      onClose();
    } catch (err) {
      const fields = aiFieldErrorsFromServer(err, ["INVALID_TOPUP"], ["questions"]);
      if (fields) {
        setError(fields.questions ?? fields.form ?? null);
      } else {
        const message = mutationFailureCopy(err);
        if (message) toastError(message);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} width="sm">
      <ModalContent>
        <ModalHeader>Grant AI questions to {store.name}</ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-3">
            <Input
              label="Questions"
              type="number"
              min={1}
              max={AI_TOPUP_MAX_QUESTIONS}
              value={questions}
              onValueChange={(value) => {
                setQuestions(value);
                setError(null);
              }}
              description={`1 to ${formatCount(AI_TOPUP_MAX_QUESTIONS)}. They last until the end of the store's current month.`}
              isInvalid={!!error}
              errorMessage={error ?? undefined}
            />
            <Textarea
              label="Note"
              description="Optional. Kept with the grant and in the audit log."
              maxLength={AI_NOTE_MAX_LENGTH}
              value={note}
              onValueChange={setNote}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <UiButton variant="secondary" onPress={onClose} isDisabled={busy}>
            Cancel
          </UiButton>
          <UiButton onPress={() => void run()} isLoading={busy}>
            Grant questions
          </UiButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
