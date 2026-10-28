import { ownerNoticeKind, ownerNoticeKindEnum } from "../../lib/owner-onboarding";
import { Button as UiButton, CopyableId, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "../ui";

export interface OwnerCredentialsDialogProps {
  isOpen: boolean;
  storeName: string;
  ownerEmail: string;
  /** True when the owner was emailed a set-password link (PRD-014 PLT-07). */
  ownerInviteSent: boolean;
  /** Legacy servers only; null since PRD-014, never returned twice (PRD-005 §10). */
  temporaryPassword: string | null;
  onClose: () => void;
}

/**
 * Shown once after provisioning. Since PRD-014 (PLT-07) the owner chooses
 * their own password from an emailed link, so the dialog says where the
 * invite went; a temporary password appears only if an older server sent one.
 */
export function OwnerCredentialsDialog({
  isOpen,
  storeName,
  ownerEmail,
  ownerInviteSent,
  temporaryPassword,
  onClose,
}: OwnerCredentialsDialogProps) {
  const kind = ownerNoticeKind({ ownerInviteSent, ownerTemporaryPassword: temporaryPassword });
  return (
    <Modal isOpen={isOpen} onClose={onClose} width="sm">
      <ModalContent>
        <ModalHeader>{storeName} is ready</ModalHeader>
        <ModalBody>
          {kind === ownerNoticeKindEnum.INVITE_SENT ? (
            <p className="text-body text-fg-muted">
              Invite sent to <span className="font-medium text-fg">{ownerEmail}</span>. The owner sets their own
              password from the link in that email. If it doesn't arrive, use Resend owner invite on the store page.
            </p>
          ) : null}
          {kind === ownerNoticeKindEnum.INVITE_NOT_SENT ? (
            <p className="text-body text-fg-muted">
              No invite email was sent to <span className="font-medium text-fg">{ownerEmail}</span>, for example
              because the owner account already existed. Use Resend owner invite on the store page to email them a
              set-password link.
            </p>
          ) : null}
          {kind === ownerNoticeKindEnum.TEMPORARY_PASSWORD && temporaryPassword ? (
            <>
              <p className="text-body text-fg-muted">
                Share these with the owner. The password is shown only now; ask them to change it after their first
                login.
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
                    <CopyableId value={temporaryPassword} />
                  </dd>
                </div>
              </dl>
            </>
          ) : null}
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
