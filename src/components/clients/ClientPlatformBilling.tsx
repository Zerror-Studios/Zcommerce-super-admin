/**
 * Store detail › Billing: subscription billing, invoices and credits
 * (PRD-016 FR-5, FR-15, FR-16, FR-20, FR-21, FR-26; PRD-017 FR-4.2)
 *
 * The plan and its version, a scheduled change, the billing state (orders
 * paused, and the pause and suspension dates while dunning runs), the
 * credit balance, this store's invoices (with proration and restart
 * invoices, "Partially paid" and what is still owed) and its credits.
 * "Issue credit" and "Record refund" need `platform:billing:manage`;
 * "Create custom plan" needs `platform:plans:manage`. Every amount is the
 * server's.
 */

import { useMutation, useQuery } from "@apollo/client";
import { addToast, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { ISSUE_PLATFORM_CREDIT, PLATFORM_CREDITS, RECORD_PLATFORM_REFUND } from "../../graphql/billing";
import { useInvoices, usePayments } from "../../hooks/use-platform-reports";
import { scheduledPlanChangeOf } from "../../lib/api-adapters";
import { PLAN_LABELS } from "../../lib/display-labels.util";
import { billingFailureCopy, isUserInputError } from "../../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import {
  billingStateView,
  CREDIT_REASON_LABELS,
  invoiceReasonLabel,
  parseAmount,
  refundFormError,
  toInvoiceActionRow,
} from "../../lib/platform-billing.util";
import { formatDate } from "../../lib/utils";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import type { Client, Subscription } from "../../types";
import type { PlatformCredit, PlatformInvoice } from "../../types/platform-api";
import { InvoiceDetailModal, InvoiceStatusChip } from "../billing/InvoiceParts";
import { InvoiceRowActions } from "../billing/InvoiceRowActions";
import { compactTableClassNames } from "../common/dataTableStyles";
import { LoadMoreFooter } from "../common/LoadMoreFooter";
import { PlanEditorModal } from "../settings/PlanEditorModal";
import {
  Button as UiButton,
  Card,
  Chip,
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
  Skeleton,
  Textarea,
  formatMoney,
  toastError,
} from "../ui";
import { IconInvoice, IconPayments } from "../ui/icons";

export interface ClientPlatformBillingProps {
  client: Client;
  subscription?: Subscription;
}

type Dialog = "credit" | "refund" | "customPlan" | null;

const invoiceColumns = [
  { key: "number", label: "Invoice" },
  { key: "reason", label: "Type" },
  { key: "period", label: "Period" },
  { key: "total", label: "Total", end: true },
  { key: "paid", label: "Paid", end: true },
  { key: "due", label: "Still owed", end: true },
  { key: "status", label: "Status" },
  { key: "actions", label: "", end: true },
];

const creditColumns = [
  { key: "number", label: "Credit" },
  { key: "reason", label: "Why" },
  { key: "amount", label: "Amount", end: true },
  { key: "remaining", label: "Left", end: true },
  { key: "createdAt", label: "Issued" },
];

