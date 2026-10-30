/**
 * "Reminder text" pop-up (04 S-07f): the message with placeholder chips that insert at the cursor and a live
 * preview with a sample store. "Apply text" stages the text; the page's save bar saves it. The API keeps one text
 * for every reminder and no subject, so this edits that one text.
 */
import { useEffect, useRef, useState } from "react";
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, OptionChip, Textarea } from "../ui";
import { REMINDER_PLACEHOLDERS as PLACEHOLDERS, previewReminder } from "./settings-form.util";

const MAX_LENGTH = 2000;

export interface ReminderTextModalProps {
  isOpen: boolean;
  text: string;
  onClose: () => void;
  onApply: (text: string) => void;
}

export function ReminderTextModal({ isOpen, text, onClose, onApply }: ReminderTextModalProps) {
  const [draft, setDraft] = useState(text);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) setDraft(text);
  }, [isOpen, text]);

  const insert = (key: string) => {
    const token = `{{${key}}}`;
    const field = fieldRef.current;
    const start = field?.selectionStart ?? draft.length;
    const end = field?.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${token}${draft.slice(end)}`.slice(0, MAX_LENGTH);
    setDraft(next);
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} width="md">
      <ModalContent>
        <ModalHeader>Reminder text</ModalHeader>
        <ModalBody>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-2">
              <Textarea
                ref={fieldRef}
                label="Message"
                isRequired
                minRows={8}
                maxLength={MAX_LENGTH}
                value={draft}
                onValueChange={setDraft}
              />
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Insert a placeholder">
                {PLACEHOLDERS.map((key) => (
                  <OptionChip key={key} pressed={false} onClick={() => insert(key)} className="font-mono">
                    {`{{${key}}}`}
                  </OptionChip>
                ))}
              </div>
            </div>
            <div className="min-w-0">
              <p className="mb-1.5 text-label font-medium text-fg">Preview</p>
              <div className="min-h-40 whitespace-pre-wrap rounded-xl border border-line bg-surface-sunken p-4 text-body text-fg">
                {draft.trim() ? previewReminder(draft) : <span className="text-fg-muted">The message shows here.</span>}
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isDisabled={!draft.trim()}
            onPress={() => {
              onApply(draft);
              onClose();
            }}
          >
            Apply text
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
