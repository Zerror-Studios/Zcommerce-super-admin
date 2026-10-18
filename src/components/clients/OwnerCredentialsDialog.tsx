import { Button as UiButton, CopyableId, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "../ui";

export interface OwnerCredentialsDialogProps {
  isOpen: boolean;
  storeName: string;
  ownerEmail: string;
  /** Shown once; the API never returns it again (PRD-005 §10). */
  temporaryPassword: string | null;
  onClose: () => void;
}

/**
 * The store owner's first login, shown once after provisioning. There is no
 * admin set-password flow yet, so the Zerror operator passes these on.
 */
export function OwnerCredentialsDialog({
  isOpen,
  storeName,
  ownerEmail,
  temporaryPassword,
  onClose,
}: OwnerCredentialsDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} width="sm" isDismissable={false}>
      <ModalContent>
        <ModalHeader>{storeName} is ready</ModalHeader>
        <ModalBody>
          <p className="text-body text-fg-muted">
            Share these with the owner. The password is shown only now; ask them to change it after
            their first login.
          </p>
          <dl className="mt-3 flex flex-col gap-3">
            <div>
              <dt className="text-caption text-fg-muted">Owner email</dt>
              <dd>
                <CopyableId value={ownerEmail} />
              </dd>
            </div>
            <div>
              <dt className="text-caption text-fg-muted">Temporary password</dt>
              <dd>
                {temporaryPassword ? (
                  <CopyableId value={temporaryPassword} />
                ) : (
                  <span className="text-body text-fg-muted">
                    Unchanged: the owner account already existed.
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </ModalBody>
        <ModalFooter>
          <UiButton variant="primary" onPress={onClose}>
            Done
          </UiButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
