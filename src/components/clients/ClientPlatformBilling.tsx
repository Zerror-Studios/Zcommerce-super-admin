/**
 * Store detail › Billing & plan (04 S-03d; PRD-016 FR-5, FR-15, FR-16, FR-21, FR-26; PRD-017 FR-4.2)
 *
 * - Plan and subscription: three stat tiles (price a month, paid to date, customer since), the plan and its
 *   version, billing cycle, renewal, a scheduled change, the credit balance and the billing state (orders paused,
 *   and the pause and suspension dates while dunning runs). "Create custom plan" needs `platform:plans:manage`.
 * - Credits: what Zerror owes the store, spent by its next invoices.
 * - The Issue credit and Record refund pop-ups (`platform:billing:manage`), opened from the page header.
 * Every amount is the server's.
 */

import { useMutation, useQuery } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useMemo, useRef, useState } from "react";
import { ISSUE_PLATFORM_CREDIT, PLATFORM_CREDITS, RECORD_PLATFORM_REFUND } from "../../graphql/billing";
import { usePayments } from "../../hooks/use-platform-reports";
import { scheduledPlanChangeOf } from "../../lib/api-adapters";
import { PLAN_LABELS } from "../../lib/display-labels.util";
import { billingFailureCopy, isUserInputError } from "../../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { billingStateView, CREDIT_REASON_LABELS, parseAmount, refundFormError } from "../../lib/platform-billing.util";
import { formatDate } from "../../lib/utils";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import type { Client, Subscription } from "../../types";
import type { PlatformCredit } from "../../types/platform-api";
import { TableCardHeader } from "../settings/TableCardHeader";
import {
  Button as UiButton,
  Card,
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
  formatMoney,
  toastError,
  type DataTableColumn,
} from "../ui";
import { IconPayments } from "../ui/icons";
import { KeyValue, KeyValueGrid, StatTile } from "./StoreDetailParts";

const MONTH_YEAR = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" });

// ─── Plan and subscription ───────────────────────────────────────────────────

export interface PlanSubscriptionCardProps {
  client: Client;
  subscription?: Subscription;
  /** Opens the live Create custom plan pop-up (shown with `platform:plans:manage`). */
  onCreateCustomPlan?: () => void;
}

