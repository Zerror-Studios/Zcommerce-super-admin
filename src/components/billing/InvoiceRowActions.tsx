import { useMutation } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useRef, useState, type Key } from "react";
import type { PaymentReportRow } from "../../types/reports";
import { isUserInputError, mutationFailureCopy } from "../../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { VOID_REASON_OPTIONS, reasonFormFieldOf, voidInvoiceVariables } from "../../lib/billing-reasons.util";
import { APPLY_COUPON_TO_INVOICE, RECORD_INVOICE_PAYMENT, VOID_INVOICE } from "../../graphql/billing";
import { useAuth } from "../../providers/AuthProvider";
import { toasts } from "../../copy";
import { IconMore } from "../ui/icons";
import {
  Button as UiButton,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
  menuItemDangerClasses,
  toastError,
} from "../ui";

/** What the actions need; Collections rows and invoice rows both fit (PRD-017 FR-4.3). */
export type InvoiceActionRow = Pick<PaymentReportRow, "id" | "amount" | "status" | "transactionId">;

export interface InvoiceRowActionsProps {
  row: InvoiceActionRow;
  /** Re-reads the collections after a change. */
  onChanged: () => Promise<unknown>;
}

type Dialog = "payment" | "void" | "coupon" | null;

/**
 * Invoice row menu (PRD-005 FR-5.2; also Billing › Invoices and the store's invoices, PRD-017 FR-4.3):
 * record a payment, apply a discount, void. Open invoices only; each asks first and re-reads after.
 */
export function InvoiceRowActions({ row, onChanged }: InvoiceRowActionsProps) {
  const { can } = useAuth();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Blocks a second submit before the `busy` re-render lands; the server
  // also returns the same payment for a repeated record (PRD-014 FR-0.10).
  const inFlight = useRef(false);
  const [amount, setAmount] = useState(String(row.amount));
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  // PRD-025 FR-4.4: the void reason enum is required; `reason` stays the free-text note.
  const [voidReason, setVoidReason] = useState("");
  const [voidErrorField, setVoidErrorField] = useState<"reason" | "note" | null>(null);
  const [code, setCode] = useState("");
  const [recordPayment] = useMutation(RECORD_INVOICE_PAYMENT);
  const [voidInvoice] = useMutation(VOID_INVOICE);
  const [applyCoupon] = useMutation(APPLY_COUPON_TO_INVOICE);

  const open = row.status === "pending" || row.status === "overdue";
  // Every action here needs billing:manage (review C-M5).
  if (!open || !can(PLATFORM_PERMISSIONS.BILLING_MANAGE)) return null;

  const run = async (work: () => Promise<unknown>, done: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
      await onChanged();
      addToast({ title: done });
      setDialog(null);
    } catch (err) {
      const message = mutationFailureCopy(err);
      if (message && isUserInputError(err)) setError(message);
      else if (message) toastError(message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  // Cancel, X, Escape and an outside click all close here, so a stale error doesn't reappear.
  const closeDialog = () => {
    setDialog(null);
    setError(null);
    setVoidErrorField(null);
  };

  // PRD-025 FR-4.4 / FR-6.4: why it is voided (required); written off feeds the bad-debt reports.
  const runVoid = () => {
    const result = voidInvoiceVariables(row.id, { voidReason, note: reason });
    if (!result.variables) {
      setVoidErrorField(result.field);
      setError(result.error);
      return;
    }
    const variables = result.variables;
    void run(async () => {
      try {
        return await voidInvoice({ variables });
      } catch (err) {
        setVoidErrorField(reasonFormFieldOf(err));
        throw err;
      }
    }, toasts.invoiceVoided);
  };

  const onAction = (key: Key) => {
    if (key === "payment" || key === "void" || key === "coupon") setDialog(key);
  };

  return (
    <>
      <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <IconButton aria-label={`Actions for invoice ${row.transactionId}`} showTooltip={false} size="sm">
              <IconMore aria-hidden className="size-4" />
            </IconButton>
          </DropdownTrigger>
          <DropdownMenu aria-label="Invoice actions" onAction={onAction}>
            <DropdownItem key="payment">Record payment</DropdownItem>
            <DropdownItem key="coupon">Apply discount code</DropdownItem>
            <DropdownItem key="void" className={menuItemDangerClasses}>
              Void invoice
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>

      <Modal isOpen={dialog === "payment"} onClose={closeDialog} width="sm">
        <ModalContent>
          <ModalHeader>Record payment for {row.transactionId}</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Input label="Amount (₹)" type="number" min={1} value={amount} onValueChange={setAmount} />
              <Input label="Paid on" type="date" value={paidAt} onValueChange={setPaidAt} />
              <Input label="Reference" placeholder="UPI-12345" value={reference} onValueChange={setReference} isInvalid={!!error} errorMessage={error ?? undefined} />
            </div>
          </ModalBody>
          <ModalFooter>
            <UiButton variant="secondary" onPress={closeDialog}>Cancel</UiButton>
            <UiButton
              variant="primary"
              isLoading={busy}
              isDisabled={busy}
              onPress={() =>
                void run(
                  () =>
                    recordPayment({
                      variables: {
                        id: row.id,
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

      <Modal isOpen={dialog === "coupon"} onClose={closeDialog} width="sm">
        <ModalContent>
          <ModalHeader>Apply a discount code</ModalHeader>
          <ModalBody>
            <Input label="Code" placeholder="LAUNCH25" value={code} onValueChange={(value) => setCode(value.toUpperCase())} isInvalid={!!error} errorMessage={error ?? undefined} />
          </ModalBody>
          <ModalFooter>
            <UiButton variant="secondary" onPress={closeDialog}>Cancel</UiButton>
            <UiButton
              variant="primary"
              isLoading={busy}
              onPress={() => void run(() => applyCoupon({ variables: { invoiceId: row.id, code } }), toasts.discountApplied)}
            >
              Apply
            </UiButton>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Void (PRD-025 FR-4.4): a form like the two above, because the void reason is required and the
          action stays disabled until one is chosen. */}
      <Modal isOpen={dialog === "void"} onClose={closeDialog} width="sm">
        <ModalContent>
          <ModalHeader>Void invoice {row.transactionId}?</ModalHeader>
          <ModalBody>
            <p className="text-body text-fg-muted">The store no longer owes this amount. This can't be undone.</p>
            <Select
              label="Void reason"
              isRequired
              className="mt-3"
              selectedKeys={voidReason ? new Set([voidReason]) : new Set()}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0];
                setVoidReason(typeof value === "string" ? value : "");
                setVoidErrorField(null);
                setError(null);
              }}
              isInvalid={voidErrorField === "reason" && !!error}
              errorMessage={voidErrorField === "reason" ? (error ?? undefined) : undefined}
            >
              {VOID_REASON_OPTIONS.map((option) => (
                <SelectItem key={option.key}>{option.label}</SelectItem>
              ))}
            </Select>
            <Textarea
              label="Note"
              description="Optional. Kept on the invoice and in the audit log."
              value={reason}
              onValueChange={(value) => {
                setReason(value);
                setVoidErrorField(null);
                setError(null);
              }}
              isInvalid={voidErrorField !== "reason" && !!error}
              errorMessage={voidErrorField !== "reason" ? (error ?? undefined) : undefined}
              className="mt-3"
            />
          </ModalBody>
          <ModalFooter>
            <UiButton variant="secondary" onPress={closeDialog} isDisabled={busy}>Cancel</UiButton>
            <UiButton variant="destructive" isLoading={busy} isDisabled={busy || !voidReason} onPress={runVoid}>
              Void invoice
            </UiButton>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
