/**
 * Billing › Flagged payments: the review queue (PRD-016 FR-19, FR-26)
 *
 * Payments the platform received but couldn't settle on its own: the amount
 * didn't match the invoice (`AMOUNT_MISMATCH`), the subscription was
 * stopped when it arrived (`SUBSCRIPTION_NOT_PAYABLE`) or the invoice was
 * already closed (`INVOICE_NOT_OPEN`). Staff apply it to an open invoice,
 * mark it refunded outside the platform, or dismiss it, always with a
 * note (`resolveFlaggedPlatformPayment`, `platform:billing:manage`,
 * audited). A payment someone else resolved first reloads the list.
 */

import { useMutation } from "@apollo/client";
import { addToast, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { RESOLVE_FLAGGED_PLATFORM_PAYMENT } from "../../graphql/billing";
import { useFlaggedPayments, useInvoices } from "../../hooks/use-platform-reports";
import { errorReasonOf } from "../../lib/apollo-client";
import { getPaymentGatewayLabel, getPlanLabel } from "../../lib/display-labels.util";
import { billingFailureCopy } from "../../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import {
  FLAGGED_ACTION_COPY,
  FLAGGED_REASON_LABELS,
  invoiceStatusView,
  openInvoicesForApply,
  resolveFlaggedVariables,
} from "../../lib/platform-billing.util";
import { useAuth } from "../../providers/AuthProvider";
import { flaggedPaymentActionEnum, type FlaggedPaymentAction, type PlatformPayment } from "../../types/platform-api";
import { dataTableFillClassNames, tablePanelFillClassName } from "../common/dataTableStyles";
import { LoadMoreFooter } from "../common/LoadMoreFooter";
import {
  Button as UiButton,
  Chip,
  EmptyState,
  ErrorState,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Skeleton,
  Textarea,
  formatDate,
  formatDateTime,
  formatMoney,
  tableRowClasses,
  toastError,
} from "../ui";
import { IconFlag } from "../ui/icons";

const columns = [
  { key: "date", label: "Received" },
  { key: "store", label: "Store" },
  { key: "amount", label: "Paid", end: true },
  { key: "expected", label: "Expected", end: true },
  { key: "reason", label: "Why it's here" },
  { key: "gateway", label: "Gateway" },
  { key: "actions", label: "", end: true },
];

const ACTIONS = Object.values(flaggedPaymentActionEnum);