export function PlanSubscriptionCard({ client, subscription, onCreateCustomPlan }: PlanSubscriptionCardProps) {
  const { can } = useAuth();
  const { plans } = useClients();
  const canManagePlans = can(PLATFORM_PERMISSIONS.PLANS_MANAGE);
  const canReadBilling = can(PLATFORM_PERMISSIONS.BILLING_READ);
  // Paid to date: the store's successful payments (a refunded payment is no longer SUCCESS).
  const paid = usePayments({ tenantId: client.id, statuses: ["success"], skip: !canReadBilling });
  const paidToDate = useMemo(() => paid.data.reduce((sum, payment) => sum + payment.amount, 0), [paid.data]);
  const state = billingStateView(subscription, formatDate);
  const scheduled = scheduledPlanChangeOf(subscription, plans);
  const planName = subscription ? subscription.planDisplayName || PLAN_LABELS[subscription.plan] : null;

  return (
    <Card title="Plan and subscription" actions={<Chip tone={state.tone}>{state.label}</Chip>}>
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile label="Price / month" value={formatMoney(subscription?.mrr ?? client.mrr, { whole: true })} />
          <StatTile
            label="Paid to date"
            isLoading={canReadBilling && paid.loading}
            value={canReadBilling ? `${formatMoney(paidToDate, { whole: true })}${paid.hasMore ? "+" : ""}` : "—"}
          />
          <StatTile label="Customer since" value={client.joinedDate ? MONTH_YEAR.format(new Date(client.joinedDate)) : "—"} />
        </div>

        <KeyValueGrid columns={3}>
          <KeyValue label="Plan">
            {planName ? (
              <>
                {planName}
                {subscription?.planVersion ? <span className="text-fg-muted"> v{subscription.planVersion}</span> : null}
              </>
            ) : null}
          </KeyValue>
          <KeyValue label="Billing cycle">
            {subscription ? (subscription.billingCycle === "YEARLY" ? "Yearly" : "Monthly") : null}
          </KeyValue>
          <KeyValue label="Renews">{subscription?.renewalDate ? formatDate(subscription.renewalDate) : null}</KeyValue>
          <KeyValue label="Scheduled change">
            {scheduled ? (
              <>
                {scheduled.plan ? scheduled.plan.displayName || PLAN_LABELS[scheduled.plan.name] : "Another plan"}
                {scheduled.plan?.version ? ` v${scheduled.plan.version}` : ""} on {formatDate(scheduled.effectiveAt)}
              </>
            ) : (
              "None"
            )}
          </KeyValue>
          <KeyValue label="Credit balance">
            <span className="num">{formatMoney(subscription?.creditBalance ?? 0)}</span>
          </KeyValue>
          <KeyValue label="Orders">{state.detail ?? "Taking orders as normal."}</KeyValue>
        </KeyValueGrid>

        {canManagePlans && onCreateCustomPlan ? (
          <div className="flex justify-end">
            <UiButton variant="secondary" size="sm" onPress={onCreateCustomPlan}>
              Create custom plan
            </UiButton>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

// ─── Credits ─────────────────────────────────────────────────────────────────

/** Fixed 310 → Credit and Why 207px each at 724px (04 S-03d). */
const creditColumns: DataTableColumn[] = [
  { key: "number", label: "Credit", mobile: "primary" },
  { key: "reason", label: "Why" },
  { key: "amount", label: "Amount", width: 100 },
  { key: "remaining", label: "Left", width: 100 },
  { key: "createdAt", label: "Issued", width: 110 },
];

export function StoreCreditsCard({ client }: { client: Client }) {
  const { can } = useAuth();
  const canRead = can(PLATFORM_PERMISSIONS.BILLING_READ);
  const credits = useQuery<{ platformCredits: PlatformCredit[] }>(PLATFORM_CREDITS, {
    variables: { tenantId: client.id },
    skip: !canRead,
    fetchPolicy: "cache-and-network",
  });
  if (!canRead) return null;
  const header = (
    <TableCardHeader title="Credits" description="Credit Zerror owes this store. It is spent by the next invoices, never paid out." />
  );

  if (credits.error && !credits.data) {
    return (
      <Card padding="none" className="overflow-clip">
        {header}
        <ErrorState inline title="Couldn't load the credits." onRetry={() => void credits.refetch()} />
      </Card>
    );
  }

  return (
    <DataTable
      aria-label={`Credits for ${client.storeName}`}
      columns={creditColumns}
      rows={credits.data?.platformCredits ?? []}
      getRowKey={(credit) => credit.id}
      isLoading={credits.loading && !credits.data}
      rowHeight="tall"
      toolbar={header}
      renderCell={(credit, key) => {
        switch (key) {
          case "number":
            return <span className="font-mono text-label text-fg">{credit.number}</span>;
          case "reason":
            return (
              <span className="block min-w-0">
                <span className="block truncate text-fg">{CREDIT_REASON_LABELS[credit.reason] ?? credit.reason}</span>
                {credit.note ? <span className="block truncate text-label text-fg-muted">{credit.note}</span> : null}
              </span>
            );
          case "amount":
            return <span className="num">{formatMoney(credit.amount)}</span>;
          case "remaining":
            return <span className="num">{formatMoney(credit.remaining)}</span>;
          case "createdAt":
            return <span className="num">{formatDate(credit.createdAt)}</span>;
          default:
            return null;
        }
      }}
      emptyContent={
        <EmptyState icon={IconPayments} title="No credits" description="Plan changes, overpayments and credits you issue appear here." />
      }
    />
  );
}

// ─── Issue credit (PRD-016 FR-21) ─────────────────────────────────────────

export interface StoreDialogProps {
  isOpen: boolean;
  client: Client;
  onClose: () => void;
  onDone: () => Promise<unknown>;
}

export function IssueCreditDialog({ isOpen, client, onClose, onDone }: StoreDialogProps) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [issueCredit] = useMutation(ISSUE_PLATFORM_CREDIT);

  const close = () => {
    setAmount("");
    setReason("");
    setError(null);
    onClose();
  };

  const run = async () => {
    const value = parseAmount(amount);
    if (value === null) {
      setError("Enter an amount above 0 (two decimals at most).");
      return;
    }
    if (!reason.trim()) {
      setError("Give a reason; it goes to the audit log.");
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await issueCredit({ variables: { tenantId: client.id, amount: value, reason: reason.trim() } });
      await onDone();
      addToast({ title: `Credit of ${formatMoney(value, { paise: true })} issued to ${client.storeName}.` });
      close();
    } catch (err) {
      const message = billingFailureCopy(err);
      if (message && isUserInputError(err)) setError(message);
      else if (message) toastError(message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} width="sm">
      <ModalContent>
        <ModalHeader>Issue credit to {client.storeName}?</ModalHeader>
        <ModalBody>
          <p className="text-body text-fg-muted">
            The credit reduces the store's next invoices. It is never paid out. Your name and the reason go to the
            audit log.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <Input label="Amount (₹)" type="number" min={0.01} step={0.01} value={amount} onValueChange={setAmount} />
            <Textarea
              label="Reason"
              isRequired
              value={reason}
              onValueChange={setReason}
              isInvalid={!!error}
              errorMessage={error ?? undefined}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <UiButton variant="secondary" onPress={close} isDisabled={busy}>
            Cancel
          </UiButton>
          <UiButton variant="primary" isLoading={busy} isDisabled={busy} onPress={() => void run()}>
            Issue credit
          </UiButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── Record refund (PRD-016 FR-21) ────────────────────────────────────────

export function RecordRefundDialog({ isOpen, client, onClose, onDone }: StoreDialogProps) {
  const payments = usePayments({ tenantId: client.id });
  const refundable = useMemo(
    () => payments.data.filter((payment) => payment.status === "success"),
    [payments.data],
  );
  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [recordRefund] = useMutation(RECORD_PLATFORM_REFUND);
  const payment = refundable.find((row) => row.id === paymentId);

  const close = () => {
    setPaymentId("");
    setAmount("");
    setReference("");
    setReason("");
    setError(null);
    onClose();
  };

  const run = async () => {
    if (!payment) {
      setError("Pick the payment you refunded.");
      return;
    }
    const formError = refundFormError({ amount, paymentAmount: payment.amount, reference, reason });
    if (formError) {
      setError(formError);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await recordRefund({
        variables: { paymentId: payment.id, amount: parseAmount(amount), reference: reference.trim(), reason: reason.trim() },
      });
      await Promise.all([onDone(), payments.refetch().catch(() => undefined)]);
      addToast({ title: "Refund recorded." });
      close();
    } catch (err) {
      const message = billingFailureCopy(err);
      if (message && isUserInputError(err)) setError(message);
      else if (message) toastError(message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} width="sm">
      <ModalContent>
        <ModalHeader>Record a refund for {client.storeName}</ModalHeader>
        <ModalBody>
          <p className="text-body text-fg-muted">
            For money you already returned outside the platform (bank transfer, UPI). Nothing is sent to a payment
            provider. A full refund marks the invoice refunded; the subscription doesn't change.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <Select
              label="Payment"
              selectedKeys={paymentId ? new Set([paymentId]) : new Set()}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0];
                if (typeof value === "string") {
                  setPaymentId(value);
                  const picked = refundable.find((row) => row.id === value);
                  if (picked) setAmount(String(picked.amount));
                }
              }}
              isLoading={payments.loading}
              description={refundable.length === 0 && !payments.loading ? "No successful payments to refund." : undefined}
            >
              {refundable.map((row) => (
                <SelectItem key={row.id}>
                  {`${formatDate(row.date)} · ${formatMoney(row.amount, { currency: row.currency, paise: true })}${row.transactionId ? ` · ${row.transactionId}` : ""}`}
                </SelectItem>
              ))}
            </Select>
            <Input label="Refunded amount (₹)" type="number" min={0.01} step={0.01} value={amount} onValueChange={setAmount} />
            <Input label="Refund reference" placeholder="Bank UTR or UPI ref" value={reference} onValueChange={setReference} />
            <Textarea
              label="Reason"
              isRequired
              value={reason}
              onValueChange={setReason}
              isInvalid={!!error}
              errorMessage={error ?? undefined}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <UiButton variant="secondary" onPress={close} isDisabled={busy}>
            Cancel
          </UiButton>
          <UiButton variant="destructive" isLoading={busy} isDisabled={busy || !payment} onPress={() => void run()}>
            Record refund
          </UiButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
