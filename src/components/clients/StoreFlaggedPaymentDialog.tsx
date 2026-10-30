/**
 * Resolve one flagged payment from Billing & plan (PRD-016 FR-19, 04 S-03d): "Apply to invoice", "Mark refunded"
 * or "Dismiss", each asking for a note in an sm pop-up as live (`resolveFlaggedPlatformPayment`,
 * `platform:billing:manage`, audited). Apply also picks the open invoice. A payment someone else resolved first
 * re-reads the page and says so.
 */
import { useMutation } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { RESOLVE_FLAGGED_PLATFORM_PAYMENT } from "../../graphql/billing";
import { useInvoices } from "../../hooks/use-platform-reports";
import { errorReasonOf } from "../../lib/apollo-client";
import { billingFailureCopy } from "../../lib/mutation-errors";
import { FLAGGED_ACTION_COPY, openInvoicesForApply, resolveFlaggedVariables } from "../../lib/platform-billing.util";
import type { FlaggedPaymentAction, PlatformPayment } from "../../types/platform-api";
import {
  Button as UiButton,
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
  formatMoney,
  toastError,
} from "../ui";

const TITLES: Record<FlaggedPaymentAction, string> = {
  APPLY: "Apply this payment to an invoice?",
  REFUNDED_OUTSIDE: "Mark this payment refunded?",
  DISMISS: "Dismiss this payment?",
};

export interface StoreFlaggedPaymentDialogProps {
  /** The payment and the chosen action; null closes the pop-up. */
  target: { payment: PlatformPayment; action: FlaggedPaymentAction } | null;
  onClose: () => void;
  onResolved: () => Promise<unknown>;
}

export function StoreFlaggedPaymentDialog({ target, onClose, onResolved }: StoreFlaggedPaymentDialogProps) {
  const payment = target?.payment ?? null;
  const action = target?.action ?? "APPLY";
  const [invoiceId, setInvoiceId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [resolve] = useMutation(RESOLVE_FLAGGED_PLATFORM_PAYMENT);
  const invoices = useInvoices(
    payment && action === "APPLY" ? { tenantId: payment.tenantId, status: ["ISSUED", "OVERDUE"] } : null,
    { skip: !payment || action !== "APPLY" },
  );
  const openInvoices = useMemo(
    () => (payment ? openInvoicesForApply(invoices.data, payment.tenantId) : []),
    [invoices.data, payment],
  );

  useEffect(() => {
    setNote("");
    setError(null);
    setInvoiceId("");
  }, [payment?.id, action]);

  // Default to the invoice the payment was flagged against, if it's still open.
  useEffect(() => {
    if (!payment || invoiceId) return;
    const flagged = openInvoices.find((invoice) => invoice.id === payment.invoiceId);
    const first = flagged ?? openInvoices[0];
    if (first) setInvoiceId(first.id);
  }, [invoiceId, openInvoices, payment]);

  if (!payment) return null;
  const money = (amount: number) => formatMoney(amount, { currency: payment.currency });
  const chosen = openInvoices.find((invoice) => invoice.id === invoiceId);

  const close = () => {
    if (!busy) onClose();
  };

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
      addToast({ title: `Payment of ${money(payment.amount)}: ${FLAGGED_ACTION_COPY[action].label.toLowerCase()}.` });
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
    <Modal isOpen onClose={close} width="sm">
      <ModalContent>
        <ModalHeader>{TITLES[action]}</ModalHeader>
        <ModalBody>
          <p className="text-body text-fg-muted">{FLAGGED_ACTION_COPY[action].description}</p>
          {action === "APPLY" ? (
            invoices.loading ? (
              <Skeleton className="h-10 w-full rounded-lg" />
            ) : openInvoices.length === 0 ? (
              <p className="text-body text-fg-muted">
                {payment.tenantName} has no open invoice. Mark it refunded or dismiss it instead.
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
                  chosen ? `Still owed ${money(chosen.amountDue)}, due ${formatDate(chosen.dueAt)}.` : undefined
                }
              >
                {openInvoices.map((invoice) => (
                  <SelectItem key={invoice.id}>{`${invoice.number} · ${money(invoice.amountDue)} owed`}</SelectItem>
                ))}
              </Select>
            )
          ) : null}
          <Textarea
            label="Note"
            isRequired
            description="It goes to the audit log with your name."
            value={note}
            onValueChange={setNote}
            isInvalid={!!error}
            errorMessage={error ?? undefined}
          />
        </ModalBody>
        <ModalFooter>
          <UiButton variant="secondary" onPress={close} isDisabled={busy}>
            Cancel
          </UiButton>
          <UiButton
            variant={action === "APPLY" ? "primary" : "destructive"}
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
