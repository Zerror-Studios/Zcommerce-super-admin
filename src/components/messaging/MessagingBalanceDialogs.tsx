/**
 * Console › Messaging balance pop-ups (backend PRD-050 FR-4.6):
 * - Grant or correct: rupees with a direction (add or remove), a required
 *   reason, then a confirm step with the balance before and after. A
 *   correction never removes more than the store has available.
 * - Record payment: a PENDING top-up paid by bank transfer, with the
 *   transfer's reference; the server credits the balance.
 * - Withdraw: a PENDING top-up nobody will pay, with the reason.
 * All need platform:messaging:manage; the server checks again and audits.
 * Each dialog is mounted on open, so every opening starts empty.
 */
import { useMutation } from "@apollo/client";
import { useState } from "react";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  PopupTitle,
  SegmentedSwitch,
  Textarea,
  toast,
  toastError,
} from "../ui";
import { IconCheck, IconWallet, IconWarning } from "../ui/icons";
import {
  ADJUST_MESSAGING_BALANCE,
  CANCEL_MESSAGING_TOPUP,
  COMPLETE_MESSAGING_TOPUP,
} from "../../graphql/messaging";
import {
  BALANCE_REASON_MAX_CHARS,
  BALANCE_REFETCH,
  TOPUP_REFERENCE_MAX_CHARS,
  adjustDirectionEnum,
  adjustDraftOf,
  balanceAfter,
  balanceFailureCopy,
  balanceFieldErrorsFromServer,
  formatPaise,
  shouldReloadBalanceAfter,
  validateAdjustDraft,
  validateTopUpReference,
  validateWithdrawReason,
  type AdjustDirection,
  type AdjustDraft,
  type AdjustErrors,
  type MessagingBalance,
  type MessagingTopUp,
} from "../../lib/platform-messaging-balance.util";

function fail(error: unknown) {
  const message = balanceFailureCopy(error);
  if (message) toastError(message);
}

function storeNameOf(row: { tenantName: string | null; tenantId: string }): string {
  return row.tenantName || row.tenantId;
}

// ─── Grant or correct ─────────────────────────────────────────────────────

export interface AdjustBalanceDialogProps {
  balance: MessagingBalance;
  onClose: () => void;
}

const DIRECTION_ITEMS: Array<{ value: AdjustDirection; label: string }> = [
  { value: adjustDirectionEnum.GRANT, label: "Grant (add)" },
  { value: adjustDirectionEnum.CORRECTION, label: "Correction (remove)" },
];

