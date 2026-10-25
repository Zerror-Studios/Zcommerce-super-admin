import { useMutation } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useRef, useState } from "react";
import type { Client, Plan, Subscription } from "../../types";
import type { PlanChangeEffective, PlatformBillingCycle } from "../../types/platform-api";
import { scheduledPlanChangeOf } from "../../lib/api-adapters";
import { PLAN_LABELS } from "../../lib/display-labels.util";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { formatDate } from "../../lib/utils";
import { MUTATION_REASON_COPY, isUserInputError, mutationFailureCopy } from "../../lib/mutation-errors";
import {
  ACTIVATE_TENANT_SUBSCRIPTION,
  CANCEL_TENANT_SUBSCRIPTION,
  CHANGE_TENANT_PLAN,
  EXTEND_TRIAL,
  MARK_SUBSCRIPTION_PAST_DUE,
  REACTIVATE_TENANT_SUBSCRIPTION,
  RECORD_SUBSCRIPTION_PAYMENT,
} from "../../graphql/subscriptions";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import {
  Button as UiButton,
  Card,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Switch,
  Textarea,
  toastError,
} from "../ui";

export interface SubscriptionActionsProps {
  client: Client;
  subscription?: Subscription;
  plans: Plan[];
}

type Dialog = "plan" | "trial" | "cancel" | "payment" | "activate" | null;

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

  const [planId, setPlanId] = useState("");
  const [cycle, setCycle] = useState<PlatformBillingCycle>("MONTHLY");
  // PRD-014 D6: no proration yet, so outside a trial a change waits for the
  // end of the period (the backend refuses NOW with PRORATION_NOT_AVAILABLE).
  const [effective, setEffective] = useState<PlanChangeEffective>("PERIOD_END");
  const [activationReason, setActivationReason] = useState("");
  const [days, setDays] = useState("7");
  const [immediate, setImmediate] = useState(false);
  const [amount, setAmount] = useState(String(client.mrr || ""));
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const [changePlan] = useMutation(CHANGE_TENANT_PLAN);
  const [extendTrial] = useMutation(EXTEND_TRIAL);
  const [cancel] = useMutation(CANCEL_TENANT_SUBSCRIPTION);
  const [reactivate] = useMutation(REACTIVATE_TENANT_SUBSCRIPTION);
  const [markPastDue] = useMutation(MARK_SUBSCRIPTION_PAST_DUE);
  const [recordPayment] = useMutation(RECORD_SUBSCRIPTION_PAYMENT);
  const [activate] = useMutation(ACTIVATE_TENANT_SUBSCRIPTION);

  const status = subscription?.status;
  const tenantId = client.id;
  const isTrial = status === "TRIAL";
  const scheduled = scheduledPlanChangeOf(subscription, plans);

  const act = async (work: () => Promise<unknown>, done: string) => {
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
      const message = mutationFailureCopy(error);
      if (message && isUserInputError(error)) setFieldError(message);
      else if (message) toastError(message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const openPlanDialog = () => {
    const current = plans.find((plan) => plan.name === (subscription?.plan ?? client.plan));
    setPlanId(current?.id ?? plans[0]?.id ?? "");
    setCycle(subscription?.billingCycle ?? "MONTHLY");
    setEffective("PERIOD_END");
    setFieldError(null);
    setDialog("plan");
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
          <UiButton variant="secondary" onPress={openPlanDialog} isDisabled={!subscription || status === "CANCELLED"}>
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
            <UiButton
              variant="secondary"
              isLoading={busy}
              onPress={() => void act(() => markPastDue({ variables: { tenantId } }), "Marked past due.")}
            >
              Mark past due
            </UiButton>
          ) : null}
          {status === "CANCELLED" || status === "SUSPENDED" || subscription?.canceledAt ? (
            <UiButton
              variant="primary"
              isLoading={busy}
              onPress={() => void act(() => reactivate({ variables: { tenantId } }), "Subscription reactivated.")}
            >
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

      {/* Change plan */}
      <Modal isOpen={dialog === "plan"} onClose={() => setDialog(null)} width="sm">
        <ModalContent>
          <ModalHeader>Change plan</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Select
                label="Plan"
                selectedKeys={planId ? new Set([planId]) : new Set()}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0];
                  if (typeof value === "string") setPlanId(value);
                }}
                disallowEmptySelection
                isInvalid={!!fieldError}
                errorMessage={fieldError ?? undefined}
              >
                {plans.map((plan) => (
                  <SelectItem key={plan.id}>{PLAN_LABELS[plan.name]}</SelectItem>
                ))}
              </Select>
              <Select
                label="Billing cycle"
                selectedKeys={new Set([cycle])}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0];
                  if (value === "MONTHLY" || value === "YEARLY") setCycle(value);
                }}
                disallowEmptySelection
              >
                <SelectItem key="MONTHLY">Monthly</SelectItem>
                <SelectItem key="YEARLY">Yearly</SelectItem>
              </Select>
              <div className="flex flex-col gap-1">
                <Switch
                  isSelected={isTrial && effective === "NOW"}
                  isDisabled={!isTrial}
                  onValueChange={(on) => setEffective(on ? "NOW" : "PERIOD_END")}
                >
                  Apply now
                </Switch>
                <p className="text-caption text-fg-muted">
                  {isTrial
                    ? "A trial changes plan straight away, with or without this switch."
                    : `${MUTATION_REASON_COPY.PRORATION_NOT_AVAILABLE} The new plan starts at the next renewal${
                        subscription?.renewalDate ? ` (${formatDate(subscription.renewalDate)})` : ""
                      }.`}
                </p>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <UiButton variant="ghost" onPress={() => setDialog(null)}>
              Cancel
            </UiButton>
            <UiButton
              variant="primary"
              isLoading={busy}
              onPress={() =>
                void act(
                  () =>
                    changePlan({
                      variables: { tenantId, planId, billingCycle: cycle, effective: isTrial ? effective : "PERIOD_END" },
                    }),
                  isTrial ? "Plan changed." : "Plan change scheduled for the end of the period.",
                )
              }
            >
              {isTrial ? "Change plan" : "Schedule change"}
            </UiButton>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Extend trial */}
      <Modal isOpen={dialog === "trial"} onClose={() => setDialog(null)} width="sm">
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
            <UiButton variant="ghost" onPress={() => setDialog(null)}>
              Cancel
            </UiButton>
            <UiButton
              variant="primary"
              isLoading={busy}
              onPress={() =>
                void act(() => extendTrial({ variables: { tenantId, days: Number(days) } }), "Trial extended.")
              }
            >
              Extend
            </UiButton>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Cancel */}
      <Modal isOpen={dialog === "cancel"} onClose={() => setDialog(null)} width="sm">
        <ModalContent>
          <ModalHeader>Cancel {client.storeName}'s subscription?</ModalHeader>
          <ModalBody>
            <p className="text-body text-fg-muted">
              By default the subscription ends when the current period does. Immediate cancellation ends it today.
            </p>
            <Switch isSelected={immediate} onValueChange={setImmediate} className="mt-3">
              Cancel immediately
            </Switch>
          </ModalBody>
          <ModalFooter>
            <UiButton variant="ghost" onPress={() => setDialog(null)}>
              Keep subscription
            </UiButton>
            <UiButton
              variant="danger"
              isLoading={busy}
              onPress={() => void act(() => cancel({ variables: { tenantId, immediate } }), "Subscription cancelled.")}
            >
              Cancel subscription
            </UiButton>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Activate without payment (PRD-014 SEC-04) */}
      <Modal isOpen={dialog === "activate"} onClose={() => setDialog(null)} width="sm">
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
            <UiButton variant="ghost" onPress={() => setDialog(null)}>
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
      <Modal isOpen={dialog === "payment"} onClose={() => setDialog(null)} width="sm">
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
            <UiButton variant="ghost" onPress={() => setDialog(null)}>
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
                  "Payment recorded.",
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