export function ClientPlatformBilling({ client, subscription }: ClientPlatformBillingProps) {
  const { can } = useAuth();
  const { plans, refetch: refetchClients } = useClients();
  const canRead = can(PLATFORM_PERMISSIONS.BILLING_READ);
  const canManage = can(PLATFORM_PERMISSIONS.BILLING_MANAGE);
  const canManagePlans = can(PLATFORM_PERMISSIONS.PLANS_MANAGE);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [openInvoice, setOpenInvoice] = useState<PlatformInvoice | null>(null);

  const invoices = useInvoices({ tenantId: client.id }, { skip: !canRead });
  const credits = useQuery<{ platformCredits: PlatformCredit[] }>(PLATFORM_CREDITS, {
    variables: { tenantId: client.id },
    skip: !canRead,
    fetchPolicy: "cache-and-network",
  });

  const state = billingStateView(subscription, formatDate);
  const scheduled = scheduledPlanChangeOf(subscription, plans);
  const money = (amount: number, currency = "INR") => formatMoney(amount, { currency, paise: true });

  const refreshAll = async () => {
    await Promise.all([
      invoices.refetch().catch(() => undefined),
      credits.refetch().catch(() => undefined),
      refetchClients().catch(() => undefined),
    ]);
  };

  const renderInvoiceCell = (invoice: PlatformInvoice, key: string) => {
    switch (key) {
      case "number":
        return (
          <button
            type="button"
            className="num font-medium text-fg underline-offset-2 hover:underline"
            onClick={() => setOpenInvoice(invoice)}
          >
            {invoice.number}
          </button>
        );
      case "reason":
        return invoiceReasonLabel(invoice);
      case "period":
        return (
          <span className="whitespace-nowrap">
            {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
          </span>
        );
      case "total":
        return <span className="num">{money(invoice.total, invoice.currency)}</span>;
      case "paid":
        return <span className="num">{money(invoice.amountPaid, invoice.currency)}</span>;
      case "due":
        return invoice.amountDue > 0 ? (
          <span className="num">{money(invoice.amountDue, invoice.currency)}</span>
        ) : (
          <span className="text-fg-subtle">—</span>
        );
      case "status":
        return <InvoiceStatusChip invoice={invoice} />;
      case "actions":
        return <InvoiceRowActions row={toInvoiceActionRow(invoice)} onChanged={refreshAll} />;
      default:
        return null;
    }
  };

  const renderCreditCell = (credit: PlatformCredit, key: string) => {
    switch (key) {
      case "number":
        return <span className="num font-medium text-fg">{credit.number}</span>;
      case "reason":
        return (
          <div className="min-w-0">
            <p className="text-fg">{CREDIT_REASON_LABELS[credit.reason] ?? credit.reason}</p>
            {credit.note ? <p className="truncate text-caption text-fg-subtle">{credit.note}</p> : null}
          </div>
        );
      case "amount":
        return <span className="num">{money(credit.amount)}</span>;
      case "remaining":
        return <span className="num">{money(credit.remaining)}</span>;
      case "createdAt":
        return <span className="whitespace-nowrap">{formatDate(credit.createdAt)}</span>;
      default:
        return null;
    }
  };

  if (!canRead) return null;

  const creditRows = credits.data?.platformCredits ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Plan and billing state"
        actions={<Chip tone={state.tone}>{state.label}</Chip>}
      >
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Item label="Plan">
            {subscription ? (
              <>
                {subscription.planDisplayName || PLAN_LABELS[subscription.plan]}
                {subscription.planVersion ? <span className="text-fg-muted"> v{subscription.planVersion}</span> : null}
                <span className="text-fg-muted">, {subscription.billingCycle === "YEARLY" ? "yearly" : "monthly"}</span>
              </>
            ) : (
              <span className="text-fg-subtle">—</span>
            )}
          </Item>
          <Item label="Scheduled change">
            {scheduled ? (
              <>
                {scheduled.plan ? (scheduled.plan.displayName || PLAN_LABELS[scheduled.plan.name]) : "Another plan"}
                {scheduled.plan?.version ? ` v${scheduled.plan.version}` : ""} on {formatDate(scheduled.effectiveAt)}
              </>
            ) : (
              <span className="text-fg-subtle">None</span>
            )}
          </Item>
          <Item label="Credit balance">
            <span className="num">{money(subscription?.creditBalance ?? 0)}</span>
          </Item>
          <Item label="Orders">{state.detail ?? "Taking orders as normal."}</Item>
        </dl>
        {canManage || canManagePlans ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {canManage ? (
              <>
                <UiButton variant="secondary" onPress={() => setDialog("credit")}>
                  Issue credit
                </UiButton>
                <UiButton variant="secondary" onPress={() => setDialog("refund")}>
                  Record refund
                </UiButton>
              </>
            ) : null}
            {canManagePlans ? (
              <UiButton variant="ghost" onPress={() => setDialog("customPlan")}>
                Create custom plan for this store
              </UiButton>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card title="Invoices" padding="none" className="overflow-hidden">
        {invoices.error && invoices.data.length === 0 ? (
          <ErrorState inline title="Couldn't load the invoices." onRetry={() => void invoices.refetch()} />
        ) : invoices.loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <Table aria-label={`Invoices for ${client.storeName}`} removeWrapper classNames={compactTableClassNames}>
            <TableHeader columns={invoiceColumns}>
              {(column) => (
                <TableColumn key={column.key} align={column.end ? "end" : "start"}>
                  {column.label}
                </TableColumn>
              )}
            </TableHeader>
            <TableBody
              items={invoices.data}
              emptyContent={
                <EmptyState icon={IconInvoice} title="No invoices yet" description="The first invoice is issued when the trial ends." />
              }
            >
              {(invoice) => (
                <TableRow key={invoice.id}>
                  {(columnKey) => <TableCell>{renderInvoiceCell(invoice, String(columnKey))}</TableCell>}
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
        <LoadMoreFooter
          shown={invoices.data.length}
          total={invoices.totalCount}
          hasMore={invoices.hasMore && !invoices.error}
          loading={invoices.loadingMore}
          onLoadMore={invoices.loadMore}
          noun="invoices"
        />
      </Card>

      <Card
        title="Credits"
        description="Credit Zerror owes this store. It is spent by the next invoices, never paid out."
        padding="none"
        className="overflow-hidden"
      >
        {credits.error && !credits.data ? (
          <ErrorState inline title="Couldn't load the credits." onRetry={() => void credits.refetch()} />
        ) : credits.loading && !credits.data ? (
          <div className="p-4">
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ) : (
          <Table aria-label={`Credits for ${client.storeName}`} removeWrapper classNames={compactTableClassNames}>
            <TableHeader columns={creditColumns}>
              {(column) => (
                <TableColumn key={column.key} align={column.end ? "end" : "start"}>
                  {column.label}
                </TableColumn>
              )}
            </TableHeader>
            <TableBody
              items={creditRows}
              emptyContent={<EmptyState icon={IconPayments} title="No credits" description="Plan changes, overpayments and credits you issue appear here." />}
            >
              {(credit) => (
                <TableRow key={credit.id}>
                  {(columnKey) => <TableCell>{renderCreditCell(credit, String(columnKey))}</TableCell>}
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <IssueCreditDialog
        isOpen={dialog === "credit"}
        client={client}
        onClose={() => setDialog(null)}
        onDone={refreshAll}
      />
      <RecordRefundDialog
        isOpen={dialog === "refund"}
        client={client}
        onClose={() => setDialog(null)}
        onDone={refreshAll}
      />
      <PlanEditorModal
        isOpen={dialog === "customPlan"}
        tenantId={client.id}
        tenantName={client.storeName}
        onClose={() => setDialog(null)}
      />
      <InvoiceDetailModal invoice={openInvoice} onClose={() => setOpenInvoice(null)} />
    </div>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-label text-fg-muted">{label}</dt>
      <dd className="mt-1 text-body text-fg">{children}</dd>
    </div>
  );
}

// ─── Issue credit (PRD-016 FR-21) ─────────────────────────────────────────

interface StoreDialogProps {
  isOpen: boolean;
  client: Client;
  onClose: () => void;
  onDone: () => Promise<unknown>;
}

function IssueCreditDialog({ isOpen, client, onClose, onDone }: StoreDialogProps) {
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
          <UiButton variant="ghost" onPress={close} isDisabled={busy}>
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

function RecordRefundDialog({ isOpen, client, onClose, onDone }: StoreDialogProps) {
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
          <UiButton variant="ghost" onPress={close} isDisabled={busy}>
            Cancel
          </UiButton>
          <UiButton variant="danger" isLoading={busy} isDisabled={busy || !payment} onPress={() => void run()}>
            Record refund
          </UiButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