export function AdjustBalanceDialog({ balance, onClose }: AdjustBalanceDialogProps) {
  const [draft, setDraft] = useState<AdjustDraft>(adjustDraftOf);
  const [errors, setErrors] = useState<AdjustErrors>({});
  const [confirming, setConfirming] = useState<number | null>(null);
  const [adjust, { loading }] = useMutation(ADJUST_MESSAGING_BALANCE, { refetchQueries: BALANCE_REFETCH });
  const storeName = storeNameOf(balance);
  const isCorrection = draft.direction === adjustDirectionEnum.CORRECTION;

  const update = (patch: Partial<AdjustDraft>, keys: Array<keyof AdjustErrors>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current, form: undefined };
      for (const key of keys) next[key] = undefined;
      return next;
    });
  };

  const review = () => {
    const check = validateAdjustDraft(draft, balance.availablePaise);
    if (check.amountPaise === null) {
      setErrors(check.errors);
      return;
    }
    setConfirming(check.amountPaise);
  };

  const submit = async (amountPaise: number) => {
    try {
      await adjust({ variables: { tenantId: balance.tenantId, amountPaise, reason: draft.reason.trim() } });
      toast.success(
        amountPaise > 0
          ? `${formatPaise(amountPaise)} granted to ${storeName}`
          : `${formatPaise(-amountPaise)} removed from ${storeName}`,
      );
      onClose();
    } catch (error) {
      const fields = balanceFieldErrorsFromServer(error);
      if (fields) {
        setErrors(fields);
        setConfirming(null);
        return;
      }
      fail(error);
    }
  };

  return (
    <Modal isOpen onClose={onClose} size="sm">
      <ModalContent>
        <ModalHeader>
          <PopupTitle icon={<IconWallet aria-hidden />}>
            {confirming === null ? "Grant or correct" : "Confirm the change"}
          </PopupTitle>
        </ModalHeader>
        <ModalBody>
          {confirming === null ? (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-body font-medium text-fg">{storeName}</p>
                <p className="text-label text-fg-muted">
                  Balance {formatPaise(balance.balancePaise)} · available {formatPaise(balance.availablePaise)}
                </p>
              </div>
              <SegmentedSwitch<AdjustDirection>
                ariaLabel="Grant or correction"
                items={DIRECTION_ITEMS}
                value={draft.direction}
                onChange={(direction) => update({ direction }, ["amount"])}
              />
              <Input
                label="Amount (₹)"
                isRequired
                inputMode="decimal"
                placeholder="0.00"
                value={draft.amount}
                onValueChange={(amount) => update({ amount }, ["amount"])}
                description={
                  isCorrection
                    ? `Up to ${formatPaise(Math.max(0, balance.availablePaise))}, what isn't held for a send.`
                    : "Added to the store's balance."
                }
                isInvalid={!!errors.amount}
                errorMessage={errors.amount}
              />
              <Textarea
                label="Reason"
                isRequired
                minRows={3}
                maxLength={BALANCE_REASON_MAX_CHARS}
                description="Kept in the store's ledger and the audit log."
                value={draft.reason}
                onValueChange={(reason) => update({ reason }, ["reason"])}
                isInvalid={!!errors.reason}
                errorMessage={errors.reason}
              />
              {errors.form ? <p className="text-label text-tone-danger-text">{errors.form}</p> : null}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-body text-fg">
                {confirming > 0 ? (
                  <>
                    Add <strong>{formatPaise(confirming)}</strong> to {storeName}'s message balance.
                  </>
                ) : (
                  <>
                    Remove <strong>{formatPaise(-confirming)}</strong> from {storeName}'s message balance.
                  </>
                )}
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-surface-muted px-3 py-2 text-label">
                <dt className="text-fg-muted">Balance now</dt>
                <dd className="text-right tabular-nums text-fg">{formatPaise(balance.balancePaise)}</dd>
                <dt className="text-fg-muted">Balance after</dt>
                <dd className="text-right tabular-nums font-medium text-fg">
                  {formatPaise(balanceAfter(balance.balancePaise, confirming))}
                </dd>
              </dl>
              <p className="text-label text-fg-muted">Reason: {draft.reason.trim()}</p>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          {confirming === null ? (
            <>
              <Button variant="secondary" onPress={onClose}>
                Cancel
              </Button>
              <Button variant="primary" onPress={review}>
                Review
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" isDisabled={loading} onPress={() => setConfirming(null)}>
                Back
              </Button>
              <Button
                variant={confirming > 0 ? "primary" : "danger"}
                isLoading={loading}
                onPress={() => void submit(confirming)}
              >
                {confirming > 0 ? "Grant" : "Remove"}
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── Record payment ───────────────────────────────────────────────────────

export interface TopUpDialogProps {
  topUp: MessagingTopUp;
  onClose: () => void;
}

export function RecordTopUpPaymentDialog({ topUp, onClose }: TopUpDialogProps) {
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [complete, { loading }] = useMutation(COMPLETE_MESSAGING_TOPUP, { refetchQueries: BALANCE_REFETCH });

  const submit = async () => {
    const problem = validateTopUpReference(reference);
    if (problem) {
      setError(problem);
      return;
    }
    try {
      await complete({ variables: { id: topUp.id, reference: reference.trim() } });
      toast.success(`${formatPaise(topUp.amountPaise)} credited to ${storeNameOf(topUp)}`);
      onClose();
    } catch (failure) {
      const fields = balanceFieldErrorsFromServer(failure);
      if (fields) {
        setError(fields.reference ?? fields.form ?? Object.values(fields)[0]);
        return;
      }
      fail(failure);
      if (shouldReloadBalanceAfter(failure)) onClose();
    }
  };

  return (
    <Modal isOpen onClose={onClose} size="sm">
      <ModalContent>
        <ModalHeader>
          <PopupTitle icon={<IconCheck aria-hidden />}>Record payment: {topUp.number}</PopupTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-3">
            <p className="text-body text-fg">
              {storeNameOf(topUp)} · <strong>{formatPaise(topUp.amountPaise)}</strong>
            </p>
            <p className="text-label text-fg-muted">
              Record this only once the bank transfer is in Zerror's account. The store's balance goes up by the
              full amount.
            </p>
            <Input
              label="Bank transfer reference"
              isRequired
              maxLength={TOPUP_REFERENCE_MAX_CHARS}
              placeholder="UTR or bank reference"
              value={reference}
              onValueChange={(value) => {
                setReference(value);
                setError(undefined);
              }}
              isInvalid={!!error}
              errorMessage={error}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={loading} onPress={() => void submit()}>
            Record payment
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── Withdraw ─────────────────────────────────────────────────────────────

export function WithdrawTopUpDialog({ topUp, onClose }: TopUpDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [cancel, { loading }] = useMutation(CANCEL_MESSAGING_TOPUP, { refetchQueries: BALANCE_REFETCH });

  const submit = async () => {
    const problem = validateWithdrawReason(reason);
    if (problem) {
      setError(problem);
      return;
    }
    try {
      await cancel({ variables: { id: topUp.id, reason: reason.trim() } });
      toast.success(`Top-up ${topUp.number} withdrawn`);
      onClose();
    } catch (failure) {
      const fields = balanceFieldErrorsFromServer(failure);
      if (fields) {
        setError(fields.reason ?? fields.form ?? Object.values(fields)[0]);
        return;
      }
      fail(failure);
      if (shouldReloadBalanceAfter(failure)) onClose();
    }
  };

  return (
    <Modal isOpen onClose={onClose} size="sm">
      <ModalContent>
        <ModalHeader>
          <PopupTitle icon={<IconWarning aria-hidden />}>Withdraw top-up {topUp.number}</PopupTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-3">
            <p className="text-body text-fg">
              {storeNameOf(topUp)} · {formatPaise(topUp.amountPaise)}
            </p>
            <p className="text-label text-fg-muted">The request closes without changing the store's balance.</p>
            <Textarea
              label="Reason"
              isRequired
              minRows={3}
              maxLength={BALANCE_REASON_MAX_CHARS}
              value={reason}
              onValueChange={(value) => {
                setReason(value);
                setError(undefined);
              }}
              isInvalid={!!error}
              errorMessage={error}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button variant="danger" isLoading={loading} onPress={() => void submit()}>
            Withdraw
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
