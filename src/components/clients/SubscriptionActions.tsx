import { useMutation } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useRef, useState } from "react";
import type { Client, Plan, Subscription } from "../../types";
import { scheduledPlanChangeOf } from "../../lib/api-adapters";
import { PLAN_LABELS } from "../../lib/display-labels.util";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { formatDate } from "../../lib/utils";
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
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import { toasts } from "../../copy";
import { ChangePlanDialog } from "./ChangePlanDialog";
import {
  Button as UiButton,
  Card,
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

export interface SubscriptionActionsProps {
  client: Client;
  subscription?: Subscription;
  plans: Plan[];
}

type Dialog = "plan" | "trial" | "cancel" | "payment" | "activate" | "pastDue" | "reactivate" | null;

// ─── Constants ────────────────────────────────────────────────────────────

const CYCLE_LABELS = { MONTHLY: "monthly", YEARLY: "yearly" } as const;

/** Store detail › Subscription (PRD-005 FR-4.3): the console's subscription actions. */
export function SubscriptionActions({ client, subscription, plans }: SubscriptionActionsProps) {
  const { refetch } = useClients();
  const { can } = useAuth();
  const canManageBilling = can(PLATFORM_PERMISSIONS.BILLING_MANAGE);
  const [dialog, setDialog] = useState<Dialog>(null);
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
  const scheduled = scheduledPlanChangeOf(subscription, plans);

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
      // is re-read (review C-M7).
      await refetch();
      addToast({ title: done });
      setDialog(null);
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
    setDialog(null);
    setFieldError(null);
  };

  const openReactivate = () => {
    setReactivateOverride(reactivationNeedsOverride(status));
    setReactivateReason("");
    setFieldError(null);
    setDialog("reactivate");
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
      <Card title="Subscription actions" description="Every change is recorded in the audit log and the subscription history.">
        {scheduled ? (
          <p className="mb-3 text-body text-fg-muted">
            Scheduled change: moves to{" "}
            <span className="font-medium text-fg">
              {scheduled.plan ? PLAN_LABELS[scheduled.plan.name] : "another plan"}
              {scheduled.billingCycle ? `, billed ${CYCLE_LABELS[scheduled.billingCycle]}` : ""}
            </span>{" "}
            on {formatDate(scheduled.effectiveAt)}, the next renewal.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <UiButton
            variant="secondary"
            onPress={() => setDialog("plan")}
            isDisabled={!subscription || status === "CANCELLED"}
          >
            Change plan
          </UiButton>
          {status === "TRIAL" ? (
            <UiButton variant="secondary" onPress={() => setDialog("trial")}>
              Extend trial
            </UiButton>
          ) : null}
          {status === "ACTIVE" || status === "TRIAL" || status === "PAST_DUE" ? (
            <UiButton variant="secondary" onPress={() => setDialog("payment")}>
              Record payment
            </UiButton>
          ) : null}
          {canManageBilling && (status === "TRIAL" || status === "PAST_DUE") ? (
            <UiButton
              variant="secondary"
              onPress={() => {
                setActivationReason("");
                setFieldError(null);
                setDialog("activate");
              }}
            >
              Activate without payment
            </UiButton>
          ) : null}
          {status === "ACTIVE" ? (
            <UiButton variant="secondary" onPress={() => setDialog("pastDue")}>
              Mark past due
            </UiButton>
          ) : null}
          {status === "CANCELLED" || status === "SUSPENDED" || subscription?.canceledAt ? (
            <UiButton variant="primary" onPress={openReactivate}>
              Reactivate subscription
            </UiButton>
          ) : null}
          {status && status !== "CANCELLED" && status !== "SUSPENDED" && !subscription?.canceledAt ? (
            <UiButton variant="destructive" onPress={() => setDialog("cancel")}>
              Cancel subscription
            </UiButton>
          ) : null}
        </div>
      </Card>

      {/* Change plan: PRD-016 preview, eligible plans only (PRD-017 FR-4.2) */}
      <ChangePlanDialog
        isOpen={dialog === "plan"}
        onClose={closeDialog}
        client={client}
        subscription={subscription}
        onChanged={refetch}
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
            <UiButton variant="ghost" onPress={closeDialog} isDisabled={busy}>
              Cancel
            </UiButton>
            <UiButton
              variant={reactivateOverride ? "danger" : "primary"}
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
            <UiButton variant="ghost" onPress={closeDialog}>
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
            <UiButton variant="ghost" onPress={closeDialog}>
              Cancel
            </UiButton>
            <UiButton
              variant="danger"
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
            <UiButton variant="ghost" onPress={closeDialog}>
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
