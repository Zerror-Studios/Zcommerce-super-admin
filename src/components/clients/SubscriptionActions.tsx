import { useMutation } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import type { Client, Subscription } from "../../types";
import { billingFailureCopy, isUserInputError, mutationFailureCopy } from "../../lib/mutation-errors";
import { reactivationNeedsOverride, reactivationVariables } from "../../lib/platform-billing.util";
import { errorReasonOf } from "../../lib/apollo-client";
import {
  ACTIVATE_TENANT_SUBSCRIPTION,
  CANCEL_TENANT_SUBSCRIPTION,
  EXTEND_TRIAL,
  MARK_SUBSCRIPTION_PAST_DUE,
  REACTIVATE_TENANT_SUBSCRIPTION,
  RECORD_SUBSCRIPTION_PAYMENT,
} from "../../graphql/subscriptions";
import { toasts } from "../../copy";
import { ChangePlanDialog } from "./ChangePlanDialog";
import { useStoreBillingRefresh } from "./useStoreBillingRefresh";
import {
  Button as UiButton,
  ConfirmDialog,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Switch,
  Textarea,
  toastError,
} from "../ui";

export type SubscriptionDialog = "plan" | "trial" | "cancel" | "payment" | "activate" | "pastDue" | "reactivate";

/**
 * Which subscription actions fit the subscription today (PRD-005 FR-4.3, PRD-014 SEC-04, PRD-016 FR-18), as the
 * live Subscription section offered them. Billing & plan puts them in its header (04 S-03d).
 */
export function subscriptionActionsFor(
  subscription: Subscription | undefined,
  canManageBilling: boolean,
): Record<SubscriptionDialog, boolean> {
  const status = subscription?.status;
  const stopped = status === "CANCELLED" || status === "SUSPENDED" || !!subscription?.canceledAt;
  return {
    plan: !!subscription && status !== "CANCELLED",
    trial: status === "TRIAL",
    payment: status === "ACTIVE" || status === "TRIAL" || status === "PAST_DUE",
    activate: canManageBilling && (status === "TRIAL" || status === "PAST_DUE"),
    pastDue: status === "ACTIVE",
    reactivate: stopped,
    cancel: !!status && !stopped,
  };
}

export interface SubscriptionDialogsProps {
  client: Client;
  subscription?: Subscription;
  /** The open pop-up; the page's header menu sets it. */
  dialog: SubscriptionDialog | null;
  onClose: () => void;
}