export function FlaggedPaymentsTab() {
  const { can } = useAuth();
  const canResolve = can(PLATFORM_PERMISSIONS.BILLING_MANAGE);
  const queue = useFlaggedPayments();
  const [resolving, setResolving] = useState<PlatformPayment | null>(null);

  const renderCell = (payment: PlatformPayment, key: string) => {
    const money = (amount: number) => formatMoney(amount, { currency: payment.currency, paise: true });
    switch (key) {
      case "date":
        return <span className="whitespace-nowrap num">{payment.createdAt ? formatDateTime(payment.createdAt) : "—"}</span>;
      case "store":
        return (
          <div className="min-w-0">
            <p className="truncate font-medium text-fg">{payment.tenantName}</p>
            <p className="truncate text-caption text-fg-subtle">
              {payment.planName ? getPlanLabel(payment.planName) : "—"}
              {payment.transactionId ? ` · ${payment.transactionId}` : ""}
            </p>
          </div>
        );
      case "amount":
        return <span className="num">{money(payment.amount)}</span>;
      case "expected":
        return payment.expectedAmount != null ? (
          <span className="num">{money(payment.expectedAmount)}</span>
        ) : (
          <span className="text-fg-subtle">—</span>
        );
      case "reason":
        return (
          <Chip tone="warning">
            {FLAGGED_REASON_LABELS[payment.failureReason ?? ""] ?? payment.failureReason ?? "Needs review"}
          </Chip>
        );
      case "gateway":
        return getPaymentGatewayLabel(payment.provider);
      case "actions":
        return canResolve ? (
          <UiButton size="sm" variant="secondary" onPress={() => setResolving(payment)}>
            Review
          </UiButton>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className={tablePanelFillClassName}>
      {queue.error && queue.data.length === 0 ? (
        <ErrorState title="Couldn't load flagged payments." onRetry={() => void queue.refetch()} />
      ) : (
        <Table aria-label="Flagged payments" classNames={{ ...dataTableFillClassNames, tr: tableRowClasses }}>
          <TableHeader columns={columns}>
            {(column) => (
              <TableColumn key={column.key} align={column.end ? "end" : "start"}>
                {column.label}
              </TableColumn>
            )}
          </TableHeader>
          <TableBody
            isLoading={queue.loading}
            loadingContent={<Skeleton className="h-10 w-full rounded-lg" />}
            items={queue.data}
            emptyContent={
              <EmptyState
                icon={IconFlag}
                title="Nothing to review"
                description="Payments that don't match their invoice, or arrive after a subscription stopped, wait here."
              />
            }
          >
            {(payment) => (
              <TableRow key={payment.id}>
                {(columnKey) => <TableCell>{renderCell(payment, String(columnKey))}</TableCell>}
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
      <LoadMoreFooter
        shown={queue.data.length}
        total={queue.totalCount}
        hasMore={queue.hasMore && !queue.error}
        loading={queue.loadingMore}
        onLoadMore={queue.loadMore}
        noun="payments"
      />
      <ResolveFlaggedDialog payment={resolving} onClose={() => setResolving(null)} onResolved={queue.refetch} />
    </div>
  );
}

// ─── Resolve ──────────────────────────────────────────────────────────────

interface ResolveFlaggedDialogProps {
  payment: PlatformPayment | null;
  onClose: () => void;
  onResolved: () => Promise<unknown>;
}

function ResolveFlaggedDialog({ payment, onClose, onResolved }: ResolveFlaggedDialogProps) {
  const [action, setAction] = useState<FlaggedPaymentAction>("APPLY");
  const [invoiceId, setInvoiceId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [resolve] = useMutation(RESOLVE_FLAGGED_PLATFORM_PAYMENT);
  const invoices = useInvoices(
    payment ? { tenantId: payment.tenantId, status: ["ISSUED", "OVERDUE"] } : null,
    { skip: !payment },
  );
  const openInvoices = useMemo(
    () => (payment ? openInvoicesForApply(invoices.data, payment.tenantId) : []),
    [invoices.data, payment],
  );

  useEffect(() => {
    setAction("APPLY");
    setNote("");
    setError(null);
    setInvoiceId("");
  }, [payment?.id]);

  // Default to the invoice the payment was flagged against, if it's still open.
  useEffect(() => {
    if (!payment || invoiceId) return;
    const flagged = openInvoices.find((invoice) => invoice.id === payment.invoiceId);
    const first = flagged ?? openInvoices[0];
    if (first) setInvoiceId(first.id);
  }, [invoiceId, openInvoices, payment]);

  if (!payment) return null;
  const chosen = openInvoices.find((invoice) => invoice.id === invoiceId);
  const money = (amount: number) => formatMoney(amount, { currency: payment.currency, paise: true });

  const run = async () => {
    if (action === "APPLY" && !invoiceId) {
      setError("Pick the open invoice this payment settles.");
      return;
    }
    const result = resolveFlaggedVariables({ paymentId: payment.id, action, invoiceId: invoiceId || null, note });
    if (!result.variables) {
      setError(result.error);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await resolve({ variables: result.variables });
      await onResolved().catch(() => undefined);
      addToast({ title: `Payment from ${payment.tenantName}: ${FLAGGED_ACTION_COPY[action].label.toLowerCase()}.` });
      onClose();
    } catch (err) {
      const message = billingFailureCopy(err);
      if (errorReasonOf(err) === "PAYMENT_ALREADY_RESOLVED") {
        // Someone else got there first: reload, then say so.
        await onResolved().catch(() => undefined);
        if (message) toastError(message);
        onClose();
      } else if (message) {
        setError(message);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} width="md">
      <ModalContent>
        <ModalHeader>Review a payment from {payment.tenantName}</ModalHeader>
        <ModalBody>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-body">
            <dt className="text-fg-muted">Paid</dt>
            <dd className="num text-fg">{money(payment.amount)}</dd>
            <dt className="text-fg-muted">Invoice expected</dt>
            <dd className="num text-fg">{payment.expectedAmount != null ? money(payment.expectedAmount) : "—"}</dd>
            <dt className="text-fg-muted">Why it's here</dt>
            <dd className="text-fg">
              {FLAGGED_REASON_LABELS[payment.failureReason ?? ""] ?? payment.failureReason ?? "Needs review"}
            </dd>
            <dt className="text-fg-muted">Reference</dt>
            <dd className="text-fg">{payment.transactionId ?? "—"}</dd>
          </dl>

          <div className="mt-4 flex flex-col gap-3">
            <Select
              label="What to do"
              selectedKeys={new Set([action])}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0];
                if (typeof value === "string" && (ACTIONS as string[]).includes(value)) {
                  setAction(value as FlaggedPaymentAction);
                  setError(null);
                }
              }}
              disallowEmptySelection
            >
              {ACTIONS.map((key) => (
                <SelectItem key={key} description={FLAGGED_ACTION_COPY[key].description}>
                  {FLAGGED_ACTION_COPY[key].label}
                </SelectItem>
              ))}
            </Select>

            {action === "APPLY" ? (
              invoices.loading ? (
                <Skeleton className="h-10 w-full rounded-lg" />
              ) : openInvoices.length === 0 ? (
                <p className="text-body text-fg-muted">
                  {payment.tenantName} has no open invoice. Refund it outside the platform or dismiss it.
                </p>
              ) : (
                <Select
                  label="Open invoice"
                  selectedKeys={invoiceId ? new Set([invoiceId]) : new Set()}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0];
                    if (typeof value === "string") setInvoiceId(value);
                  }}
                  description={
                    chosen
                      ? `Still owed ${money(chosen.amountDue)} (${invoiceStatusView(chosen).label.toLowerCase()}, due ${formatDate(chosen.dueAt)}). The server decides: enough pays it, more becomes credit, less leaves it partly paid.`
                      : undefined
                  }
                >
                  {openInvoices.map((invoice) => (
                    <SelectItem key={invoice.id}>
                      {`${invoice.number} · ${money(invoice.amountDue)} owed`}
                    </SelectItem>
                  ))}
                </Select>
              )
            ) : (
              <p className="text-body text-fg-muted">{FLAGGED_ACTION_COPY[action].description}</p>
            )}

            <Textarea
              label="Note"
              isRequired
              description="Required. It goes to the audit log with your name."
              value={note}
              onValueChange={setNote}
              isInvalid={!!error}
              errorMessage={error ?? undefined}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <UiButton variant="ghost" onPress={onClose} isDisabled={busy}>
            Cancel
          </UiButton>
          <UiButton
            variant={action === "APPLY" ? "primary" : "danger"}
            isLoading={busy}
            isDisabled={busy || !note.trim() || (action === "APPLY" && openInvoices.length === 0)}
            onPress={() => void run()}
          >
            {FLAGGED_ACTION_COPY[action].confirm}
          </UiButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