/** The live subscription pop-ups (Rohit: pop-ups are fine), opened from the Billing & plan header. */
export function SubscriptionDialogs({ client, subscription, dialog, onClose }: SubscriptionDialogsProps) {
  const refresh = useStoreBillingRefresh();
  const [busy, setBusy] = useState(false);
  // Blocks a second submit before the `busy` re-render lands (a double
  // click would otherwise send the mutation twice).
  const inFlight = useRef(false);

  const [activationReason, setActivationReason] = useState("");
  // PRD-016 FR-18: reactivation always sends override + reason.
  const [reactivateOverride, setReactivateOverride] = useState(false);
  const [reactivateReason, setReactivateReason] = useState("");
  const [days, setDays] = useState("7");
  const [immediate, setImmediate] = useState(false);
  const [amount, setAmount] = useState(String(client.mrr || ""));
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const [extendTrial] = useMutation(EXTEND_TRIAL);
  const [cancel] = useMutation(CANCEL_TENANT_SUBSCRIPTION);
  const [reactivate] = useMutation(REACTIVATE_TENANT_SUBSCRIPTION);
  const [markPastDue] = useMutation(MARK_SUBSCRIPTION_PAST_DUE);
  const [recordPayment] = useMutation(RECORD_SUBSCRIPTION_PAYMENT);
  const [activate] = useMutation(ACTIVATE_TENANT_SUBSCRIPTION);

  const status = subscription?.status;
  const tenantId = client.id;

  // Each opening starts clean (the pop-ups stay mounted with the page).
  useEffect(() => {
    setFieldError(null);
    if (dialog === "activate") setActivationReason("");
    if (dialog === "reactivate") {
      setReactivateOverride(reactivationNeedsOverride(status));
      setReactivateReason("");
    }
  }, [dialog, status]);

  const act = async (
    work: () => Promise<unknown>,
    done: string,
    failureCopy: (error: unknown) => string | null = mutationFailureCopy,
  ) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFieldError(null);
    try {
      await work();
      // These mutations return the subscription only; the tenant's derived
      // fields (payment badge, health, fee) live on the tenant, so the list
      // is re-read (review C-M7), with the page's billing reads.
      await refresh();
      addToast({ title: done });
      onClose();
    } catch (error) {
      const message = failureCopy(error);
      // A business-rule refusal (PAYMENT_REQUIRED, NOTE_REQUIRED) belongs in the dialog too.
      if (message && (isUserInputError(error) || errorReasonOf(error))) setFieldError(message);
      else if (message) toastError(message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  // Cancel, X, Escape and an outside click all close here, so a stale error doesn't reappear.
  const closeDialog = () => {
    setFieldError(null);
    onClose();
  };

  const runReactivate = () => {
    const result = reactivationVariables(reactivateOverride, reactivateReason);
    if (!result.variables) {
      setFieldError(result.error);
      return;
    }
    const variables = { tenantId, ...result.variables };
    void act(
      () => reactivate({ variables }),
      reactivateOverride ? "Subscription reactivated with an override." : "Subscription reactivated.",
      billingFailureCopy,
    );
  };

  return (
    <>
      {/* Change plan: PRD-016 preview, eligible plans only (PRD-017 FR-4.2) */}
      <ChangePlanDialog
        isOpen={dialog === "plan"}
        onClose={closeDialog}
        client={client}
        subscription={subscription}
        onChanged={refresh}
      />

      {/* Reactivate (PRD-016 FR-18): a payment, or an audited override with a reason */}
      <Modal isOpen={dialog === "reactivate"} onClose={closeDialog} width="sm">
        <ModalContent>
          <ModalHeader>Reactivate {client.storeName}'s subscription?</ModalHeader>
          <ModalBody>
            <p className="text-body text-fg-muted">
              Without an override this only undoes a scheduled cancellation while the current period is paid and no
              invoice is open. Anything else needs a payment first, or an override.
            </p>
            <Switch isSelected={reactivateOverride} onValueChange={setReactivateOverride} className="mt-3">
              Override: reactivate without a payment
            </Switch>
            <Textarea
              label="Reason"
              isRequired={reactivateOverride}
              description={
                reactivateOverride
                  ? "Required for an override. Your name and the reason go to the audit log."
                  : "Optional."
              }
              className="mt-3"
              value={reactivateReason}
              onValueChange={setReactivateReason}
              isInvalid={!!fieldError}
              errorMessage={fieldError ?? undefined}
            />
          </ModalBody>
          <ModalFooter>
            <UiButton variant="secondary" onPress={closeDialog} isDisabled={busy}>
              Cancel
            </UiButton>
            <UiButton
              variant={reactivateOverride ? "destructive" : "primary"}
              isLoading={busy}
              isDisabled={busy || (reactivateOverride && !reactivateReason.trim())}
              onPress={runReactivate}
            >
              {reactivateOverride ? "Reactivate with override" : "Reactivate"}
            </UiButton>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Extend trial */}
      <Modal isOpen={dialog === "trial"} onClose={closeDialog} width="sm">
        <ModalContent>
          <ModalHeader>Extend trial</ModalHeader>
          <ModalBody>
            <Input
              label="Days to add"
              type="number"
              min={1}
              max={90}
              value={days}
              onValueChange={setDays}
              isInvalid={!!fieldError}
              errorMessage={fieldError ?? undefined}
            />
          </ModalBody>
          <ModalFooter>
            <UiButton variant="secondary" onPress={closeDialog}>
              Cancel
            </UiButton>
            <UiButton
              variant="primary"
              isLoading={busy}
              onPress={() =>
                void act(() => extendTrial({ variables: { tenantId, days: Number(days) } }), toasts.trialExtended)
              }
            >
              Extend
            </UiButton>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Cancel */}
      <ConfirmDialog
        isOpen={dialog === "cancel"}
        onClose={closeDialog}
        onConfirm={() => void act(() => cancel({ variables: { tenantId, immediate } }), toasts.subscriptionCancelled)}
        title={`Cancel ${client.storeName}'s subscription?`}
        description="By default the subscription ends when the current period does. Immediate cancellation ends it today."
        confirmLabel="Cancel subscription"
        cancelLabel="Keep subscription"
        isLoading={busy}
      >
        <Switch isSelected={immediate} onValueChange={setImmediate} className="mt-3">
          Cancel immediately
        </Switch>
      </ConfirmDialog>

      {/* Mark past due (PRD-014 UX-39: asks first) */}
      <ConfirmDialog
        isOpen={dialog === "pastDue"}
        onClose={closeDialog}
        onConfirm={() => void act(() => markPastDue({ variables: { tenantId } }), toasts.markedPastDue)}
        title={`Mark ${client.storeName} as past due?`}
        description="The subscription moves to past due, recorded in its history as a failed payment. It becomes active again when a payment is recorded."
        confirmLabel="Mark past due"
        isLoading={busy}
      />

      {/* Activate without payment (PRD-014 SEC-04) */}
      <Modal isOpen={dialog === "activate"} onClose={closeDialog} width="sm">
        <ModalContent>
          <ModalHeader>Activate {client.storeName} without a payment?</ModalHeader>
          <ModalBody>
            <p className="text-body text-fg-muted">
              The subscription becomes active today and a new period starts, with an invoice issued for it, although
              no payment has been recorded. Use this only for an agreed exception. Your name and the reason go to the
              audit log.
            </p>
            <Textarea
              label="Reason"
              isRequired
              className="mt-3"
              value={activationReason}
              onValueChange={setActivationReason}
              isInvalid={!!fieldError}
              errorMessage={fieldError ?? undefined}
            />
          </ModalBody>
          <ModalFooter>
            <UiButton variant="secondary" onPress={closeDialog}>
              Cancel
            </UiButton>
            <UiButton
              variant="destructive"
              isLoading={busy}
              isDisabled={busy || !activationReason.trim()}
              onPress={() =>
                void act(
                  () => activate({ variables: { tenantId, override: true, reason: activationReason.trim() } }),
                  "Subscription activated without a payment.",
                )
              }
            >
              Activate without payment
            </UiButton>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Record payment */}
      <Modal isOpen={dialog === "payment"} onClose={closeDialog} width="sm">
        <ModalContent>
          <ModalHeader>Record a payment</ModalHeader>
          <ModalBody>
            <p className="text-body text-fg-muted">
              For a bank transfer or UPI payment taken outside the platform. A past-due subscription becomes active.
            </p>
            <div className="mt-3 flex flex-col gap-4">
              <Input label="Amount (₹)" type="number" min={1} value={amount} onValueChange={setAmount} />
              <Input label="Paid on" type="date" value={paidAt} onValueChange={setPaidAt} />
              <Input
                label="Reference"
                placeholder="UPI-12345"
                value={reference}
                onValueChange={setReference}
                isInvalid={!!fieldError}
                errorMessage={fieldError ?? undefined}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <UiButton variant="secondary" onPress={closeDialog}>
              Cancel
            </UiButton>
            <UiButton
              variant="primary"
              isLoading={busy}
              isDisabled={busy}
              onPress={() =>
                void act(
                  () =>
                    recordPayment({
                      variables: {
                        tenantId,
                        amount: Number(amount),
                        paidAt: new Date(`${paidAt}T12:00:00Z`).toISOString(),
                        reference,
                      },
                    }),
                  toasts.paymentRecorded,
                )
              }
            >
              Record payment
            </UiButton>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
